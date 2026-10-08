"""Execute standalone lesson examples against their authored expected output."""
import contextlib
import io
import json
import sqlite3
from pathlib import Path

import pytest
import matplotlib

matplotlib.use('Agg', force=True)

ROOT = Path(__file__).parents[3]
TEACHING = {key: value for path in ROOT.glob('content/market_teaching_*.json') for key, value in json.loads(path.read_text(encoding='utf-8')).items()}
EXAMPLES = [(key, section['id'], index, example) for key, unit in TEACHING.items() for section in unit['article']['sections'] for index, example in enumerate(section.get('examples', [])) if example['code'].startswith(('import ', 'from ')) or key == 'market-sql']


@pytest.mark.parametrize('key,section,index,example', EXAMPLES, ids=[f'{key}-{section}-{index}' for key, section, index, _ in EXAMPLES])
def test_authored_python_and_sql_examples_match_stated_results(key, section, index, example):
    if key == 'market-sql':
        with sqlite3.connect(':memory:') as connection:
            cursor = connection.execute(example['code'])
            output = ' | '.join(field[0] for field in cursor.description) + '\n' + '\n'.join(' | '.join('NULL' if value is None else str(value) for value in row) for row in cursor.fetchall())
    else:
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            exec(compile(example['code'], f'{key}/{section}/{index}', 'exec'), {})
        output = stream.getvalue().strip()
        import matplotlib.pyplot as plt
        plt.close('all')
    assert output == example['result'].strip()


@pytest.mark.parametrize('key,unit', TEACHING.items())
def test_every_compact_technique_is_taught_and_errors_include_reason_and_correction(key, unit):
    sections = unit['article']['sections']
    assert {entry['id'] for entry in unit['cheatSheet']['entries']} <= {entry for section in sections for entry in section.get('covers', [])}
    errors = [error for section in sections for error in section.get('errors', [])]
    assert errors
    assert all(all(error.get(field, '').strip() for field in ['wrongCode', 'why', 'correctCode']) for error in errors)
