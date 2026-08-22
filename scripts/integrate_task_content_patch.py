"""Import approved learner-facing task copy without replacing current runtime fields."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "content" / "catalog.json"
EDITORIAL = ROOT / "content" / "task_editorial.json"
USER_FIELDS = (
    "title",
    "instructions",
    "learning_objective",
    "hints",
    "completion_summary",
    "explanation",
)
RUNTIME_FIELDS = (
    "setup_code",
    "starter_code",
    "solution_code",
    "tests",
    "dataset",
    "required_tokens",
    "expected_type",
)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def tasks(catalog: dict) -> list[dict]:
    return [exercise for module in catalog["modules"] for topic in module["topics"] for exercise in topic["exercises"]]


def runtime_snapshot(catalog: dict) -> dict:
    return {
        exercise["id"]: {field: exercise.get(field) for field in RUNTIME_FIELDS}
        for exercise in tasks(catalog)
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("patch", type=Path)
    parser.add_argument("--exclude", default="")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "task-bank-v3-integration.json")
    args = parser.parse_args()
    excluded = {item for item in args.exclude.split(",") if item}
    catalog = load(CATALOG)
    editorial = load(EDITORIAL)
    patch_bytes = args.patch.read_bytes()
    patch = load(args.patch)
    incoming = {item["id"]: item for item in patch["tasks"]}
    current = {item["id"]: item for item in tasks(catalog)}
    unknown = set(incoming) - set(current)
    if unknown or set(editorial["tasks"]) != set(current):
        raise SystemExit(f"Stable task IDs in patch, catalog and editorial source do not match: {sorted(unknown)}")
    before_runtime = runtime_snapshot(catalog)
    updated = []
    for task_id in incoming:
        exercise = current[task_id]
        if task_id in excluded:
            continue
        authored = incoming[task_id]
        missing = [field for field in USER_FIELDS if field not in authored]
        if missing:
            raise SystemExit(f"{task_id}: patch misses {missing}")
        for field in USER_FIELDS:
            exercise[field] = authored[field]
            editorial["tasks"][task_id][field] = authored[field]
        updated.append(task_id)
    if runtime_snapshot(catalog) != before_runtime:
        raise SystemExit("Runtime fields changed during user-facing content import")
    editorial["version"] = patch.get("version", editorial.get("version", 1))
    write(CATALOG, catalog)
    write(EDITORIAL, editorial)
    args.report.parent.mkdir(exist_ok=True)
    write(args.report, {
        "source": args.patch.name,
        "sourceSha256": hashlib.sha256(patch_bytes).hexdigest(),
        "updatedTaskCount": len(updated),
        "updatedTaskIds": updated,
        "excludedRuntimeConflicts": sorted(excluded),
        "runtimeFieldsPreserved": True,
    })
    print(f"TASK CONTENT IMPORT PASSED: {len(updated)} updated, {len(excluded)} runtime conflicts excluded")


if __name__ == "__main__":
    main()
