#!/usr/bin/env python3
"""Pre-commit триггер свежести семантического слоя графа (C+).

graphify-хуки (`post-commit`/`post-checkout`) пересобирают код + AST-структуру
доков оффлайн, но НЕ перезапускают семантический LLM-проход по изменённым докам
и при этом затирают родной флаг `needs_update`. Поэтому после коммита со спекой
семантические узлы графа молча устаревают.

Этот скрипт закрывает дыру (форма C+): при staged-изменениях спека-`.md` он
помечает семантический слой грязным через родной флаг graphify `needs_update`
(видимо для `graphify check-update` / `/graphify`), затем в ОТДЕЛЁННОМ процессе
запускает `graphify . --update`. Дочерний процесс владеет флагом: снимает его при
успехе и оставляет при падении — свежесть автоматическая, но упавший прогон
остаётся видимым. Коммит никогда не блокируется (всегда exit 0).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

OUT_DIR = "graphify-out"
FLAG_NAME = "needs_update"
SKIP_ENV = "GRAPHIFY_SKIP_DOC_SYNC"
TEST_CMD_ENV = "GRAPHIFY_DOC_SYNC_CMD"  # тест-хук: подменить команду --update (форс-фейл)
LOG_PATH = Path.home() / ".cache" / "graphify-doc-sync.log"


def _git(*args: str) -> str:
    """Запустить git и вернуть stdout (пустая строка при ошибке)."""
    proc = subprocess.run(
        ["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    return proc.stdout


def _flag_path() -> Path:
    return Path(OUT_DIR) / FLAG_NAME


def in_rebase_or_merge() -> bool:
    """Идёт ли rebase/merge/cherry-pick — тогда триггер пропускаем."""
    git_dir = _git("rev-parse", "--git-dir").strip()
    if not git_dir:
        return False
    g = Path(git_dir)
    return any(
        (g / m).exists() for m in ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD")
    )


def staged_doc_changes() -> list[str]:
    """Staged спека-`.md` (статусы A/C/M/D/R), кроме `_nogit_*`."""
    raw = _git("diff", "--cached", "--name-status", "-z", "--diff-filter=ACDMR")
    fields = raw.split("\0")
    docs: list[str] = []
    i = 0
    while i < len(fields):
        status = fields[i]
        if not status:
            i += 1
            continue
        # rename/copy идут двумя путями: <status>\0<src>\0<dst>; берём целевой
        if status[0] in ("R", "C"):
            path = fields[i + 2] if i + 2 < len(fields) else ""
            i += 3
        else:
            path = fields[i + 1] if i + 1 < len(fields) else ""
            i += 2
        if path.endswith(".md") and not Path(path).name.startswith("_nogit_"):
            docs.append(path)
    return docs


def resolve_python() -> str:
    """Найти интерпретатор с установленным graphify (venv приоритетно)."""
    venv = Path("venv/Scripts/python.exe")
    if venv.exists():
        return str(venv)
    for name in ("python3", "python"):
        probe = subprocess.run([name, "-c", "import graphify"], capture_output=True)
        if probe.returncode == 0:
            return name
    return ""


def _set_flag() -> None:
    flag = _flag_path()
    flag.parent.mkdir(parents=True, exist_ok=True)
    flag.write_text("1", encoding="utf-8")


def _run_update_child() -> int:
    """Дочерний (detached) режим: пометить грязно → `--update` → снять флаг при успехе."""
    _set_flag()
    test_cmd = os.environ.get(TEST_CMD_ENV)
    if test_cmd:
        rc = subprocess.run(test_cmd, shell=True).returncode
    else:
        rc = subprocess.run([sys.executable, "-m", "graphify", ".", "--update"]).returncode
    if rc == 0:
        flag = _flag_path()
        if flag.exists():
            flag.unlink()  # свежо → снять видимый флаг
    else:
        sys.stderr.write(
            f"[graph-doc-sync] graphify --update упал (rc={rc}); needs_update оставлен\n"
        )
    return rc


def launch_detached(py: str) -> None:
    """Запустить дочерний `--run-update` отдельным процессом, не блокируя коммит."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log = open(LOG_PATH, "a", buffering=1, encoding="utf-8", errors="replace")
    cmd = [py, os.path.abspath(__file__), "--run-update"]
    kw = dict(stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, close_fds=True)
    if os.name == "nt":
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        try:
            subprocess.Popen(cmd, creationflags=flags | 0x01000000, **kw)  # + BREAKAWAY_FROM_JOB
        except OSError:
            subprocess.Popen(cmd, creationflags=flags, **kw)
    else:
        subprocess.Popen(cmd, start_new_session=True, **kw)


def main(argv: list[str]) -> int:
    # Дочерний режим: синхронно отработать --update (его уже запустили detached).
    if "--run-update" in argv:
        return _run_update_child()

    if os.environ.get(SKIP_ENV, "0") == "1":
        return 0
    if in_rebase_or_merge():
        return 0

    docs = staged_doc_changes()
    dry = "--dry-run" in argv

    if not docs:
        if dry:
            print("[graph-doc-sync] нет изменений спеки")
        return 0

    if dry:
        print(f"[graph-doc-sync] сработает -> {len(docs)} spec-файл(ов): {', '.join(docs)}")
        return 0

    py = resolve_python()
    if not py:
        # fail-soft, но видимо: помечаем грязно и не глушим причину (G-fail-fast)
        _set_flag()
        sys.stderr.write(
            "[graph-doc-sync] python+graphify не найден; needs_update выставлен, "
            "запусти /graphify --update вручную\n"
        )
        return 0

    print(
        f"[graph-doc-sync] {len(docs)} spec-файл(ов) изменено -> фоновая семантическая "
        "доэкстракция (needs_update выставлен; снимется при успехе)"
    )
    launch_detached(py)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
