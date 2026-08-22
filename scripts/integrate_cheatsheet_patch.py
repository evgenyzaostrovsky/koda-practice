import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UNITS_PATH = ROOT / "content" / "knowledge_units.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Integrate an authored KnowledgeUnit cheat-sheet patch")
    parser.add_argument("patch", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    document = json.loads(UNITS_PATH.read_text(encoding="utf-8"))
    patch = json.loads(args.patch.read_text(encoding="utf-8"))
    if patch.get("scope") != "cheatSheet-only":
        raise SystemExit("Expected a cheatSheet-only patch")

    current = {unit["id"]: unit for unit in document["units"]}
    authored = patch.get("units", [])
    patch_ids = [unit["id"] for unit in authored]
    if len(patch_ids) != len(set(patch_ids)):
        raise SystemExit("Patch contains duplicate KnowledgeUnit IDs")
    missing = sorted(set(patch_ids) - set(current))
    if missing:
        raise SystemExit(f"Unknown KnowledgeUnit IDs: {missing}")

    for patch_unit in authored:
        current[patch_unit["id"]]["cheatSheet"] = patch_unit["cheatSheet"]

    UNITS_PATH.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {
        "version": patch.get("version"),
        "scope": patch.get("scope"),
        "knowledgeUnitsUpdated": len(authored),
        "cheatEntriesIntegrated": sum(len(unit["cheatSheet"]["entries"]) for unit in authored),
        "knowledgeUnitIds": patch_ids,
    }
    if args.report:
        target = args.report if args.report.is_absolute() else ROOT / args.report
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
