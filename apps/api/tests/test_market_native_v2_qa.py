"""Native-subset calculations checked independently against canonical data."""
from pathlib import Path
import copy
import json

import pytest
import pandas as pd

from app.exercise_modes import formula, load_tables, calculate_report, interaction_evidence

FIXTURES = Path(__file__).with_name('fixtures') / 'koda_market'


@pytest.fixture
def tables():
    loaded = load_tables({'files': {path.name: path.read_text(encoding='utf-8-sig') for path in FIXTURES.glob('*.csv')}})
    # calculate_report performs this preparation before calling formula.
    loaded['orders']['order_date'] = pd.to_datetime(loaded['orders']['order_date'])
    return loaded


def test_dax_measure_dependencies_recalculate_in_city_context_and_clear(tables):
    orders = tables['orders']
    measures = {'Выручка': 'SUM(orders[revenue])', 'Количество заказов': 'DISTINCTCOUNT(orders[order_id])'}
    expression = 'DIVIDE([Выручка], [Количество заказов])'
    for city, revenue in [('Волгоград', 169000), ('Москва', 145100), ('Тула', 70900)]:
        context = orders.loc[orders.city == city]
        assert formula('[Выручка]', context, 'power-bi', measures, tables) == revenue
        assert formula(expression, context, 'power-bi', measures, tables) == pytest.approx(revenue / len(context))
    assert formula(expression, orders, 'power-bi', measures, tables) == pytest.approx(385000 / 30)


def test_dax_cancelled_count_respects_filter_context_and_missing_rating(tables):
    orders = tables['orders']
    measures = {'Выручка': 'SUM(orders[revenue])'}
    expression = 'CALCULATE(COUNTROWS(orders), orders[status] = "Отменён")'
    assert formula(expression, orders, 'power-bi', measures, tables) == 2
    assert formula(expression, orders.loc[orders.channel == 'Приложение'], 'power-bi', measures, tables) == 0
    assert formula('AVERAGE(orders[rating])', orders, 'power-bi', measures, tables) == round(orders.rating.dropna().mean(), 2)


def test_dax_previous_month_and_delta_preserve_city_context(tables):
    orders = tables['orders']
    measures = {'Выручка': 'SUM(orders[revenue])', 'Прошлый месяц': 'CALCULATE([Выручка], DATEADD(calendar[date], -1, MONTH))'}
    february = orders.loc[orders.order_date.dt.month == 2]
    assert formula('[Прошлый месяц]', february, 'power-bi', measures, tables) == 150400
    assert formula('[Выручка] - [Прошлый месяц]', february, 'power-bi', measures, tables) == 84200
    for city in orders.city.unique():
        context = february.loc[february.city == city]
        january_city = orders.loc[(orders.order_date.dt.month == 1) & (orders.city == city)]
        assert formula('[Прошлый месяц]', context, 'power-bi', measures, tables) == january_city.revenue.sum()


def test_dax_cycles_and_unknown_functions_are_rejected(tables):
    with pytest.raises(ValueError, match='циклическая'):
        formula('[a]', tables['orders'], 'power-bi', {'a': '[b]', 'b': '[a]'}, tables)
    with pytest.raises(ValueError):
        formula('__import__("os")', tables['orders'], 'power-bi', {}, tables)


def test_excel_source_formula_discount_and_quality_values(tables):
    orders = tables['orders']
    actual = formula('=[@quantity]*[@price]-[@discount]', orders, 'excel', tables=tables)
    assert actual.tolist() == orders.revenue.tolist()
    assert formula('=COUNTBLANK(orders[rating])', orders, 'excel', tables=tables) == 2
    assert formula('=COUNTIF(orders[revenue], "<0")', orders, 'excel', tables=tables) == 0
    assert formula('=COUNTIF(orders[status], "Отменён")', orders, 'excel', tables=tables) == 2


def native_spec(number):
    return json.loads((Path(__file__).parents[3] / 'content/market_native_v2.json').read_text(encoding='utf-8'))[str(number)]['solution_spec']


def dataset_files():
    return {'files': {path.name: path.read_text(encoding='utf-8-sig') for path in FIXTURES.glob('*.csv')}}


