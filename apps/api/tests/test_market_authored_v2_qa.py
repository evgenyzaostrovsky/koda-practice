"""Independent checks against the frozen Founder-authored source files."""
import hashlib
import json
import re
import sqlite3
import pytest
from pathlib import Path

ROOT = Path(__file__).parents[3]
SOURCES = ROOT / 'content/datasets/koda-market/authored-v2'


def load(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def test_authoritative_source_numbers_fields_and_hashes_are_exact():
    authored = load('content/market_authored_v2.json')
    rows = {row['source_number']: row for row in authored['tasks']}
    assert len(rows) == 115
    assert sorted(rows) == list(range(1, 116))
    assert len({row['task_id'] for row in rows.values()}) == 115
    observed = []
    for path in SOURCES.glob('*.md'):
        raw = path.read_bytes()
        assert authored['source_hashes'][path.name] == hashlib.sha256(raw).hexdigest()
        if path.name != 'KODA_Market_groupby_lesson.md' and not path.name.startswith('KODA_Market_completed_tasks_'):
            continue
        text = raw.decode('utf-8-sig')
        headings = list(re.finditer(r'^### (\d+)\. (.+)$', text, re.MULTILINE))
        for i, heading in enumerate(headings):
            number = int(heading[1])
            observed.append(number)
            row = rows[number]
            block = text[heading.end():headings[i + 1].start() if i + 1 < len(headings) else len(text)]
            block = re.split(r'^## ', block, maxsplit=1, flags=re.MULTILINE)[0].strip()
            assert row['source_file'] == path.name
            assert row['source_sha256'] == hashlib.sha256(raw).hexdigest()
            assert row['title'] == heading[2].strip()
            assert row['source_block'] == block
            for field, label in [('question', 'Задание'), ('analysis', 'Разбор'), ('source_validation', 'Проверка')]:
                match = re.search(r'\*\*' + label + r'\.\*\*\s*(.*?)(?=\n\s*\*\*|\Z)', block, re.S)
                assert match is not None, number
                assert row[field] == match[1].strip(), (number, field)
            assert len(row['hints']) == 3
            assert all(hint in block for hint in row['hints'])
    assert sorted(observed) == list(range(1, 116))


def test_authoritative_csv_is_identical_to_original_independent_fixture():
    fixtures = Path(__file__).with_name('fixtures') / 'koda_market'
    for path in fixtures.glob('*.csv'):
        assert (SOURCES / path.name).read_bytes() == path.read_bytes()


def test_revision_scope_is_explicit_and_retired_ids_do_not_reenter_new_mapping():
    revision = load('content/market_revision.json')
    rows = load('content/market_authored_v2.json')['tasks']
    current_ids = {row['task_id'] for row in rows}
    affected = revision['affected_task_ids']
    retired = set(revision['retired_task_ids'])
    assert len(affected) == len(set(affected))
    assert current_ids <= set(affected)
    assert not retired & current_ids
    assert revision['retirement_migration'] == dict.fromkeys(retired)
    restored = set(revision.get('restored_task_ids', []))
    assert restored == {'filtering-002'}
    assert restored.isdisjoint(current_ids | retired)
    assert set(affected) == current_ids | retired | restored
    assert [row['source_number'] for row in revision['source_mapping']] == list(range(1, 116))


def revision_database():
    connection = sqlite3.connect(':memory:')
    connection.row_factory = sqlite3.Row
    connection.executescript('''
        CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE attempts(id INTEGER PRIMARY KEY, exercise_id TEXT, code TEXT, status TEXT, created_at TEXT);
        CREATE TABLE hints(exercise_id TEXT,level INTEGER,opened_at TEXT);
        CREATE TABLE reviews(exercise_id TEXT,due_at TEXT);
        CREATE TABLE activity(day TEXT PRIMARY KEY,attempts INTEGER,solved INTEGER);
    ''')
    return connection


def test_local_revision_archives_only_affected_data_and_applies_once():
    from app.content_revision import apply_local_content_revision
    revision = load('content/market_revision.json')
    affected = revision['affected_task_ids'][0]
    catalog = load('content/catalog.json')
    active = {task['id'] for module in catalog['modules'] for topic in module['topics'] for task in topic['exercises']}
    untouched = sorted(active - set(revision['affected_task_ids']))[0]
    with revision_database() as connection:
        for task_id in (affected, untouched):
            connection.execute('INSERT INTO attempts(exercise_id,code,status,created_at) VALUES(?,?,?,?)',
                               (task_id, 'saved learner code', 'passed', '2026-10-08T10:00:00+03:00'))
            connection.execute('INSERT INTO hints VALUES(?,?,?)', (task_id, 2, '2026-10-08'))
            connection.execute('INSERT INTO reviews VALUES(?,?)', (task_id, '2026-10-10'))
        connection.commit()
        assert apply_local_content_revision(connection) is True
        connection.commit()
        for table in ('attempts', 'hints', 'reviews'):
            assert [row['exercise_id'] for row in connection.execute(f'SELECT * FROM {table}')] == [untouched]
        archive = json.loads(connection.execute('SELECT evidence FROM content_revision_archive').fetchone()[0])
        assert archive['attempts'][0]['code'] == 'saved learner code'
        assert all([row['exercise_id'] for row in archive[table]] == [affected] for table in archive)
        assert sum(row['attempts'] for row in connection.execute('SELECT * FROM activity')) == 1
        connection.execute('INSERT INTO attempts(exercise_id,code,status,created_at) VALUES(?,?,?,?)',
                           (affected, 'new revision solution', 'passed', '2026-10-08T10:01:00+03:00'))
        connection.commit()
        assert apply_local_content_revision(connection) is False
        assert connection.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] == 2
        assert connection.execute('SELECT COUNT(*) FROM content_revision_archive').fetchone()[0] == 1


