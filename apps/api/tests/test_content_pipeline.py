import json
import sys
from pathlib import Path

ROOT=Path(__file__).parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
from content_pipeline import extract_source, normalized_solution


def test_existing_bank_is_fully_linked_to_stable_knowledge_units():
    catalog=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
    units=json.loads((ROOT/'content/knowledge_units.json').read_text(encoding='utf-8'))['units']
    tasks={exercise['id']:exercise for module in catalog['modules'] for topic in module['topics'] for exercise in topic['exercises']}
    assert len(units)==20
    assert len(tasks)==200
    assert {task_id for unit in units for task_id in unit['taskIds']}==set(tasks)
    assert all(tasks[task_id]['knowledge_unit_id']==unit['id'] for unit in units for task_id in unit['taskIds'])


def test_source_inspection_extracts_methods_and_is_content_stable(tmp_path):
    source=tmp_path/'sample.md'
    source.write_text('# GroupBy\nUse `df.groupby("city")["sales"].sum()` and `as_index=False`.',encoding='utf-8')
    inventory=extract_source(source)
    assert {'groupby','sum'} <= set(inventory['methodsAndFunctions'])
    assert 'as_index' in inventory['parameters']
    assert inventory['sha256']==extract_source(source)['sha256']


def test_duplicate_normalization_ignores_renamed_data_and_literals():
    left="result = orders.groupby('city')['sales'].sum()"
    right="answer = frame.groupby('region')['revenue'].sum()"
    assert normalized_solution(left)==normalized_solution(right)
