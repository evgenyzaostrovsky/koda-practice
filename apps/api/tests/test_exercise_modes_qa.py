"""Independent negative/equivalent mode tests against unchanged Market fixtures."""
import csv
import base64
import io
import json
import sqlite3
import struct
from pathlib import Path

import pytest

from app.exercise_modes import execute_mode
from app.runner import run, compare_results

FIXTURES = Path(__file__).with_name('fixtures') / 'koda_market'


@pytest.fixture
def market():
    return {'files': {p.name: p.read_text(encoding='utf-8-sig') for p in FIXTURES.glob('*.csv')}}


def test_canonical_values_are_financially_consistent(market):
    rows = list(csv.DictReader(io.StringIO(market['files']['koda_market_orders.csv'])))
    assert len(rows) == 30
    assert len(rows[0]) == 18
    assert sum(int(row['revenue']) for row in rows) == 385000
    assert all(int(row['quantity']) * int(row['price']) - int(row['discount']) == int(row['revenue']) for row in rows)


@pytest.mark.parametrize('query', [
    'DELETE FROM orders',
    'UPDATE orders SET revenue = 0',
    'CREATE TABLE other AS SELECT * FROM orders',
    "ATTACH DATABASE 'outside.sqlite' AS outside",
    'PRAGMA database_list',
    "SELECT load_extension('outside')",
    'SELECT 1; SELECT 2',
])
def test_sql_cannot_write_attach_inspect_or_load_extensions(market, query):
    with pytest.raises(sqlite3.Error):
        execute_mode(query, market, 'sql')
    assert execute_mode('SELECT COUNT(*) AS n FROM orders', market, 'sql').iloc[0, 0] == 30


def test_sql_recursive_budget_and_row_cap(market):
    with pytest.raises(sqlite3.Error, match='interrupted'):
        execute_mode('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n) SELECT SUM(x) FROM n', market, 'sql')
    with pytest.raises(ValueError, match='1000'):
        execute_mode('WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1001) SELECT x FROM n', market, 'sql')


@pytest.mark.parametrize('query', [
    'SELECT zeroblob(1048577)',
    'SELECT ' + ','.join('1' for _ in range(101)),
    'SELECT 1 /*' + 'x' * 50000 + '*/',
], ids=['cell-size', 'column-count', 'query-size'])
def test_sql_bounds_cell_columns_and_query_size(market, query):
    with pytest.raises(sqlite3.Error):
        execute_mode(query, market, 'sql')


def test_equivalent_sql_and_wrong_answer_use_result_validation(market):
    reference = run('SELECT city, SUM(revenue) AS revenue FROM orders GROUP BY city ORDER BY city', market, exercise_mode='sql')
    alternate = run('WITH totals AS (SELECT city, SUM(revenue) AS revenue FROM orders GROUP BY city) SELECT city, revenue FROM totals ORDER BY city', market, exercise_mode='sql')
    wrong = run('SELECT city, SUM(price) AS revenue FROM orders GROUP BY city ORDER BY city', market, exercise_mode='sql')
    assert reference['ok'], reference
    assert alternate['ok'], alternate
    assert compare_results(alternate, reference)[0]
    assert not compare_results(wrong, reference)[0]


@pytest.mark.parametrize('mode,reference,alternate', [
    ('excel', 'AVERAGE(orders[revenue])', '= SUM( orders[revenue] ) / COUNTA(orders[order_id])'),
    ('power-bi', 'AVERAGE(orders[revenue])', 'divide( SUM(orders[revenue]), COUNTROWS(orders) )'),
])
def test_equivalent_supported_formulas_and_wrong_values(market, mode, reference, alternate):
    spec = lambda formula: json.dumps({'operation': 'measure', 'measures': {'average': formula}})
    expected = run(spec(reference), market, exercise_mode=mode)
    actual = run(spec(alternate), market, exercise_mode=mode)
    wrong = run(spec('SUM(orders[revenue])'), market, exercise_mode=mode)
    assert expected['ok'], expected
    assert actual['ok'], actual
    assert compare_results(actual, expected)[0]
    assert not compare_results(wrong, expected)[0]


@pytest.mark.parametrize('mode', ['excel', 'power-bi'])
def test_formula_code_injection_is_rejected(market, mode):
    spec = {'operation': 'measure', 'measures': {'answer': "__import__('os').system('echo forbidden')"}}
    with pytest.raises(ValueError):
        execute_mode(json.dumps(spec), market, mode)


def test_unsupported_report_interaction_is_rejected(market):
    with pytest.raises(ValueError):
        execute_mode(json.dumps({'operation': 'interactions', 'selected_city': 'not-a-city', 'interaction': 'bogus'}), market, 'power-bi')


def test_import_requires_boolean_header_setting(market):
    with pytest.raises(ValueError):
        execute_mode(json.dumps({'operation': 'import', 'delimiter': ',', 'headers': 'false', 'table': 'orders', 'types': {}}), market, 'excel')


def test_import_rejects_lossy_boolean_coercion_of_status(market):
    with pytest.raises(ValueError):
        execute_mode(json.dumps({'operation': 'import', 'types': {'status': 'boolean'}}), market, 'power-bi')


def test_existing_python_still_executes_in_worker():
    result = run('result = df.groupby("city")["sales"].sum()', {'df': {'city': ['a', 'a', 'b'], 'sales': [1, 2, 4]}})
    assert result['ok'], result
    assert result['result']['data'] == [3, 4]


def test_wrong_bar_heights_fail_even_with_identical_labels_and_patch_count():
    expected = run('result = pd.Series([2, 3], index=["a", "b"]).plot(kind="bar", title="Sales", xlabel="City", ylabel="Revenue")', {})
    actual = run('result = pd.Series([4, 6], index=["a", "b"]).plot(kind="bar", title="Sales", xlabel="City", ylabel="Revenue")', {})
    assert expected['ok'], expected
    assert actual['ok'], actual
    assert actual['result']['patches'] == expected['result']['patches'] == 2
    assert [bar['height'] for bar in expected['result']['bar_values']] == [2, 3]
    assert [bar['height'] for bar in actual['result']['bar_values']] == [4, 6]
    assert not compare_results(actual, expected)[0]


def test_plot_png_is_bounded_and_mixed_insight_is_checked_independently_of_pixels():
    code = 'chart = pd.Series([2, 3], index=["a", "b"]).plot(kind="bar")\nresult = {"chart": chart, "best_category": "b", "means": {"a": 2, "b": 3}}'
    expected = run(code, {})
    wrong = run(code.replace('"best_category": "b"', '"best_category": "a"'), {})
    assert expected['ok'], expected
    assert wrong['ok'], wrong
    image = expected['result']['image']
    assert image.startswith('data:image/png;base64,')
    decoded = base64.b64decode(image.split(',', 1)[1], validate=True)
    assert decoded[:8] == b'\x89PNG\r\n\x1a\n'
    assert len(decoded) <= 2_000_000
    width, height = struct.unpack('>II', decoded[16:24])
    assert width <= 1200 and height <= 800
    assert not compare_results(wrong, expected)[0]
    different_pixels = {**expected, 'result': {**expected['result'], 'image': 'another rendering of the same semantic chart'}}
    assert compare_results(different_pixels, expected)[0]
