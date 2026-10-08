"""Learner-facing acceptance through the actual submit service, isolated progress."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import db
from app.content import EXERCISES
from app.services.practice import submit_attempt

SOURCE = json.loads((Path(__file__).parents[3] / 'content/market_authored_v2.json').read_text(encoding='utf-8'))
IDS = {row['source_number']: row['task_id'] for row in SOURCE['tasks']}


def submit(number, answer):
    task = EXERCISES[IDS[number]]
    db.init_db()
    code = task['setup_code'] + '\n' + answer if task.get('exercise_mode', 'python') == 'python' else answer
    return submit_attempt(SimpleNamespace(exercise_id=task['id'], code=code), None)


@pytest.mark.parametrize('number,wrong', [
    (13, "result = pd.read_csv(csv_path)"),
    (19, 'result = orders[orders.revenue > 25000]'),
    (29, 'result = orders.assign(is_large_order=orders.revenue > 15000)'),
    (30, "result = orders.assign(order_size=pd.cut(orders.revenue, bins=[-float('inf'),7000,15000,float('inf')], right=True, labels=['Небольшой','Средний','Крупный']))"),
    (32, 'result = orders.assign(is_slow_delivery=orders.delivery_days >= 3)'),
])
def test_genuine_wrong_source_boundaries_or_types_are_rejected(number, wrong):
    result = submit(number, wrong)
    assert result['ok'], result
    assert result['passed'] is False, number


def test_source_explicitly_allowed_conditions_alternative_to_cut_is_accepted():
    answer = "result = orders.assign(order_size=orders.revenue.apply(lambda value: 'Небольшой' if value < 7000 else 'Средний' if value < 15000 else 'Крупный'))"
    result = submit(30, answer)
    assert result['ok'], result
    assert result['passed'], result


def test_input_mutation_is_rejected_even_when_final_values_match():
    result = submit(29, "orders['is_large_order'] = orders.revenue >= 15000\nresult = orders.copy()")
    assert result['ok'], result
    assert result['passed'] is False
    assert 'orders' in result['mutated_inputs']


@pytest.mark.parametrize('number,answer', [
    (23, "result = orders.sort_values(['revenue','order_id'], ascending=[False,False]).head(5)"),
    (24, "result = orders.sort_values(['delivery_days','order_id'], ascending=[False,False])"),
    (25, "result = orders.sort_values(['city','revenue','order_id'], ascending=[True,False,False])"),
    (26, "result = orders.sort_values(['city','revenue','order_id'], ascending=[True,True,False]).drop_duplicates('city')"),
])
def test_valid_alternative_tie_order_and_minimum_selection_are_accepted(number, answer):
    result = submit(number, answer)
    assert result['ok'], result
    assert result['passed'], (number, result)


@pytest.mark.parametrize('number,answer', [
    (43, 'result = orders.iloc[:0]'),
    (44, 'result = orders.iloc[:0]'),
    (60, "result = orders.merge(customers[['customer_id']],on='customer_id',how='left',indicator=True).iloc[:0]"),
    (66, 'result = orders.iloc[:0]'),
])
def test_hardcoded_empty_answer_fails_prepared_edge_case_validation(number, answer):
    result = submit(number, answer)
    assert result['ok'], result
    assert result['passed'] is False, (number, result)


@pytest.mark.parametrize('number,field,replacement', [
    (95, 'calculated_columns.check', 'IF([@revenue]=[@revenue],"ОК","ОК")'),
    (97, 'measures.revenue', '385000'),
    (104, 'measures.revenue', '385000'),
    (107, 'measures.orders', 'COUNTROWS(orders)'),
    (108, 'measures.previous_revenue', 'IF(SUM(orders[revenue])=234600,150400,0)'),
    (109, 'measures.slow_delivery', 'IF(COUNTROWS(orders)=30,8,IF(COUNTROWS(orders)=9,1,IF(COUNTROWS(orders)=8,7,0)))'),
    (111, 'measures.cancelled', 'IF([orders]=30,2,IF(SUM(orders[revenue])=145100,0,IF([orders]=10,0,1)))'),
])
def test_native_coincidental_canonical_answers_do_not_earn_credit(number, field, replacement):
    from app.exercise_modes import execute_mode
    from app.runner import compare_results
    task = EXERCISES[IDS[number]]
    spec = json.loads(task['solution_code'])
    parent, key = field.split('.')
    spec[parent][key] = replacement
    code = json.dumps(spec)
    expected = execute_mode(task['solution_code'], task['dataset'], task['exercise_mode'])
    actual = execute_mode(code, task['dataset'], task['exercise_mode'])
    # These shortcuts genuinely look correct on the canonical bank; the
    # prepared variants/context checks must distinguish their faulty logic.
    assert compare_results({'result': {'kind': 'scalar', 'data': actual}}, {'result': {'kind': 'scalar', 'data': expected}})[0], (number, actual, expected)
    result = submit(number, code)
    assert result['ok'], result
    assert result['passed'] is False, (number, result)
