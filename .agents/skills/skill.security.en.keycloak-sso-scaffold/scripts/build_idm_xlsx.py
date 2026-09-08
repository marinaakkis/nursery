#!/usr/bin/env python3
"""Build the IDM access-request questionnaire (``<service>_Новые продукты_IDM.xlsx``).

This is the "Опросник" the developer attaches to the IDM ServiceDesk ticket
"Изменение данных IDM"
(https://jira.biocad.ru/plugins/servlet/desk/portal/3/create/992).

The skill `keycloak-sso-scaffold` calls this after generating the Keycloak
hand-off, but ONLY when the app has roles / AD groups. The file reproduces the
column layout of the reference `Portal4_Новые продукты_IDM.numbers`:

    Наименование системы или бизнес-сервиса | Наименование доступа |
    Описание доступа | Владелец | Подтверждающие (опционально) |
    Особый порядок согласования | Привязка к локации |
    Доступ к коммерческой тайне | Доступ к персональным данным |
    Административные привелегии | Связанные доступы (опционально) |
    Группа безопасности AD (при наличии)

Rows are grouped by environment (Test / Stage / Prod by default, matching the
reference file), with a blank separator row between groups. The AD-group column
is derived exactly like the Keycloak hand-off so IDM and route66_ldap_groups
stay in sync:

    KC-Role-<app_name>-<env>-<role>        (env-qualified, default)
    KC-Role-<app_name>-<role>              (flat, when no environments given)

Usage
-----
    python3 build_idm_xlsx.py --spec idm-spec.json
    python3 build_idm_xlsx.py --spec idm-spec.json --out "MyApp_Новые продукты_IDM.xlsx"
    cat idm-spec.json | python3 build_idm_xlsx.py --spec -

The spec format is documented in `idm-spec.example.json`.
"""

from __future__ import annotations

import argparse
import json
import sys

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
except ImportError:  # pragma: no cover - surfaced to the agent/developer
    sys.stderr.write(
        "openpyxl is required. Install with: pip3 install openpyxl\n"
    )
    raise SystemExit(2)


# Column order and header text are reproduced VERBATIM from the corporate
# reference file. Do NOT "fix" the spelling of "привелегии" — IDM reviewers
# match the template by these exact captions.
HEADERS = [
    "Наименование системы или бизнес-сервиса",
    "Наименование доступа",
    "Описание доступа",
    "Владелец",
    "Подтверждающие (опционально)",
    "Особый порядок согласования",
    "Привязка к локации",
    "Доступ к коммерческой тайне",
    "Доступ к персональным данным",
    "Административные привелегии",
    "Связанные доступы (опционально)",
    "Группа безопасности AD (при наличии)",
]

COLUMN_WIDTHS = [26, 42, 60, 22, 22, 30, 18, 22, 24, 22, 24, 44]

# Defaults mirror the reference Portal4 file so a sparse spec still produces a
# realistic questionnaire.
DEFAULT_APPROVAL_ORDER = "руководитель -> владелец  > ИБ"
DEFAULT_CONFIRMERS = "-"
DEFAULT_LOCATION_BINDING = "Нет"
DEFAULT_RELATED_ACCESS = "Нет"
DEFAULT_ENVIRONMENTS = [
    {"key": "test", "display_prefix": "", "contour_phrase": " на тестовом контуре"},
    {"key": "stage", "display_prefix": "", "contour_phrase": " на препродуктовом контуре"},
    {"key": "prod", "display_prefix": "", "contour_phrase": ""},
]


def _norm_flag(value, default="Нет"):
    """Normalise a sensitivity flag to the corporate 'Да' / 'Нет' wording."""
    if value is None:
        return default
    if isinstance(value, bool):
        return "Да" if value else "Нет"
    text = str(value).strip()
    if text.lower() in {"да", "yes", "true", "y", "1"}:
        return "Да"
    if text.lower() in {"нет", "no", "false", "n", "0", ""}:
        return "Нет"
    return text


def _ad_group(app_name: str, env_key: str, role_name: str) -> str:
    app = app_name.strip().lower()
    role = role_name.strip().lower()
    env = (env_key or "").strip().lower()
    parts = ["KC-Role", app]
    if env:
        parts.append(env)
    parts.append(role)
    return "-".join(parts)


