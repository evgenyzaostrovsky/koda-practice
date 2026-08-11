"""Persistent Content Pipeline for KODA Practice learning materials."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content" / "catalog.json"
THEORY_PATH = ROOT / "content" / "theory_bank.json"
UNITS_PATH = ROOT / "content" / "knowledge_units.json"
REPORTS = ROOT / "reports"
ALLOWED_DOC_HOSTS = {
    "pandas.pydata.org",
    "matplotlib.org",
    "seaborn.pydata.org",
    "numpy.org",
    "docs.python.org",
}
CREATED_AT = "2026-08-11T00:00:00Z"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def exercises(catalog):
    return [exercise for module in catalog["modules"] for topic in module["topics"] for exercise in topic["exercises"]]


def topics(catalog):
    return [topic for module in catalog["modules"] for topic in module["topics"]]


def code_calls(code: str) -> list[str]:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    names = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Attribute):
            names.append(node.func.attr)
        elif isinstance(node.func, ast.Name):
            names.append(node.func.id)
    return list(dict.fromkeys(names))


def normalized_solution(code: str) -> str:
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            node.id = "VAR"
        elif isinstance(node, ast.Constant):
            node.value = "CONST"
    return ast.dump(tree, include_attributes=False)


def theory_urls(article: dict) -> list[str]:
    return list(dict.fromkeys(method["documentationUrl"] for method in article.get("methods", [])))


def build_unit(topic: dict, old: dict | None = None) -> dict:
    task_ids = [exercise["id"] for exercise in topic["exercises"]]
    calls = list(dict.fromkeys(call for exercise in topic["exercises"] for call in code_calls(exercise["solution_code"])))
    concepts = list(dict.fromkeys([topic.get("syntax", ""), *topic.get("methods", [])]))
    return {
        "id": f"ku-{topic['slug']}",
        "title": topic["title"],
        "topicId": str(topic["id"]),
        "sourceTitle": (old or {}).get("sourceTitle", "KODA Practice task bank"),
        "sourceVersion": (old or {}).get("sourceVersion", "2"),
        "concepts": [item for item in concepts if item],
        "methods": calls,
        "functions": [name for name in calls if name in {"read_csv", "merge", "to_datetime", "barplot", "subplots"}],
        "attributes": [name for name in ("shape", "index", "columns", "dtypes", "dt") if any(name in exercise["solution_code"] for exercise in topic["exercises"])],
        "operators": [operator for operator in ("+", "-", "*", "/", "==", ">", "<") if any(operator in exercise["solution_code"] for exercise in topic["exercises"])],
        "theoryArticleIds": [f"theory-{task_id}" for task_id in task_ids],
        "taskIds": task_ids,
        "createdAt": (old or {}).get("createdAt", CREATED_AT),
        "updatedAt": (old or {}).get("updatedAt", CREATED_AT),
    }


def sync() -> None:
    catalog = load_json(CATALOG_PATH)
    theory = load_json(THEORY_PATH)["articles"]
    previous = {unit["id"]: unit for unit in load_json(UNITS_PATH).get("units", [])} if UNITS_PATH.exists() else {}
    units = []
    for topic in topics(catalog):
        unit = build_unit(topic, previous.get(f"ku-{topic['slug']}"))
        units.append(unit)
        for exercise in topic["exercises"]:
            article = theory[f"theory-{exercise['id']}"]
            exercise["knowledge_unit_id"] = unit["id"]
            exercise["concepts"] = list(dict.fromkeys([exercise["focus"], *topic.get("methods", [])]))
            exercise["required_methods"] = code_calls(exercise["solution_code"])
            exercise["documentation_urls"] = theory_urls(article)
    write_json(CATALOG_PATH, catalog)
    write_json(UNITS_PATH, {"version": 1, "units": units})
    print(f"CONTENT SYNC PASSED: {len(units)} knowledge units and {len(exercises(catalog))} linked tasks")


def extract_source(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    dotted = re.findall(r"\b(?:pd|sns|plt|np)\.([A-Za-z_][A-Za-z0-9_]*)", text)
    methods = re.findall(r"\.([A-Za-z_][A-Za-z0-9_]*)\s*\(", text)
    params = re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*=", text)
    headings = [match.strip() for match in re.findall(r"^#{1,4}\s+(.+)$", text, flags=re.MULTILINE)]
    return {
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "headings": headings,
        "methodsAndFunctions": sorted(set(dotted + methods)),
        "parameters": sorted(set(params)),
        "lineCount": len(text.splitlines()),
    }


def inspect_source(source: Path, source_title: str | None) -> None:
    inventory = extract_source(source)
    catalog = load_json(CATALOG_PATH)
    covered = defaultdict(list)
    for exercise in exercises(catalog):
        for method in code_calls(exercise["solution_code"]):
            covered[method].append(exercise["id"])
    inventory["sourceTitle"] = source_title or source.stem
    inventory["coverage"] = {
        method: {"status": "covered" if covered[method] else "new", "taskIds": covered[method]}
        for method in inventory["methodsAndFunctions"]
    }
    REPORTS.mkdir(exist_ok=True)
    target = REPORTS / f"content-inspection-{source.stem}.json"
    write_json(target, inventory)
    print(f"CONTENT INSPECTION WRITTEN: {target.relative_to(ROOT)}")


def audit() -> None:
    catalog = load_json(CATALOG_PATH)
    theory = load_json(THEORY_PATH)["articles"]
    units = load_json(UNITS_PATH).get("units", []) if UNITS_PATH.exists() else []
    task_by_id = {exercise["id"]: exercise for exercise in exercises(catalog)}
    errors = []
    required_task_fields = {
        "knowledge_unit_id", "learning_objective", "concepts", "required_methods", "setup_code",
        "starter_code", "solution_code", "tests", "hints", "completion_summary",
        "theory_article_id", "documentation_urls",
    }
    if len(units) != len(topics(catalog)):
        errors.append(f"expected {len(topics(catalog))} knowledge units, got {len(units)}")
    unit_ids = [unit["id"] for unit in units]
    if len(unit_ids) != len(set(unit_ids)):
        errors.append("knowledge unit IDs are not unique")
    objectives = Counter(exercise["learning_objective"] for exercise in task_by_id.values())
    for objective, count in objectives.items():
        if count > 1:
            errors.append(f"duplicate learning objective ({count}): {objective}")
    for unit in units:
        for task_id in unit.get("taskIds", []):
            if task_id not in task_by_id:
                errors.append(f"{unit['id']}: missing task {task_id}")
            elif task_by_id[task_id].get("knowledge_unit_id") != unit["id"]:
                errors.append(f"{task_id}: incorrect knowledge unit link")
        for article_id in unit.get("theoryArticleIds", []):
            if article_id not in theory:
                errors.append(f"{unit['id']}: missing theory {article_id}")
    structural = defaultdict(list)
    for task in task_by_id.values():
        missing = sorted(required_task_fields - set(task))
        if missing:
            errors.append(f"{task['id']}: missing {missing}")
        if len(task.get("hints", [])) != 3:
            errors.append(f"{task['id']}: must have exactly three hints")
        if task.get("theory_article_id") not in theory:
            errors.append(f"{task['id']}: invalid theory link")
        if set(task.get("documentation_urls", [])) != set(theory_urls(theory.get(task.get("theory_article_id"), {}))):
            errors.append(f"{task['id']}: documentation links differ from theory")
        for url in task.get("documentation_urls", []):
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname not in ALLOWED_DOC_HOSTS or len(parsed.path.strip("/").split("/")) < 2:
                errors.append(f"{task['id']}: invalid documentation URL {url}")
        structural[normalized_solution(task["solution_code"])].append(task["id"])
    duplicate_candidates = [ids for ids in structural.values() if len(ids) > 1]
    if errors:
        print("\n".join(errors))
        raise SystemExit(f"CONTENT PIPELINE AUDIT FAILED: {len(errors)} errors")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "audit_task_bank.py")], cwd=ROOT, check=True)
    REPORTS.mkdir(exist_ok=True)
    write_json(REPORTS / "content-pipeline-audit.json", {
        "knowledgeUnits": len(units),
        "tasks": len(task_by_id),
        "theoryArticles": len(theory),
        "duplicateCandidatesReviewed": duplicate_candidates,
        "status": "passed",
    })
    print(f"CONTENT PIPELINE AUDIT PASSED: {len(units)} units, {len(task_by_id)} tasks, {len(theory)} theory articles")


def main() -> None:
    parser = argparse.ArgumentParser(description="KODA Practice Content Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("sync")
    subparsers.add_parser("audit")
    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--source", type=Path, required=True)
    inspect_parser.add_argument("--source-title")
    args = parser.parse_args()
    if args.command == "sync": sync()
    elif args.command == "audit": audit()
    else: inspect_source(args.source, args.source_title)


if __name__ == "__main__":
    main()
