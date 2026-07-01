#!/usr/bin/env python3
"""Lightweight spec-sync drift guard (replaces the Aethel ``[sync]`` linter).

Under the spec-kit workflow there is no Aethel doc-linter, so this small,
self-contained pre-commit check preserves the one machine-enforced discipline
worth keeping: code and its documentation move together. When a commit stages
source code, it must also stage at least one spec/doc artifact (a spec-kit
``specs/**`` file, a ``knowledge/**`` reference topic, the constitution, the
knowledge index, or the changelog).

Fail-fast: prints what is missing and exits non-zero so the commit is blocked.
Bypass for an intentionally doc-irrelevant commit:  SKIP_SPEC_SYNC=1 git commit ...
"""

from __future__ import annotations

import os
import subprocess
import sys

# Source code whose changes should be accompanied by a doc/spec update.
CODE_PREFIXES = ("src/",)
CODE_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py")

# Artifacts that count as "the spec/doc moved with the code".
DOC_PREFIXES = ("specs/", "knowledge/", ".specify/memory/")
DOC_FILES = ("CONTEXT.md", "CHANGELOG.md", "README.md")


def staged_files() -> list[str]:
    """Return staged (added/copied/modified/renamed) paths, forward-slashed."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def is_code(path: str) -> bool:
    return path.startswith(CODE_PREFIXES) and path.endswith(CODE_EXTS)


def is_doc(path: str) -> bool:
    return path.startswith(DOC_PREFIXES) or path in DOC_FILES


def main() -> int:
    if os.environ.get("SKIP_SPEC_SYNC") == "1":
        return 0

    files = staged_files()
    if not files:
        return 0

    code = [f for f in files if is_code(f)]
    docs = [f for f in files if is_doc(f)]

    if code and not docs:
        sys.stderr.write(
            "spec-sync guard: staged source code but no spec/doc update in this commit.\n"
            "  Update the relevant spec/doc in the SAME commit:\n"
            "    specs/**, knowledge/**, .specify/memory/constitution.md, CONTEXT.md, or CHANGELOG.md\n"
            "  Or bypass for a doc-irrelevant commit:  SKIP_SPEC_SYNC=1 git commit ...\n"
            f"  Staged code: {', '.join(code[:10])}{' ...' if len(code) > 10 else ''}\n"
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