def _access_name(system_display: str, env_prefix: str, human_name: str) -> str:
    """'<env prefix> - <human role name>', e.g. 'Portal 4 Test - Пользователь ...'.

    When no explicit prefix is given, fall back to the system display name.
    """
    prefix = (env_prefix or system_display).strip()
    return f"{prefix} - {human_name}".strip(" -") if human_name else prefix


def build_rows(spec: dict) -> list[list]:
    system_display = spec.get("system_display_name") or spec.get("app_name", "")
    app_name = spec["app_name"]
    owner = spec.get("owner", "")
    confirmers = spec.get("confirmers", DEFAULT_CONFIRMERS)
    approval_order = spec.get("approval_order", DEFAULT_APPROVAL_ORDER)
    location_binding = spec.get("location_binding", DEFAULT_LOCATION_BINDING)
    related_access = spec.get("related_access", DEFAULT_RELATED_ACCESS)

    environments = spec.get("environments")
    if not environments:
        # Flat mode: a single, unqualified environment.
        environments = [{"key": "", "display_prefix": "", "contour_phrase": ""}]

    roles = spec["roles"]

    rows: list[list] = []
    for env_index, env in enumerate(environments):
        env_key = env.get("key", "")
        env_prefix = env.get("display_prefix", "")
        contour = env.get("contour_phrase", "")
        for role in roles:
            human_name = role.get("human_name", role["name"])
            description = role.get("description", "").replace("{contour}", contour)
            rows.append(
                [
                    system_display,
                    _access_name(system_display, env_prefix, human_name),
                    description,
                    role.get("owner", owner),
                    role.get("confirmers", confirmers),
                    role.get("approval_order", approval_order),
                    role.get("location_binding", location_binding),
                    _norm_flag(role.get("commercial_secret")),
                    _norm_flag(role.get("personal_data")),
                    _norm_flag(role.get("admin_privileges")),
                    role.get("related_access", related_access),
                    _ad_group(app_name, env_key, role["name"]),
                ]
            )
        # Blank separator row between environment groups (not after the last).
        if env_index != len(environments) - 1:
            rows.append([None] * len(HEADERS))
    return rows


def build_workbook(spec: dict) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "Опросник"

    thin = Side(style="thin", color="B0B0B0")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_fill = PatternFill("solid", fgColor="D9E1F2")
    header_font = Font(bold=True)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    body_align = Alignment(horizontal="left", vertical="top", wrap_text=True)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Header row.
    for col, caption in enumerate(HEADERS, start=1):
        cell = ws.cell(row=1, column=col, value=caption)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = border
        ws.column_dimensions[get_column_letter(col)].width = COLUMN_WIDTHS[col - 1]

    # Data rows.
    rows = build_rows(spec)
    for r_offset, values in enumerate(rows):
        excel_row = r_offset + 2
        is_blank = all(v in (None, "") for v in values)
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=excel_row, column=col, value=value)
            if is_blank:
                continue
            cell.border = border
            # Yes/No flag columns (8,9,10) get centred.
            cell.alignment = center_align if col in (8, 9, 10) else body_align

    ws.freeze_panes = "A2"
    ws.sheet_view.showGridLines = True
    return wb


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--spec",
        required=True,
        help="Path to the JSON spec, or '-' to read from stdin.",
    )
    parser.add_argument(
        "--out",
        help="Output .xlsx path. Overrides spec.output_path. "
        "Defaults to '<system>_Новые продукты_IDM.xlsx'.",
    )
    args = parser.parse_args(argv)

    if args.spec == "-":
        spec = json.load(sys.stdin)
    else:
        with open(args.spec, encoding="utf-8") as fh:
            spec = json.load(fh)

    if "app_name" not in spec or "roles" not in spec:
        sys.stderr.write("spec must contain 'app_name' and 'roles'.\n")
        return 2

    out_path = (
        args.out
        or spec.get("output_path")
        or f"{spec.get('system_display_name', spec['app_name'])}_Новые продукты_IDM.xlsx"
    )

    wb = build_workbook(spec)
    wb.save(out_path)
    sys.stdout.write(f"Wrote {out_path}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
