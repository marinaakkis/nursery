"""sync-dev-plan.py — синхронизация таблицы Dev-задач в dev-plan из dev-task-файлов.

Usage:
    python sync-dev-plan.py <path-to-dev-plan.md>

Логика:
1. Находит все dev-task.r-*.t-*.*.md рядом с dev-plan (в той же директории).
2. Извлекает Код dev-задачи, Аннотацию, Версию из каждого dev-task-файла.
3. Обновляет соответствующие строки в таблице Dev-задач dev-plan.
4. Если данные изменились — добавляет строку в Changelog dev-plan.
5. Выводит отчёт в stdout.
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

_FIELD_RE = re.compile(r"^\*\*([^*]+)\*\*:\s*`?([^`\n]+)`?\s*$")
_DEV_TASK_FILE_RE = re.compile(r"^dev-task\.r-[0-9]{3}\.t-[0-9]{3}\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$")


def _parse_dev_task_fields(text: str) -> dict[str, str]:
    """Extract Код dev-задачи, Аннотация, Версия from dev-task markdown front-matter."""
    fields: dict[str, str] = {}
    for line in text.splitlines():
        m = _FIELD_RE.match(line.strip())
        if m:
            key, value = m.group(1).strip(), m.group(2).strip()
            if key in ("Код dev-задачи", "Версия", "Аннотация"):
                fields[key] = value
        if len(fields) == 3:
            break
    return fields


def _find_dev_task_files(dev_plan_path: Path) -> list[Path]:
    """Return all dev-task.r-*.t-*.*.md files in the same directory as dev-plan."""
    parent = dev_plan_path.parent
    return sorted(
        p for p in parent.glob("dev-task.r-*.t-*.*.md") if _DEV_TASK_FILE_RE.match(p.name)
    )


# ---------------------------------------------------------------------------
# Table helpers
# ---------------------------------------------------------------------------

_TABLE_HEADER_DEV_TASKS = re.compile(
    r"\|\s*№\s*\|\s*Код\s*\|\s*Аннотация\s*\|\s*Версия\s*\|\s*Ссылка\s*\|.*Комментарий.*\|",
    re.IGNORECASE,
)
_TABLE_ROW_RE = re.compile(r"^\|.+\|$")
_TABLE_SEPARATOR_RE = re.compile(r"^\|[-| :]+\|$")

_TABLE_HEADER_CHANGELOG = re.compile(
    r"\|\s*№\s*\|\s*Дата\s*\|\s*Версия\s*\|\s*Описание изменения\s*\|.*Комментарий.*\|",
    re.IGNORECASE,
)


def _split_row(row: str) -> list[str]:
    """Split a markdown table row into cells (strips whitespace)."""
    return [c.strip() for c in row.strip().strip("|").split("|")]


def _build_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def _update_dev_tasks_table(lines: list[str], dev_tasks: dict[str, dict[str, str]]) -> tuple[list[str], list[str]]:
    """Update Dev-задачи table rows in-place.

    Returns (updated_lines, list_of_changed_codes).
    """
    changed: list[str] = []
    in_header = False
    past_separator = False
    result: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        if not in_header and _TABLE_HEADER_DEV_TASKS.search(line):
            in_header = True
            past_separator = False
            result.append(line)
            i += 1
            continue

        if in_header and not past_separator and _TABLE_SEPARATOR_RE.match(line.strip()):
            past_separator = True
            result.append(line)
            i += 1
            continue

        if in_header and past_separator:
            if _TABLE_ROW_RE.match(line.strip()):
                cells = _split_row(line)
                # Columns: № | Код | Аннотация | Версия | Ссылка | Комментарий
                if len(cells) >= 6:
                    code = cells[1].strip("`")
                    if code in dev_tasks:
                        new_annotation = dev_tasks[code].get("Аннотация", cells[2])
                        new_version = dev_tasks[code].get("Версия", cells[3])
                        if cells[2] != new_annotation or cells[3] != new_version:
                            changed.append(code)
                            cells[2] = new_annotation
                            cells[3] = new_version
                            line = _build_row(cells)
            else:
                in_header = False

        result.append(line)
        i += 1

    return result, changed


def _append_changelog_rows(lines: list[str], changed_codes: list[str]) -> list[str]:
    """Append a new row to the Changelog table for changed dev-tasks."""
    today = date.today().isoformat()
    in_header = False
    past_separator = False
    last_row_idx = -1
    last_num = 0

    for idx, line in enumerate(lines):
        if not in_header and _TABLE_HEADER_CHANGELOG.search(line):
            in_header = True
            past_separator = False
            continue

        if in_header and not past_separator and _TABLE_SEPARATOR_RE.match(line.strip()):
            past_separator = True
            continue

        if in_header and past_separator:
            if _TABLE_ROW_RE.match(line.strip()):
                last_row_idx = idx
                cells = _split_row(line)
                try:
                    last_num = int(cells[0])
                except (ValueError, IndexError):
                    pass
            else:
                in_header = False

    if last_row_idx < 0:
        return lines

    new_lines = list(lines)
    insert_at = last_row_idx + 1
    description = f"Обновлены dev-задачи: {', '.join(changed_codes)}."

    new_num = last_num + 1
    new_row = _build_row([str(new_num), today, "-", description, "-"])
    new_lines.insert(insert_at, new_row)
    return new_lines


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python sync-dev-plan.py <path-to-dev-plan.md>", file=sys.stderr)
        return 1

    dev_plan_path = Path(argv[1]).resolve()
    if not dev_plan_path.is_file():
        print(f"Error: file not found: {dev_plan_path}", file=sys.stderr)
        return 1

    dev_task_files = _find_dev_task_files(dev_plan_path)
    if not dev_task_files:
        print("No dev-task files found. Nothing to sync.")
        return 0

    dev_tasks: dict[str, dict[str, str]] = {}
    for tf in dev_task_files:
        text = tf.read_text(encoding="utf-8")
        fields = _parse_dev_task_fields(text)
        code = fields.get("Код dev-задачи")
        if code:
            dev_tasks[code] = fields
        else:
            print(f"Warning: 'Код dev-задачи' not found in {tf.name}, skipping.")

    dev_plan_text = dev_plan_path.read_text(encoding="utf-8")
    lines = dev_plan_text.splitlines(keepends=True)
    lines_stripped = [ln.rstrip("\n") for ln in lines]

    updated, changed = _update_dev_tasks_table(lines_stripped, dev_tasks)

    if not changed:
        print("Everything is up to date. No changes made.")
        return 0

    print(f"Updated dev-tasks: {', '.join(changed)}")
    updated = _append_changelog_rows(updated, changed)

    dev_plan_path.write_text("\n".join(updated) + "\n", encoding="utf-8")
    print(f"Saved: {dev_plan_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