def test_report_multiselect_repeated_chart_click_and_clear_are_calculated(tables):
    spec = native_spec(110)
    spec['interaction_events'] = [
        {'type': 'select', 'field': 'city', 'value': 'Волгоград'},
        {'type': 'select', 'field': 'city', 'value': 'Волгоград'},
        {'type': 'filter', 'field': 'channel', 'values': ['Сайт', 'Приложение']},
        {'type': 'clear'},
    ]
    evidence, missing = interaction_evidence(json.dumps(spec), dataset_files(), {'selection_fields': ['city'], 'filter_fields': ['channel'], 'multiselect': True, 'clear': True})
    assert not missing
    assert [event['cards']['revenue'] for event in evidence] == [169000, 385000, 250000, 385000]
    assert [event['cards']['orders'] for event in evidence] == [9, 30, 23, 30]


def test_delivery_report_filters_change_all_cards_and_ignore_missing_ratings(tables):
    spec = native_spec(109)
    spec['filters'] = {'city': ['Москва'], 'category': ['Электроника']}
    report = calculate_report(json.dumps(spec), tables, 'power-bi')
    expected = tables['orders'].loc[(tables['orders'].city == 'Москва') & (tables['orders'].category == 'Электроника')]
    assert report['cards']['slow_delivery'] == int((expected.delivery_days > 3).sum())
    assert report['cards']['delivery_average'] == round(expected.delivery_days.mean(), 2)
    assert report['cards']['rating_average'] == round(expected.rating.dropna().mean(), 2)


def test_wrong_visual_interactions_do_not_magically_filter_cards(tables):
    spec = native_spec(110)
    spec['selection'] = {'field': 'city', 'value': 'Волгоград'}
    spec['interactions']['cards'] = 'none'
    wrong = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert wrong['cards']['revenue'] == 385000
    spec['interactions']['cards'] = 'filter'
    corrected = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert corrected['cards']['revenue'] == 169000


def test_checklist_claims_cannot_hide_wrong_measure_or_broken_bindings(tables):
    spec = native_spec(114)
    correct = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert all(check['status'] == 'пройдено' for check in correct['checks'])
    wrong = copy.deepcopy(spec)
    wrong['report']['measures']['revenue'] = 'SUM(orders[price])'
    bad = calculate_report(json.dumps(wrong), tables, 'power-bi')
    assert any(check['status'] != 'пройдено' for check in bad['checks'])


def test_calculate_overwrites_same_column_filter_but_preserves_other_filters(tables):
    # Microsoft CALCULATE contract: a normal Boolean filter overwrites an
    # existing filter on that column; KEEPFILTERS would instead intersect.
    spec = native_spec(104)
    spec['measures'] = {'cancelled': 'CALCULATE(COUNTROWS(orders), orders[status] = "Отменён")'}
    spec['formats'] = {'cancelled': 'number'}
    spec['filters'] = {'status': ['Оплачен']}
    result = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert result['cards']['cancelled'] == 2
    spec['filters']['channel'] = ['Магазин']
    result = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert result['cards']['cancelled'] == 1


def test_prepared_plot_result_is_rich_and_next_run_has_no_inherited_bars():
    from app.runner import run
    prepared = run('result = ax', {}, setup_code="import matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nax.bar(['old-a','old-b','old-c','old-d'], [1,2,3,4])")
    assert prepared['ok'], prepared
    assert prepared['result']['kind'] == 'plot', prepared
    assert prepared['result']['patches'] == 4
    next_run = run("result = pd.Series([2,3], index=['a','b']).plot(kind='bar')", {})
    assert next_run['ok'], next_run
    assert next_run['result']['kind'] == 'plot'
    assert next_run['result']['patches'] == 2


def test_free_memo_wording_accepts_correct_facts_without_copying_reference(tables):
    spec = native_spec(115)
    spec['statements'] = [
        {'metric': 'revenue_orders', 'text': 'За период получено 30 заказов на 385 000 рублей.'},
        {'metric': 'month_growth', 'text': 'Февральская выручка превышает январскую на 84 200 рублей.'},
        {'metric': 'top_city', 'text': 'По денежному результату впереди Волгоград: 169 000 рублей.'},
        {'metric': 'cancellation_channel', 'text': 'Магазин имеет максимальную долю отмен: 14,3 процента.'},
        {'metric': 'next_action', 'text': 'Нужно сопоставить причины отмен в каналах продаж.'},
    ]
    actual = calculate_report(json.dumps(spec), tables, 'power-bi')
    assert len(actual['statements']) == 5
    assert actual['statements'][0]['evidence'] == {'revenue': 385000, 'orders': 30}


def test_wrong_larger_numbers_containing_correct_digits_do_not_pass_memo(tables):
    spec = native_spec(115)
    spec['statements'][0]['text'] = 'Всего получено 130 заказов на 1385000 рублей.'
    with pytest.raises(ValueError):
        calculate_report(json.dumps(spec), tables, 'power-bi')
