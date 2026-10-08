"""Allowlisted educational spreadsheet/report calculations and read-only SQL.

Called only inside the existing execution subprocess, never for free practice.
No Python expression evaluation, filesystem SQL or external connections.
"""
import io
import json
import re
import sqlite3

import pandas as pd


def load_tables(dataset):
    return {name.removeprefix('koda_market_').removesuffix('.csv'): pd.read_csv(io.StringIO(text))
            for name, text in dataset.get('files', {}).items() if name.endswith('.csv')}


def sql_result(code, tables):
    connection = sqlite3.connect(':memory:')
    try:
        connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 1_048_576)
        connection.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 50_000)
        connection.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 100)
        for name, frame in tables.items():
            frame.to_sql(name, connection, index=False)
        connection.execute('PRAGMA query_only = ON')
        steps = [0]
        def limit():
            steps[0] += 1
            return int(steps[0] > 10000)
        connection.set_progress_handler(limit, 100)
        allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
        def authorize(action, first, second, database, source):
            if action == sqlite3.SQLITE_FUNCTION and (second or first or '').lower() in {'randomblob','zeroblob','printf','format','load_extension'}:
                return sqlite3.SQLITE_DENY
            return sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY
        connection.set_authorizer(authorize)
        cursor = connection.execute(code)
        if cursor.description is None:
            raise ValueError('Используйте один запрос SELECT или WITH … SELECT.')
        rows = cursor.fetchmany(1001)
        if len(rows) > 1000:
            raise ValueError('Учебный запрос возвращает больше 1000 строк.')
        return pd.DataFrame(rows, columns=[col[0] for col in cursor.description])
    finally:
        connection.close()


def formula(text, frame, mode):
    """Native, deliberately small syntax subset; equivalent whitespace/case accepted."""
    value = re.sub(r'\s+', '', str(text)).upper().lstrip('=')
    if mode == 'excel':
        if value in {'[@QUANTITY]*[@PRICE]-[@DISCOUNT]', '([@QUANTITY]*[@PRICE])-[@DISCOUNT]'}:
            return frame.quantity * frame.price - frame.discount
        if value == 'SUM(ORDERS[REVENUE])': return float(frame.revenue.sum())
        if value in {'COUNTA(ORDERS[ORDER_ID])', 'COUNT(ORDERS[ORDER_ID])'}: return int(len(frame))
        if value in {'AVERAGE(ORDERS[REVENUE])', 'SUM(ORDERS[REVENUE])/COUNTA(ORDERS[ORDER_ID])', 'SUM(ORDERS[REVENUE])/COUNT(ORDERS[ORDER_ID])'}:
            return round(float(frame.revenue.mean()), 2)
    else:
        if value == 'SUM(ORDERS[REVENUE])': return float(frame.revenue.sum())
        if value in {'COUNTROWS(ORDERS)', 'COUNT(ORDERS[ORDER_ID])'}: return int(len(frame))
        if value in {'DIVIDE(SUM(ORDERS[REVENUE]),COUNTROWS(ORDERS))', 'AVERAGE(ORDERS[REVENUE])'}:
            return round(float(frame.revenue.mean()), 2)
    raise ValueError('Формула не входит в поддерживаемый учебный набор. Сверьтесь с описанием и подсказкой.')


