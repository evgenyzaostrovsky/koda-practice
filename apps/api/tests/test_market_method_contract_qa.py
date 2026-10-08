"""Correct values must still exercise explicitly required learning methods."""
import pytest
import io
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.content import EXERCISES

CASES = [
    ('reading-009', 'read_csv', "result = pd.read_table(csv_path, sep=',', parse_dates=['order_date'])", "loaded = pd.read_csv(csv_path, parse_dates=['order_date'])\nresult = loaded"),
    ('market-groupby-report-002', 'agg', "grouped = orders.groupby('city')\nresult = pd.concat([grouped.order_id.count().rename('order_count'), grouped.revenue.sum().rename('total_revenue'), grouped.revenue.mean().rename('avg_revenue'), grouped.delivery_days.mean().rename('avg_delivery_days')], axis=1).sort_values('total_revenue', ascending=False)", "grouped = orders.groupby('city')\nsummary = grouped.agg(order_count=('order_id','count'),total_revenue=('revenue','sum'),avg_revenue=('revenue','mean'),avg_delivery_days=('delivery_days','mean'))\nresult = summary.sort_values('total_revenue', ascending=False)"),
    ('market-transform-001', 'transform', "totals = orders.groupby('city').revenue.sum()\nresult = orders.assign(city_revenue=orders.city.map(totals))", "totals = orders.groupby('city').revenue.transform(lambda values: values.sum())\nresult = orders.assign(city_revenue=totals)"),
]


@pytest.mark.parametrize('eid,method,wrong,right', CASES, ids=[case[0] for case in CASES])
def test_required_method_rejects_correct_output_shortcut_and_accepts_valid_alternative(eid, method, wrong, right):
    assert method in EXERCISES[eid]['required_tokens']
    with TestClient(app) as client:
        prefix = EXERCISES[eid]['setup_code'] + '\n'
        rejected = client.post('/attempts/submit', json={'exercise_id': eid, 'code': prefix + wrong}).json()
        assert rejected['ok'], rejected
        assert rejected['passed'] is False, rejected
        assert rejected['error_type'] == 'WrongMethod', rejected
        assert method in rejected['difference']
        accepted = client.post('/attempts/submit', json={'exercise_id': eid, 'code': prefix + right}).json()
        assert accepted['passed'] is True, accepted
        assert accepted['attempt_number'] == rejected['attempt_number'] + 1


def test_required_csv_read_cannot_be_spoofed_with_a_string_or_unused_call():
    eid = 'reading-009'
    with TestClient(app) as client:
        for code in ["result = pd.read_table(csv_path, sep=',', parse_dates=['order_date']) if 'read_csv' else None", "unused = pd.read_csv(csv_path, parse_dates=['order_date'])\nresult = pd.read_table(csv_path, sep=',', parse_dates=['order_date'])"]:
            response = client.post('/attempts/submit', json={'exercise_id': eid, 'code': EXERCISES[eid]['setup_code'] + '\n' + code}).json()
            assert response['ok'], response
            assert response['passed'] is False, response
            assert response['error_type'] == 'WrongMethod', response


def test_csv_loading_cannot_be_replaced_by_literal_correct_rows():
    eid = 'reading-009'
    expected = pd.read_csv(io.StringIO(EXERCISES[eid]['dataset']['files']['koda_market_orders.csv']), parse_dates=['order_date'])
    literal = repr(expected.to_dict(orient='list')).replace('Timestamp(', 'pd.Timestamp(').replace('nan', "float('nan')")
    with TestClient(app) as client:
        response = client.post('/attempts/submit', json={'exercise_id': eid, 'code': EXERCISES[eid]['setup_code'] + '\nresult = pd.DataFrame(' + literal + ')'}).json()
        assert response['ok'], response
        assert response['passed'] is False, response
        assert response['error_type'] == 'WrongMethod', response
