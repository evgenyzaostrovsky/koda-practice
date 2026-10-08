"""Scoped, archived content revisions. Never infer affected tasks from prefixes."""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

REVISION_MANIFEST = Path(__file__).parents[3] / 'content' / 'market_revision.json'


def load_content_revision():
    if not REVISION_MANIFEST.exists():
        return None
    value = json.loads(REVISION_MANIFEST.read_text(encoding='utf-8'))
    if not isinstance(value.get('revision'), str) or not value['revision']:
        raise ValueError('Content revision needs a stable name')
    ids = value.get('affected_task_ids')
    if not isinstance(ids, list) or not ids or not all(isinstance(task_id, str) and task_id for task_id in ids):
        raise ValueError('Content revision needs explicit affected task IDs')
    if len(ids) != len(set(ids)):
        raise ValueError('Content revision task IDs must be unique')
    return value


def rebuild_activity(connection):
    catalog = json.loads((REVISION_MANIFEST.parent / 'catalog.json').read_text(encoding='utf-8'))
    active_ids = {exercise['id'] for module in catalog['modules'] for topic in module['topics'] for exercise in topic['exercises']}
    attempts, solved = Counter(), Counter()
    for row in connection.execute('SELECT exercise_id,status,created_at FROM attempts'):
        if row['exercise_id'] not in active_ids:
            continue
        try:
            day = datetime.fromisoformat(row['created_at']).astimezone().date().isoformat()
        except (TypeError, ValueError):
            continue
        attempts[day] += 1
        solved[day] += row['status'] == 'passed'
    connection.execute('DELETE FROM activity')
    connection.executemany('INSERT INTO activity(day,attempts,solved) VALUES(?,?,?)',
                           [(day, count, solved[day]) for day, count in sorted(attempts.items())])


def apply_local_content_revision(connection):
    revision = load_content_revision()
    if not revision:
        return False
    # The marker, archive and deletes share the caller's transaction. IMMEDIATE
    # prevents two startups from both applying the same revision.
    if not connection.in_transaction:
        connection.execute('BEGIN IMMEDIATE')
    marker = 'content_revision:' + revision['revision']
    if connection.execute('SELECT 1 FROM metadata WHERE key=?', (marker,)).fetchone():
        return False
    connection.execute('CREATE TABLE IF NOT EXISTS content_revision_archive(revision TEXT PRIMARY KEY, applied_at TEXT NOT NULL, evidence TEXT NOT NULL)')
    ids = revision['affected_task_ids']
    placeholders = ','.join('?' for _ in ids)
    evidence = {table: [dict(row) for row in connection.execute(
        f'SELECT * FROM {table} WHERE exercise_id IN ({placeholders})', ids)]
        for table in ('attempts', 'hints', 'reviews')}
    stamp = datetime.now().astimezone().isoformat()
    connection.execute('INSERT INTO content_revision_archive(revision,applied_at,evidence) VALUES(?,?,?)',
                       (revision['revision'], stamp, json.dumps(evidence, ensure_ascii=False)))
    for table in ('attempts', 'hints', 'reviews'):
        connection.execute(f'DELETE FROM {table} WHERE exercise_id IN ({placeholders})', ids)
    rebuild_activity(connection)
    connection.execute('INSERT INTO metadata(key,value) VALUES(?,?)', (marker, stamp))
    return True


def cloud_task_id(task_id):
    revision = load_content_revision()
    if revision and task_id in revision['affected_task_ids']:
        return revision['revision'] + '::' + task_id
    return task_id


def public_cloud_task_id(storage_id):
    revision = load_content_revision()
    if not revision:
        return storage_id if '::' not in storage_id else None
    prefix = revision['revision'] + '::'
    if storage_id.startswith(prefix):
        public_id = storage_id[len(prefix):]
        return public_id if public_id in revision['affected_task_ids'] and public_id not in revision.get('retired_task_ids', []) else None
    if '::' in storage_id or storage_id in revision['affected_task_ids']:
        return None
    return storage_id
