"""Source coverage and new-mode integration checks independent of authoring."""
import json
from collections import Counter
from pathlib import Path

import pytest

from app.runner import compare_results, run

ROOT = Path(__file__).parents[3]
FIXTURES = Path(__file__).with_name('fixtures') / 'koda_market'
CATALOG = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))
TASKS = {task['id']: task for module in CATALOG['modules'] for topic in module['topics'] for task in topic['exercises']}
MODE_TASKS = [task for task in TASKS.values() if task.get('exercise_mode', 'python') != 'python']


def test_project_course_preserves_source_lesson_order_and_deduplicated_stable_links():
    course = json.loads((ROOT / 'apps/web/public/market-course.json').read_text(encoding='utf-8'))
    mapping = json.loads((ROOT / 'reports/market-authored-v2-map.json').read_text(encoding='utf-8'))['mapping']
    assert course['id'] == 'koda-market'
    assert [lesson['id'] for lesson in course['lessons']] == [f'market-{number}' for number in range(1, len(course['lessons']) + 1)]
    assert sum(len(lesson['taskIds']) for lesson in course['lessons']) == 115
    assert len(course['lessons'][0]['taskIds']) == 12
    assert [task_id for lesson in course['lessons'] for task_id in lesson['taskIds']] == [entry['task_id'] for entry in mapping]
    for lesson in course['lessons']:
        source_ids = [entry['task_id'] for entry in mapping if lesson['source_start'] <= entry['source_number'] <= lesson['source_end']]
        assert lesson['taskIds'] == source_ids
        assert all(task_id in TASKS for task_id in source_ids)
        assert all(TASKS[task_id].get('exercise_mode', 'python') == lesson['exercise_mode'] for task_id in source_ids)


def test_original_two_hundred_ids_and_bounded_knowledge_units_are_preserved():
    original_ids = set(json.loads((FIXTURES / 'stable_task_ids.json').read_text(encoding='utf-8')))
    assert len(original_ids) == 200
    assert original_ids <= TASKS.keys()
    units = json.loads((ROOT / 'content/knowledge_units.json').read_text(encoding='utf-8'))['units']
    assert all(len(unit['taskIds']) <= 10 and (unit['taskIds'] or unit.get('knowledge_only')) for unit in units)
    linked_ids = [task_id for unit in units for task_id in unit['taskIds']]
    assert Counter(linked_ids) == Counter(TASKS.keys())


def test_every_market_task_uses_exact_canonical_csv_values():
    fixtures = {p.name: p.read_text(encoding='utf-8-sig') for p in FIXTURES.glob('*.csv')}
    market_ids = {row['task_id'] for row in json.loads((ROOT / 'content/market_authored_v2.json').read_text(encoding='utf-8'))['tasks']}
    market_tasks = [TASKS[task_id] for task_id in market_ids]
    assert len(market_tasks) == 115
    for task in market_tasks:
        files = task['dataset']['files']
        assert 'koda_market_orders.csv' in files, task['id']
        assert files.keys() <= fixtures.keys(), task['id']
        for name, contents in files.items():
            assert contents == fixtures[name], (task['id'], name)
    for name in fixtures:
        assert (ROOT / 'content/datasets/koda-market' / name).read_bytes() == (FIXTURES / name).read_bytes()


def test_source_objectives_have_unambiguous_dispositions_including_twelve_groupby_scenarios():
    mapping = json.loads((ROOT / 'reports/market-authored-v2-map.json').read_text(encoding='utf-8'))['mapping']
    assert [entry['source_number'] for entry in mapping] == list(range(1, 116))
    assert len({entry['task_id'] for entry in mapping}) == 115
    for entry in mapping:
        assert entry['source_file'].endswith('.md')
        assert entry['source_revision'] == 'market-authored-v2'
        assert entry['task_id'] in TASKS
        assert entry['disposition'] in {'reuse', 'extend', 'add'}


@pytest.mark.parametrize('task', MODE_TASKS, ids=[task['id'] for task in MODE_TASKS])
def test_native_mode_reference_runs_and_untouched_starter_does_not_pass(task):
    dataset = {'files': task['dataset']['files']}
    expected = run(task['solution_code'], dataset, exercise_mode=task['exercise_mode'], validation_spec=task.get('validation_spec'))
    actual = run(task['starter_code'], dataset, exercise_mode=task['exercise_mode'], validation_spec=task.get('validation_spec'))
    assert expected['ok'], (task['id'], expected)
    assert not actual.get('ok') or not compare_results(actual, expected)[0], task['id']