def calculate_report(code, tables, mode):
    spec = json.loads(code)
    if not isinstance(spec, dict): raise ValueError('Настройки отчёта должны быть объектом.')
    if len(spec) > 20 or any(isinstance(value, (list, dict)) and len(value) > 30 for value in spec.values()):
        raise ValueError('Слишком много настроек учебного отчёта.')
    op = spec.get('operation')
    frame = tables['orders'].copy()
    frame['order_date'] = pd.to_datetime(frame.order_date)
    filters = spec.get('filters', {})
    if not isinstance(filters, dict): raise ValueError('Фильтры должны быть объектом.')
    for key, value in filters.items():
        if key not in {'channel', 'city', 'status'}: raise ValueError('Неизвестный фильтр.')
        frame = frame.loc[frame[key] == value]
    if frame.empty: raise ValueError('Фильтр не оставил заказов.')
    payload = {}
    if op == 'import':
        types = spec.get('types', {})
        if not isinstance(types, dict): raise ValueError('Типы должны быть объектом.')
        if mode == 'excel':
            if spec.get('delimiter') != ',' or spec.get('headers') is not True or spec.get('table') != 'orders':
                raise ValueError('Выберите запятую, строку заголовков и таблицу orders.')
        for col, dtype in types.items():
            if col not in frame or dtype not in {'date', 'number', 'text', 'boolean'}: raise ValueError('Неизвестный тип колонки.')
            if dtype == 'date': frame[col] = pd.to_datetime(frame[col])
            elif dtype == 'number': frame[col] = pd.to_numeric(frame[col])
            elif dtype == 'text': frame[col] = frame[col].astype(str)
            elif dtype == 'boolean':
                normalized = frame[col].astype(str).str.lower()
                if not normalized.isin(['true','false','0','1']).all(): raise ValueError('Поле содержит значения, которые не являются булевыми.')
                frame[col] = normalized.isin(['true','1'])
        payload = {'rows': len(frame), 'columns': len(frame.columns), 'types': types}
        if mode == 'excel': payload['table'] = spec['table']
    elif op in {'pivot', 'bar', 'status'}:
        keys = spec.get('group_by', [])
        if not isinstance(keys,list) or not keys or len(keys)!=len(set(keys)) or not all(k in {'city', 'category', 'channel', 'status'} for k in keys): raise ValueError('Укажите измерения отчёта.')
        measure = spec.get('measure', 'SUM(orders[revenue])')
        values = []
        for key, group in frame.groupby(keys, sort=True):
            labels = list(key) if isinstance(key, tuple) else [key]
            values.append(dict(zip(keys, labels)) | {'value': formula(measure, group, mode)})
        payload = {'group_by': keys, 'values': values}
        if op != 'pivot': payload['visual'] = spec.get('visual')
    elif op == 'formula':
        calculated = formula(spec.get('formula'), frame, mode)
        if not isinstance(calculated, pd.Series): raise ValueError('Нужна формула каждой строки.')
        payload = {'calculated': calculated.tolist(), 'difference': (calculated-frame.revenue).tolist()}
    elif op == 'format':
        if spec.get('column') != 'status' or spec.get('equals') not in frame.status.unique(): raise ValueError('Укажите статус для форматирования.')
        payload = {'highlighted_orders': frame.loc[frame.status == spec['equals'], 'order_id'].tolist(), 'style': spec.get('style')}
    elif op in {'kpis', 'cards', 'measure'}:
        measures = spec.get('measures', {})
        if not isinstance(measures,dict) or not measures: raise ValueError('Добавьте показатель.')
        payload = {name: formula(expression, frame, mode) for name, expression in measures.items()}
    elif op in {'filter', 'slicer'}:
        payload = {'filters': filters, 'order_ids': frame.order_id.tolist(), 'revenue': float(frame.revenue.sum())}
    elif op == 'quality':
        columns = spec.get('columns', [])
        if not columns or not all(col in frame for col in columns): raise ValueError('Выберите поля для проверки качества.')
        payload = {'missing': frame[columns].isna().sum().to_dict(), 'duplicate_orders': int(frame.order_id.duplicated().sum())}
    elif op in {'chart', 'line'}:
        if spec.get('date_field') != 'order_date' or spec.get('period') not in {'day', 'month'}: raise ValueError('Укажите дату и период.')
        labels = frame.order_date.dt.strftime('%Y-%m' if spec['period'] == 'month' else '%Y-%m-%d')
        values = []
        for label, group in frame.groupby(labels, sort=True):
            values.append({'period': label, 'value': formula(spec.get('measure'), group, mode)})
        payload = {'visual': spec.get('visual'), 'values': values}
    elif op == 'delivery':
        group_by = spec.get('group_by')
        if group_by not in {'city', 'channel'}: raise ValueError('Выберите город или канал.')
        payload = {'visual': spec.get('visual'), 'values': frame.groupby(group_by).agg(delivery_days=('delivery_days','mean'), rating=('rating','mean')).round(2).reset_index().to_dict('records')}
    elif op == 'interactions':
        selected = spec.get('selected_city')
        if selected not in frame.city.unique() or spec.get('interaction') not in {'filter','none'}:
            raise ValueError('Выберите существующий город и поддерживаемое взаимодействие.')
        narrowed = frame.loc[frame.city == selected] if spec.get('interaction') == 'filter' else frame
        payload = {'interaction': spec.get('interaction'), 'selected_city': selected,
                   'channel_revenue': narrowed.groupby('channel').revenue.sum().to_dict()}
    elif op in {'insight', 'insights'}:
        claims = spec.get('claims', [])
        computed = {'top_city': frame.groupby('city').revenue.sum().idxmax(),
                    'cancelled_orders': int((frame.status == 'Отменён').sum()),
                    'revenue': int(frame.revenue.sum()),
                    'top_channel': frame.groupby('channel').revenue.sum().idxmax()}
        payload = {}
        for claim in claims:
            metric, value = claim.get('metric'), claim.get('value')
            if metric not in computed or value != computed[metric]: raise ValueError('Вывод не подтверждается расчётом.')
            payload[metric] = computed[metric]
        if not payload: raise ValueError('Добавьте вывод, подтверждённый числом или категорией.')
    else: raise ValueError('Выберите поддерживаемую операцию отчёта.')
    return payload


def execute_mode(code, dataset, mode):
    tables = load_tables(dataset)
    if mode == 'sql': return sql_result(code, tables)
    if mode in {'excel', 'power-bi'}: return calculate_report(code, tables, mode)
    raise ValueError('Неизвестный режим упражнения.')
