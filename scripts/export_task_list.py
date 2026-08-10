import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content" / "catalog.json"
OUTPUT_PATH = ROOT / "KODA_Practice_Задачи_по_темам.md"


def restore_text(value: str) -> str:
    """Repair UTF-8 text that was accidentally decoded as Windows-1251."""
    try:
        restored = value.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value
    return restored if restored.count("Р") + restored.count("С") < value.count("Р") + value.count("С") else value


def clean(value):
    if isinstance(value, str):
        return restore_text(value)
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    return value


catalog = clean(json.loads(CATALOG_PATH.read_text(encoding="utf-8")))
topics = [topic for module in catalog["modules"] for topic in module["topics"]]
task_count = sum(len(topic["exercises"]) for topic in topics)

lines = [
    "# KODA Practice — задачи по темам",
    "",
    f"Всего тем: **{len(topics)}**. Всего задач: **{task_count}**.",
    "",
    "Уровень сложности указан звёздами. Пометка «контрольная» соответствует полю `is_control` в каталоге.",
    "",
]

for number, topic in enumerate(topics, 1):
    lines.extend([
        f"## {number}. {topic['title']}",
        "",
        f"{topic['summary']}",
        "",
    ])
    for exercise in topic["exercises"]:
        difficulty = "★" * int(exercise["difficulty"])
        control = " · контрольная" if exercise.get("is_control") else ""
        lines.extend([
            f"### {exercise['id']} — {exercise['title']}",
            "",
            f"**Сложность:** {difficulty}{control}",
            "",
            exercise["instructions"],
            "",
        ])

OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
print(f"Экспортировано {task_count} задач по {len(topics)} темам: {OUTPUT_PATH}")
