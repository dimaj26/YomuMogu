#!/usr/bin/env python3
"""Триггер свежести семантического слоя графа, разнесённый по двум хукам.

graphify-хуки (`post-commit`/`post-checkout`) пересобирают код + AST-структуру
доков оффлайн, но НЕ перезапускают семантический LLM-проход по изменённым докам
и при этом затирают родной флаг `needs_update`. Поэтому после коммита со спекой
семантические узлы графа молча устаревают.

Семантический проход платный (LLM-backend), а spec-sync guard заставляет почти
каждый код-коммит тащить правку доки — поэтому запуск `--update` на КАЖДОМ коммите
выливался в стоимость почти на каждый коммит. Чтобы платить один раз за push,
работа разнесена на два режима:

* pre-commit (`--mark-only`, он же режим по умолчанию): при staged-изменениях
  спека-`.md` лишь выставляет родной флаг `needs_update` — дёшево, оффлайн, без
  API. Флаг работает аккумулятором грязноты между коммитами и виден через
  `graphify check-update` / `/graphify`.
* pre-push (`--push`): если флаг выставлен — в ОТДЕЛЁННОМ процессе запускает
  `graphify . --update`. Per-file кэш graphify переэмбедит только реально
  изменённые доки, так что весь doc-churn со всех коммитов схлопывается в один
  оплачиваемый проход. Дочерний процесс владеет флагом: снимает при успехе,
  оставляет при падении. Ни коммит, ни push никогда не блокируются (всегда exit 0).

Если `claude` CLI найден на PATH, проход идёт через backend `claude-cli`
(billing с подписки Claude Code Pro/Max, не с ANTHROPIC_API_KEY) с моделью
`GRAPHIFY_CLAUDE_CLI_MODEL` (по умолчанию `haiku` — Opus для структурного JSON
избыточен). Без `claude` на PATH — прежний автодетект backend по API-ключам.
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


def _resolve_claude_cli() -> str | None:
    """Найти `claude` CLI на PATH (Windows предпочитает .cmd — см. graphify/llm.py)."""
    import shutil

    if os.name == "nt":
        return shutil.which("claude.cmd") or shutil.which("claude")
    return shutil.which("claude")


def _run_update_child() -> int:
    """Дочерний (detached) режим: пометить грязно → `--update` → снять флаг при успехе."""
    _set_flag()
    test_cmd = os.environ.get(TEST_CMD_ENV)
    if test_cmd:
        rc = subprocess.run(test_cmd, shell=True).returncode
    else:
        cmd = [sys.executable, "-m", "graphify", ".", "--update"]
        env = os.environ.copy()
        if _resolve_claude_cli():
            # Подписка вместо API-ключа — иначе автодетект уйдёт на DeepSeek/Gemini
            # по ключам из окружения CCR-роутера.
            cmd += ["--backend", "claude-cli"]
            env.setdefault("GRAPHIFY_CLAUDE_CLI_MODEL", "haiku")
        else:
            sys.stderr.write(
                "[graph-doc-sync] claude CLI не найден на PATH — backend claude-cli "
                "пропущен, используется автодетект по API-ключам\n"
            )
        rc = subprocess.run(cmd, env=env).returncode
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


def _run_push(dry: bool) -> int:
    """pre-push: оплатить семантический проход один раз, если флаг накопил грязноту."""
    if not _flag_path().exists():
        if dry:
            print("[graph-doc-sync] push: граф свеж (needs_update снят) — пропуск")
        return 0
    if dry:
        print("[graph-doc-sync] push: needs_update выставлен -> фоновый семантический --update")
        return 0
    py = resolve_python()
    if not py:
        # fail-soft, но видимо: флаг оставлен, причина не заглушена (G-fail-fast)
        sys.stderr.write(
            "[graph-doc-sync] python+graphify не найден; needs_update оставлен, "
            "запусти graphify . --update вручную перед расшариванием графа\n"
        )
        return 0
    print(
        "[graph-doc-sync] push: накопленные правки доков -> фоновая семантическая "
        "доэкстракция (needs_update снимется при успехе)"
    )
    launch_detached(py)
    return 0


def _run_mark(dry: bool) -> int:
    """pre-commit: только пометить семантический слой грязным; --update отложен до push."""
    docs = staged_doc_changes()
    if not docs:
        if dry:
            print("[graph-doc-sync] нет изменений спеки")
        return 0
    if dry:
        print(f"[graph-doc-sync] пометит грязно -> {len(docs)} spec-файл(ов): {', '.join(docs)}")
        return 0
    _set_flag()
    print(
        f"[graph-doc-sync] {len(docs)} spec-файл(ов) изменено -> needs_update выставлен "
        "(семантический --update отложен до pre-push)"
    )
    return 0


def main(argv: list[str]) -> int:
    # Дочерний режим: синхронно отработать --update (его уже запустили detached).
    if "--run-update" in argv:
        return _run_update_child()

    if os.environ.get(SKIP_ENV, "0") == "1":
        return 0
    if in_rebase_or_merge():
        return 0

    dry = "--dry-run" in argv
    # --push = pre-push (оплачиваемый батч); по умолчанию / --mark-only = pre-commit.
    if "--push" in argv:
        return _run_push(dry)
    return _run_mark(dry)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
