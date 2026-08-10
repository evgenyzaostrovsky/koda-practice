import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB=Path(os.environ.get('KODA_DB_PATH',Path(__file__).parents[1]/'koda.db'))
def connect():
    DB.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c
def init_db():
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, exercise_id TEXT, code TEXT, status TEXT, tests_passed INTEGER, tests_total INTEGER, error_type TEXT, execution_ms INTEGER, attempt_number INTEGER, hints_used INTEGER, created_at TEXT);
        CREATE TABLE IF NOT EXISTS hints(exercise_id TEXT, level INTEGER, opened_at TEXT, PRIMARY KEY(exercise_id,level));
        CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, exercise_id TEXT UNIQUE, interval_days INTEGER, due_at TEXT, completed_at TEXT, result TEXT);
        CREATE TABLE IF NOT EXISTS activity(day TEXT PRIMARY KEY, attempts INTEGER DEFAULT 0, solved INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        version=c.execute("SELECT value FROM metadata WHERE key='content_bank_version'").fetchone()
        if version is None:
            # Preserve attempts from the original 60-task bank without applying
            # them to the new tasks that intentionally reuse stable public IDs.
            c.execute("UPDATE attempts SET exercise_id='v1:' || exercise_id WHERE exercise_id NOT LIKE 'v1:%'")
            c.execute("UPDATE hints SET exercise_id='v1:' || exercise_id WHERE exercise_id NOT LIKE 'v1:%'")
            c.execute("UPDATE reviews SET exercise_id='v1:' || exercise_id WHERE exercise_id NOT LIKE 'v1:%'")
            c.execute("INSERT INTO metadata(key,value) VALUES('content_bank_version','2')")
def now(): return datetime.now(timezone.utc).isoformat()
