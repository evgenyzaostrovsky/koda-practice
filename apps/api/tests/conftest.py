"""Keep every API test away from developer and user progress databases."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))


@pytest.fixture(autouse=True)
def isolated_progress_database(tmp_path, monkeypatch):
    from app import db
    from app.services import practice
    monkeypatch.setenv('KODA_DB_PATH', str(tmp_path / 'progress.sqlite'))
    monkeypatch.setattr(db, 'DB', tmp_path / 'progress.sqlite')
    monkeypatch.setattr(practice, 'EXPECTED_RESULTS', {})