def test_local_revision_failure_rolls_back_archive_deletes_and_marker():
    from app.content_revision import apply_local_content_revision
    affected = load('content/market_revision.json')['affected_task_ids'][0]
    connection = revision_database()
    connection.execute('INSERT INTO attempts(exercise_id,code,status,created_at) VALUES(?,?,?,?)',
                       (affected, 'original', 'passed', '2026-10-08T10:00:00+03:00'))
    connection.commit()
    try:
        with connection:
            assert apply_local_content_revision(connection)
            raise RuntimeError('simulated interrupted startup')
    except RuntimeError:
        pass
    assert connection.execute('SELECT code FROM attempts').fetchone()[0] == 'original'
    assert connection.execute('SELECT COUNT(*) FROM metadata').fetchone()[0] == 0
    assert apply_local_content_revision(connection)
    connection.close()


def test_cloud_revision_storage_prevents_old_and_retired_progress_resurrection():
    from app.content_revision import cloud_task_id, public_cloud_task_id
    revision = load('content/market_revision.json')
    active_ids = {row['task_id'] for row in load('content/market_authored_v2.json')['tasks']}
    for task_id in active_ids:
        storage_id = cloud_task_id(task_id)
        assert storage_id != task_id
        assert public_cloud_task_id(task_id) is None
        assert public_cloud_task_id(storage_id) == task_id
        assert public_cloud_task_id('old-revision::' + task_id) is None
    for task_id in revision['retired_task_ids']:
        assert public_cloud_task_id(task_id) is None
        assert public_cloud_task_id(cloud_task_id(task_id)) is None
    assert cloud_task_id('reading-001') == 'reading-001'
    assert public_cloud_task_id('reading-001') == 'reading-001'


def test_new_device_cloud_progress_ignores_archived_rows_and_uses_current_activity(monkeypatch):
    from app.content_revision import cloud_task_id
    from app.services import progress
    affected = 'reading-009'
    unaffected = 'reading-001'
    rows = [
        {'task_id': affected, 'status': 'completed', 'hints_opened': 3},
        {'task_id': 'old-revision::' + affected, 'status': 'completed', 'hints_opened': 3},
        {'task_id': cloud_task_id(affected), 'status': 'in_progress', 'hints_opened': 1},
        {'task_id': unaffected, 'status': 'completed', 'hints_opened': 0},
    ]
    attempts = [{'task_id': row['task_id'], 'passed': True, 'created_at': '2026-10-08T10:00:00Z'} for row in rows]
    monkeypatch.setattr(progress, 'rest', lambda account, path, *args, **kwargs: rows if path == 'task_progress' else attempts)
    result = progress.get_progress({'id': 'isolated-new-device-user'})
    assert result['solved_ids'] == [unaffected]
    assert result['attempts'] == 2
    assert result['hints_used'] == 1
    assert result['xp'] == progress.EXERCISES[unaffected]['xp']


def test_empty_knowledge_only_module_does_not_break_local_progress():
    from app import db
    from app.services import progress
    db.init_db()
    result = progress.get_progress(None)
    empty = [module for module in result['modules'] if module['total'] == 0]
    assert empty, 'Retired tasks keep their teaching module accessible.'
    assert all(module['mastery'] == 0 and module['solved'] == 0 for module in empty)


def test_browser_revision_bundle_and_public_manifest_match_authoritative_scope():
    revision = load('content/market_revision.json')
    public = load('apps/web/public/market_revision.json')
    bundled = load('apps/web/src/content-revision-manifest.json')
    for key in ('revision', 'affected_task_ids', 'retired_task_ids'):
        assert revision[key] == public[key] == bundled[key]
    active_ids = {task['id'] for module in load('content/catalog.json')['modules'] for topic in module['topics'] for task in topic['exercises']}
    assert set(bundled['active_task_ids']) == active_ids


@pytest.mark.parametrize('source_row', load('content/market_authored_v2.json')['tasks'], ids=lambda row: f"source-{row['source_number']:03}-{row['task_id']}")
def test_all_authoritative_references_execute_and_untouched_starters_fail(source_row):
    from app.content import EXERCISES
    from app.runner import compare_results, run
    task = EXERCISES[source_row['task_id']]
    mode = task.get('exercise_mode', 'python')
    contract = task.get('validation_spec', {})
    expected = run(task['solution_code'], task['dataset'], setup_code=task['setup_code'], exercise_mode=mode, validation_spec=contract)
    starter = run(task['starter_code'], {'files': task['dataset'].get('files', {})}, exercise_mode=mode, validation_spec=contract)
    assert expected.get('ok'), (source_row['source_number'], expected)
    assert not expected.get('mutated_inputs'), source_row['source_number']
    assert not starter.get('ok') or not compare_results(starter, expected, contract)[0], source_row['source_number']
