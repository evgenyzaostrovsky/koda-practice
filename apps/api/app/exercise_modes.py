"""Allowlisted educational spreadsheet/report calculations and read-only SQL.

Called only inside the existing execution subprocess, never for free practice.
No Python expression evaluation, filesystem SQL or external connections.
"""
import io
import json
import re
import sqlite3
import operator
import itertools
import numbers

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


def legacy_formula(text, frame, mode):
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


class FormulaParser:
    """Parse the documented spreadsheet/DAX subset; never evaluate Python."""
    TOKEN = re.compile(r'\s*(?:((?:\[@[^\]]+\]|[\w]+\[[^\]]+\]|\[[^\]]+\]))|("(?:[^"\\]|\\.)*")|(\d+(?:\.\d+)?)|([\w]+)|([<>]=|<>|!=|==|[=<>+*/(),;\-]))', re.UNICODE)
    PRECEDENCE = {'=': 1, '==': 1, '<>': 1, '!=': 1, '>': 1, '<': 1, '>=': 1, '<=': 1, '+': 2, '-': 2, '*': 3, '/': 3}

    def __init__(self, text):
        text = str(text).strip().lstrip('=')
        if not text or len(text) > 2000: raise ValueError('Введите поддерживаемую формулу до 2000 символов.')
        self.tokens = []; offset = 0
        while offset < len(text):
            match = self.TOKEN.match(text, offset)
            if not match:
                if not text[offset:].strip(): break
                raise ValueError('Формула содержит неподдерживаемый синтаксис.')
            self.tokens.append(next((value for value in match.groups() if value is not None)))
            offset = match.end()
        if len(self.tokens) > 250: raise ValueError('Формула слишком сложная.')
        self.pos = 0

    def take(self):
        if self.pos >= len(self.tokens): raise ValueError('Формула не завершена.')
        token = self.tokens[self.pos]; self.pos += 1; return token

    def parse(self, depth=0, minimum=0):
        if depth > 25: raise ValueError('Слишком много вложенных формул.')
        token = self.take()
        if token == '(':
            node = self.parse(depth + 1)
            if self.take() != ')': raise ValueError('Проверьте скобки формулы.')
        elif token == '-': node = ('binary', '*', ('literal', -1), self.parse(depth + 1, 4))
        elif token.startswith('"'): node = ('literal', json.loads(token))
        elif re.fullmatch(r'\d+(?:\.\d+)?', token): node = ('literal', float(token) if '.' in token else int(token))
        elif '[' in token: node = ('ref', token)
        elif self.pos < len(self.tokens) and self.tokens[self.pos] == '(':
            self.pos += 1; args = []
            if self.pos < len(self.tokens) and self.tokens[self.pos] != ')':
                while True:
                    args.append(self.parse(depth + 1))
                    if self.pos >= len(self.tokens) or self.tokens[self.pos] not in {',', ';'}: break
                    self.pos += 1
            if self.take() != ')': raise ValueError('Проверьте аргументы формулы.')
            node = ('call', token.upper(), args)
        elif token.upper() in {'TRUE', 'FALSE', 'MONTH', 'DAY', 'YEAR'}:
            node = ('literal', {'TRUE': True, 'FALSE': False}.get(token.upper(), token.upper()))
        else: node = ('table', token.lower())
        while self.pos < len(self.tokens):
            op = self.tokens[self.pos]; precedence = self.PRECEDENCE.get(op, -1)
            if precedence < minimum: break
            self.pos += 1
            node = ('binary', op, node, self.parse(depth + 1, precedence + 1))
        return node

    def complete(self):
        node = self.parse()
        if self.pos != len(self.tokens): raise ValueError('Лишние символы в формуле.')
        return node


def context_selectors(context, source):
    if 'filter_context' in context.attrs: return dict(context.attrs['filter_context'])
    periods = context.order_date.dt.to_period('M').astype(str)
    current = source.loc[source.order_date.dt.to_period('M').astype(str).isin(periods)]
    fields = ('city', 'channel', 'category', 'status')
    for size in range(5):
        for combination in itertools.combinations(fields, size):
            candidate = current
            for field in combination: candidate = candidate.loc[candidate[field].isin(context[field].unique())]
            if set(candidate.index) == set(context.index): return {field: context[field].unique().tolist() for field in combination}
    raise ValueError('Укажите явный контекст фильтра для временной меры.')


def formula(text, frame, mode, measures=None, tables=None, stack=()):
    tables = tables or {'orders': frame}; measures = measures or {}
    names = {name.lower(): expression for name, expression in measures.items()}
    aliases = {'СУММ': 'SUM', 'СЧЁТ': 'COUNT', 'СЧЕТ': 'COUNT', 'СЧЁТЗ': 'COUNTA', 'СЧЕТЗ': 'COUNTA',
               'СРЗНАЧ': 'AVERAGE', 'ЕСЛИ': 'IF', 'ЕСЛИОШИБКА': 'IFERROR', 'СЧЁТЕСЛИ': 'COUNTIF',
               'СЧЕТЕСЛИ': 'COUNTIF', 'СУММЕСЛИ': 'SUMIF', 'СЧЁТПУСТОТ': 'COUNTBLANK', 'СЧЕТПУСТОТ': 'COUNTBLANK'}
    binary = {'+': operator.add, '-': operator.sub, '*': operator.mul, '/': operator.truediv,
              '=': operator.eq, '==': operator.eq, '<>': operator.ne, '!=': operator.ne,
              '>': operator.gt, '<': operator.lt, '>=': operator.ge, '<=': operator.le}

    def criterion(values, wanted):
        if isinstance(wanted, str):
            match = re.match(r'^(<=|>=|<>|=|<|>)(.*)$', wanted)
            if match:
                op, operand = match.groups()
                try: operand = float(operand)
                except ValueError: pass
                return binary[op](values, operand).fillna(False)
        return values.eq(wanted).fillna(False)

    def evaluate(node, context):
        kind = node[0]
        if kind == 'literal': return node[1]
        if kind == 'table':
            if node[1] not in tables: raise ValueError('Неизвестная таблица формулы.')
            return context if node[1] == 'orders' else tables[node[1]]
        if kind == 'ref':
            ref = node[1]
            if ref.startswith('[@'):
                column = ref[2:-1].lower()
                if column not in context: raise ValueError('Неизвестная колонка формулы.')
                return context[column]
            if ref.startswith('['):
                name = ref[1:-1].lower()
                if name not in names or name in stack or len(stack) > 20: raise ValueError('Неизвестная или циклическая мера.')
                return formula(names[name], context, mode, measures, tables, stack + (name,))
            table, column = ref.split('[', 1); table = table.lower(); column = column[:-1].lower()
            if table == 'calendar' and column == 'date': return context.order_date
            target = context if table == 'orders' else tables.get(table)
            if target is None or column not in target: raise ValueError('Неизвестное поле формулы.')
            return target[column]
        if kind == 'binary': return binary[node[1]](evaluate(node[2], context), evaluate(node[3], context))
        name = aliases.get(node[1], node[1]); args = node[2]
        if name == 'CALCULATE':
            if mode != 'power-bi' or len(args) < 2: raise ValueError('CALCULATE требует меру и фильтр.')
            narrowed = context
            for argument in args[1:]:
                if argument[0] == 'binary' and argument[1] in {'=', '==', '!=', '<>', '<', '>', '<=', '>='} and argument[2][0] == 'ref' and argument[2][1].lower().startswith('orders['):
                    column = argument[2][1].split('[',1)[1][:-1].lower()
                    source = tables['orders']; selectors = context_selectors(narrowed, source)
                    selectors.pop(column, None)
                    replacement = source
                    if not narrowed.empty:
                        periods = narrowed.order_date.dt.to_period('M').astype(str)
                        replacement = replacement.loc[replacement.order_date.dt.to_period('M').astype(str).isin(periods)]
                    for field, values in selectors.items():
                        if values: replacement = replacement.loc[replacement[field].isin(values)]
                    condition = evaluate(argument, replacement)
                    if not isinstance(condition, pd.Series) or condition.dtype != bool: raise ValueError('Фильтр CALCULATE должен возвращать условие поля.')
                    narrowed = replacement.loc[condition]
                    selectors[column] = narrowed[column].unique().tolist()
                    narrowed.attrs['filter_context'] = selectors
                    continue
                condition = evaluate(argument, narrowed)
                if isinstance(condition, dict) and 'date_shift' in condition:
                    offset, unit = condition['date_shift']
                    if unit != 'MONTH' or offset not in {-1, 1}: raise ValueError('Поддерживается сдвиг на один месяц.')
                    if narrowed.empty: continue
                    dates = narrowed.order_date
                    shifted = set(dates.dt.to_period('M').astype(str))
                    periods = {str(pd.Period(month, freq='M') + offset) for month in shifted}
                    source = tables['orders']
                    narrowed = source.loc[source.order_date.dt.to_period('M').astype(str).isin(periods)]
                    # Production reports carry explicit filter context. A direct
                    # helper call may supply a sliced frame: recover only the
                    # smallest selector reproducing that slice, never incidental
                    # category/status values merely observed in a date bucket.
                    selectors = context_selectors(context, source)
                    for column, allowed_values in selectors.items():
                        if allowed_values: narrowed = narrowed.loc[narrowed[column].isin(allowed_values)]
                    narrowed.attrs['filter_context'] = selectors
                elif isinstance(condition, pd.Series) and condition.dtype == bool:
                    narrowed = narrowed.loc[condition.reindex(narrowed.index, fill_value=False)]
                else: raise ValueError('Фильтр CALCULATE должен сравнивать поле с условием.')
            return evaluate(args[0], narrowed)
        if name == 'DATEADD':
            if mode != 'power-bi' or len(args) != 3: raise ValueError('DATEADD требует дату, сдвиг и период.')
            evaluate(args[0], context)
            return {'date_shift': (evaluate(args[1], context), evaluate(args[2], context))}
        if name == 'IF':
            if len(args) != 3: raise ValueError('IF требует условие и два результата.')
            condition = evaluate(args[0], context)
            if not isinstance(condition, pd.Series): return evaluate(args[1] if condition else args[2], context)
            yes, no = evaluate(args[1], context), evaluate(args[2], context)
            yes = yes if isinstance(yes, pd.Series) else pd.Series(yes, index=context.index)
            return yes.where(condition, no)
        if name == 'IFERROR':
            if len(args) != 2: raise ValueError('IFERROR требует два аргумента.')
            try: value = evaluate(args[0], context)
            except ZeroDivisionError: return evaluate(args[1], context)
            return value if value is not None else evaluate(args[1], context)
        values = [evaluate(arg, context) for arg in args]
        if name in {'SUM', 'COUNT', 'COUNTA', 'COUNTBLANK', 'AVERAGE', 'DISTINCTCOUNT', 'COUNTROWS'}:
            if len(values) != 1: raise ValueError('Агрегат требует один аргумент.')
            value = values[0]
            if name == 'COUNTROWS':
                if not isinstance(value, pd.DataFrame): raise ValueError('COUNTROWS требует таблицу.')
                return len(value)
            if not isinstance(value, pd.Series): raise ValueError('Агрегат требует колонку.')
            if name == 'SUM': return float(value.sum())
            if name == 'COUNT': return int(pd.to_numeric(value, errors='coerce').notna().sum())
            if name == 'COUNTA': return int(value.notna().sum())
            if name == 'COUNTBLANK': return int(value.isna().sum())
            if name == 'DISTINCTCOUNT': return int(value.nunique(dropna=False))
            return round(float(value.mean()), 2) if value.notna().any() else None
        if name in {'COUNTIF', 'SUMIF'}:
            if len(values) != (2 if name == 'COUNTIF' else 3) or not isinstance(values[0], pd.Series): raise ValueError('Проверьте аргументы условного агрегата.')
            source, wanted = values[:2]
            def calculate(want):
                mask = criterion(source, want)
                return int(mask.sum()) if name == 'COUNTIF' else float(values[2].loc[mask].sum())
            return wanted.map(calculate) if isinstance(wanted, pd.Series) else calculate(wanted)
        if name == 'DIVIDE':
            if len(values) not in {2, 3}: raise ValueError('DIVIDE требует числитель и знаменатель.')
            return values[0] / values[1] if values[1] else (values[2] if len(values) == 3 else None)
        if name == 'IF':
            if len(values) != 3: raise ValueError('IF требует условие и два результата.')
            condition, yes, no = values
            if isinstance(condition, pd.Series):
                yes = yes if isinstance(yes, pd.Series) else pd.Series(yes, index=context.index)
                return yes.where(condition, no)
            return yes if condition else no
        if name == 'IFERROR':
            # The safe subset handles zero division explicitly with IF/DIVIDE.
            if len(values) != 2: raise ValueError('IFERROR требует два аргумента.')
            return values[0] if values[0] is not None else values[1]
        if name == 'ROUND':
            if len(values) != 2 or not isinstance(values[1], int) or not 0 <= values[1] <= 6: raise ValueError('ROUND: укажите от 0 до 6 знаков.')
            return values[0].round(values[1]) if isinstance(values[0], pd.Series) else round(values[0], values[1])
        raise ValueError('Функция не входит в поддерживаемый учебный набор.')
    return evaluate(FormulaParser(text).complete(), frame)


def calculate_report(code, tables, mode):
    spec = json.loads(code)
    if not isinstance(spec, dict): raise ValueError('Настройки отчёта должны быть объектом.')
    if len(spec) > 25 or any(isinstance(value, (list, dict)) and len(value) > (100 if key == 'interaction_events' else 30) for key, value in spec.items()):
        raise ValueError('Слишком много настроек учебного отчёта.')
    op = spec.get('operation')
    frame = tables['orders'].copy()
    frame['order_date'] = pd.to_datetime(frame.order_date)
    tables = {**tables, 'orders': frame.copy()}
    filters = spec.get('filters', {})
    if not isinstance(filters, dict): raise ValueError('Фильтры должны быть объектом.')
    for key, value in filters.items():
        if key not in {'channel', 'city', 'status', 'category'}: raise ValueError('Неизвестный фильтр.')
        chosen = value if isinstance(value, list) else [value]
        if not all(item in tables['orders'][key].unique() for item in chosen): raise ValueError('Значение фильтра отсутствует в данных.')
        if chosen: frame = frame.loc[frame[key].isin(chosen)]
    selection = spec.get('selection')
    if selection:
        if not isinstance(selection, dict) or selection.get('field') not in {'city', 'category'}: raise ValueError('Неизвестный выбор диаграммы.')
        if selection.get('value') is not None:
            if selection['value'] not in tables['orders'][selection['field']].unique(): raise ValueError('Элемент диаграммы отсутствует.')
            if spec.get('interaction', 'filter') == 'filter': frame = frame.loc[frame[selection['field']] == selection['value']]
    frame.attrs['filter_context'] = {key: value if isinstance(value, list) else [value] for key, value in filters.items()}
    if selection and selection.get('value') is not None and spec.get('interaction', 'filter') == 'filter':
        frame.attrs['filter_context'][selection['field']] = [selection['value']]
    if op in {'model', 'calculated_columns', 'formula_table', 'quality_checks', 'report', 'page', 'checklist', 'memo'} or spec.get('authored_v2'):
        return authored_report(spec, tables, frame, mode)
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
        payload = {name: rounded(formula(expression, frame, mode)) for name, expression in measures.items()}
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


def rounded(value, decimals=2):
    if isinstance(value, float): return round(value, decimals)
    return value


def model_evidence(model, tables):
    if not isinstance(model, dict): raise ValueError('Настройте модель таблиц.')
    configured = model.get('tables', {})
    if not isinstance(configured, dict) or not configured: raise ValueError('Добавьте таблицы модели.')
    result = {'tables': {}, 'relationships': []}
    for name, settings in configured.items():
        if name not in tables or not isinstance(settings, dict) or settings.get('headers') is not True: raise ValueError('Проверьте таблицу и строку заголовков.')
        frame = tables[name].copy(); types = settings.get('types', {})
        if not isinstance(types, dict): raise ValueError('Укажите типы полей.')
        for column, dtype in types.items():
            if column not in frame or dtype not in {'date', 'number', 'text', 'boolean'}: raise ValueError('Неизвестное поле или тип модели.')
            if dtype == 'date': frame[column] = pd.to_datetime(frame[column], errors='raise')
            elif dtype == 'number': frame[column] = pd.to_numeric(frame[column], errors='raise')
            elif dtype == 'text': frame[column] = frame[column].astype('string')
            elif not frame[column].astype(str).str.lower().isin({'true', 'false', '0', '1'}).all(): raise ValueError('Поле не является булевым.')
        result['tables'][name] = {'rows': len(frame), 'columns': len(frame.columns), 'types': types, 'headers': True}
    for relationship in model.get('relationships', []):
        if not isinstance(relationship, dict): raise ValueError('Связь должна быть объектом.')
        try:
            left_table, left_key = relationship['from'].split('.')
            right_table, right_key = relationship['to'].split('.')
            left, right = tables[left_table], tables[right_table]
        except (KeyError, ValueError): raise ValueError('Неизвестные поля связи.')
        if left_key not in left or right_key not in right or right[right_key].duplicated().any(): raise ValueError('На стороне «один» ключи должны быть уникальны.')
        if relationship.get('cardinality') != 'many-to-one' or relationship.get('active') is not True: raise ValueError('Нужна активная связь многие к одному.')
        result['relationships'].append({**relationship, 'unmatched': int((~left[left_key].isin(right[right_key])).sum())})
    calendar = model.get('calendar')
    if calendar:
        if not isinstance(calendar, dict) or calendar.get('relationship') != 'orders.order_date' or calendar.get('date_column') != 'date': raise ValueError('Свяжите Calendar[date] с orders.order_date.')
        dates = pd.date_range(calendar.get('start'), calendar.get('end'))
        if not len(dates) or len(dates) > 3660 or not tables['orders'].order_date.isin(dates).all(): raise ValueError('Непрерывный календарь должен покрывать даты заказов.')
        result['calendar'] = {**calendar, 'rows': len(dates), 'continuous': True}
    return result


def authored_report(spec, tables, frame, mode):
    op = spec.get('operation'); source = tables['orders']; measures = spec.get('measures', {})
    if not isinstance(measures, dict) or len(measures) > 20: raise ValueError('Допустимо до 20 именованных мер.')
    formats = spec.get('formats', {})
    if not isinstance(formats, dict) or any(value not in {'number', 'currency', 'percent', 'date', 'text'} for value in formats.values()): raise ValueError('Неизвестный формат.')
    def group_context(context, field, key):
        context = context.copy()
        context.attrs['filter_context'] = {**context.attrs.get('filter_context', {}), field: [key]}
        return context
    def measure_values(context):
        return {name: rounded(formula(expression, context, mode, measures, tables), 6 if formats.get(name) == 'percent' else 2) for name, expression in measures.items()}
    def grouped(context, field, expression='SUM(orders[revenue])', sort='label'):
        rows = [{field: str(key), 'value': rounded(formula(expression, group_context(group,field,key), mode, measures, tables))} for key, group in context.groupby(field, sort=True)]
        return sorted(rows, key=lambda row: row['value'] or 0, reverse=True) if sort == 'descending' else rows
    model = model_evidence(spec['model'], tables) if 'model' in spec else None
    if op in {'import', 'model'}:
        if mode == 'excel':
            if spec.get('delimiter') != ',' or spec.get('headers') is not True or spec.get('table') != 'Orders' or spec.get('filters_enabled') is not True: raise ValueError('Импортируйте CSV с заголовками в умную таблицу Orders с фильтрами.')
            types = spec.get('types', {})
            model = model_evidence({'tables': {'orders': {'headers': True, 'types': types}}}, tables)
            return {'table': 'Orders', 'rows': len(source), 'columns': len(source.columns), 'first_order': int(source.order_id.iloc[0]), 'last_order': int(source.order_id.iloc[-1]), 'types': types, 'filters_enabled': True}
        return model
    if op == 'pivot':
        rows, columns = spec.get('rows'), spec.get('columns')
        if rows not in {'city', 'channel', 'category'} or columns not in {'city', 'channel', 'category'} or rows == columns: raise ValueError('Выберите разные поля строк и колонок.')
        if spec.get('aggregate') != 'sum' or spec.get('value') != 'revenue': raise ValueError('Сводная рассчитывает сумму выручки.')
        pivot = frame.pivot_table(index=rows, columns=columns, values='revenue', aggfunc='sum', fill_value=0)
        records = pivot.reset_index().to_dict('records')
        for row, total in zip(records, pivot.sum(axis=1)): row['total'] = float(total)
        return {'rows': pivot.index.tolist(), 'columns': pivot.columns.tolist(), 'values': records, 'row_totals': pivot.sum(axis=1).tolist(), 'column_totals': pivot.sum(axis=0).to_dict(), 'total': float(pivot.values.sum()), 'totals': spec.get('totals')}
    if op in {'formula', 'calculated_columns'}:
        columns = spec.get('calculated_columns', {})
        if not isinstance(columns, dict) or not columns or len(columns) > 10: raise ValueError('Добавьте вычисляемые колонки.')
        calculated = frame.copy(); values = {}
        for name, expression in columns.items():
            if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]{0,40}', name) or name in source: raise ValueError('Новое имя колонки не должно менять исходные поля.')
            value = formula(expression, calculated, mode, measures, tables)
            if not isinstance(value, pd.Series): raise ValueError('Вычисляемая колонка должна рассчитываться по строкам.')
            calculated[name] = value; values[name] = value.tolist()
        return {'order_ids': frame.order_id.tolist(), 'columns': values, 'revenue_total': float(calculated.iloc[:, -2].sum()) if len(columns) == 2 and pd.api.types.is_numeric_dtype(calculated.iloc[:, -2]) else None}
    if op == 'format':
        expression = str(spec.get('formula', ''))
        # Status is the 14th CSV column. $N2 anchors the field, not the row.
        if not re.fullmatch(r'\s*=\$N2\s*=\s*"Отменён"\s*', expression): raise ValueError('Закрепите колонку статуса $N, оставив относительную строку 2.')
        if spec.get('scope') != 'rows' or spec.get('style') != 'light-red': raise ValueError('Примените светло-красный цвет ко всей строке.')
        return {'highlighted_orders': source.loc[source.status == 'Отменён', 'order_id'].tolist(), 'style': 'light-red', 'scope': 'rows'}
    if op == 'formula_table':
        field = spec.get('group_by')
        if field != 'channel' or not measures: raise ValueError('Создайте справочник каналов и формулы показателей.')
        output = []
        for category in sorted(source[field].unique()):
            # $A2 is the current dictionary category, not an arbitrary expression.
            current = {name: expression.replace('$A2', json.dumps(category, ensure_ascii=False)) for name, expression in measures.items()}
            output.append({'channel': category, **{name: rounded(formula(expression, frame, mode, current, tables)) for name, expression in current.items()}})
        return {'values': output, 'formats': formats}
    if op in {'quality', 'quality_checks'}:
        checks = spec.get('checks', {})
        if not isinstance(checks, dict) or not checks or len(checks) > 10: raise ValueError('Добавьте расчётные проверки качества.')
        values = {name: formula(expression, frame, mode, measures, tables) for name, expression in checks.items()}
        if any(isinstance(value, (pd.Series, pd.DataFrame)) for value in values.values()): raise ValueError('Проверка качества должна возвращать число.')
        return {'checks': [{'name': name, 'count': value, 'status': 'допустимый пропуск' if name == 'missing_rating' and value else 'нужна правка' if value else 'пройдено'} for name, value in values.items()]}
    if op in {'memo', 'insight', 'insights'}: return memo_evidence(spec, source)
    if op == 'checklist':
        checked = checklist_evidence(spec, tables, model)
        current = {**spec['report'], 'filters': spec.get('filters', {}), 'selection': spec.get('selection')}
        return {**calculate_report(json.dumps(current), tables, mode), **checked}
    if op in {'kpis', 'cards', 'measure'}:
        return {'cards': measure_values(frame), 'formats': formats, 'layout': spec.get('layout')}
    if op in {'bar', 'status'}:
        field = spec.get('group_by'); expression = spec.get('measure')
        if field not in {'city', 'channel', 'category'}: raise ValueError('Выберите поле диаграммы.')
        if not isinstance(spec.get('title'), str) or not 3 <= len(spec['title'].strip()) <= 120: raise ValueError('Добавьте содержательный заголовок диаграммы.')
        return {'values': grouped(frame, field, expression, spec.get('sort')), 'visual': spec.get('visual'), 'title': spec.get('title'), 'labels': spec.get('labels'), 'zero_axis': spec.get('zero_axis'), 'format': spec.get('format')}
    if op in {'chart', 'line'}:
        if spec.get('date_field') != 'order_date' or spec.get('period') not in {'day', 'month'}: raise ValueError('Выберите дату заказа и период.')
        if not isinstance(spec.get('title'), str) or not 3 <= len(spec['title'].strip()) <= 120: raise ValueError('Добавьте содержательный заголовок графика.')
        if spec['period'] == 'month' and (not model or 'calendar' not in model): raise ValueError('Для временной аналитики настройте непрерывный календарь и связь.')
        values = []
        for period, group in frame.groupby(frame.order_date.dt.strftime('%Y-%m' if spec['period'] == 'month' else '%Y-%m-%d'), sort=True):
            values.append({'period': period, **measure_values(group)} if measures else {'period': period, 'value': rounded(formula(spec.get('measure'), group, mode, measures, tables))})
        return {'values': values, 'visual': spec.get('visual'), 'title': spec.get('title'), 'format': spec.get('format'), 'sort': spec.get('sort'), 'model': model}
    if op in {'report', 'page', 'slicer', 'filter', 'interactions', 'delivery'}:
        if not measures: raise ValueError('Добавьте меры отчёта.')
        slicers = spec.get('slicers', [])
        if not isinstance(slicers, list) or any(field not in {'city', 'category', 'channel', 'status'} for field in slicers): raise ValueError('Неизвестный срез.')
        interactions = spec.get('interactions', {})
        if not isinstance(interactions, dict) or any(value not in {'filter', 'none', 'highlight'} for value in interactions.values()): raise ValueError('Неизвестное взаимодействие.')
        visuals = {}; full_visuals = {}
        page = spec.get('page', 'sales')
        fields = spec.get('visual_fields', ['channel'] if page in {'delivery', 'cancellations'} else [] if page == 'table' else ['city', 'category', 'channel'])
        if not isinstance(fields, list) or len(fields) != len(set(fields)) or any(field not in {'city', 'category', 'channel'} for field in fields): raise ValueError('Неизвестные поля визуалов.')
        for field in fields:
            expression = spec.get('chart_measure', 'AVERAGE(orders[delivery_days])' if page == 'delivery' else 'SUM(orders[revenue])')
            context = frame if interactions.get(field, 'filter') == 'filter' else source
            visuals[field] = grouped(context, field, expression)
            full_visuals[field] = grouped(source, field, expression)
        if page == 'sales':
            visuals['month'] = [{'period': period, 'value': float(group.revenue.sum())} for period, group in frame.groupby(frame.order_date.dt.strftime('%Y-%m'), sort=True)]
        cards = measure_values(frame if interactions.get('cards', 'filter') == 'filter' else source)
        if page == 'table': cards = {}
        if spec.get('card_measures'):
            if any(name not in cards for name in spec['card_measures']): raise ValueError('Неизвестная мера карточки.')
            cards = {name: cards[name] for name in spec['card_measures']}
        total = measure_values(frame)
        result = {'cards': cards, 'total': total, 'values': [{spec.get('table_field', 'city'): key, **measure_values(group_context(group,spec.get('table_field','city'),key))} for key, group in frame.groupby(spec.get('table_field', 'city'), sort=True)],
                'visuals': visuals, 'full_visuals': full_visuals, 'visual_options': {key: sorted(source[key].unique().tolist()) for key in ('city', 'channel', 'category', 'status')},
                'filters': spec.get('filters', {}), 'selection': spec.get('selection'), 'formats': formats,
                'configuration': {'page': page, 'slicers': slicers, 'interactions': interactions, 'interaction': spec.get('interaction', 'filter'), 'layout': spec.get('layout'), 'model': model}}
        if page == 'pivot':
            result['pivot'] = authored_report({'operation':'pivot','rows':'city','columns':'category','value':'revenue','aggregate':'sum','totals':True}, tables, frame, mode)
        return result
    raise ValueError('Выберите поддерживаемую операцию авторского отчёта.')


def factual_metrics(frame):
    cities = frame.groupby('city').revenue.sum(); channels = frame.groupby('channel')
    cancellation = channels.apply(lambda group: float((group.status == 'Отменён').mean()), include_groups=False)
    months = frame.groupby(frame.order_date.dt.strftime('%Y-%m')).revenue.sum()
    return {'revenue_orders': {'revenue': int(frame.revenue.sum()), 'orders': len(frame)},
            'top_city': {'city': cities.idxmax(), 'revenue': int(cities.max())},
            'month_growth': {'growth': int(months.loc['2026-02'] - months.loc['2026-01'])},
            'cancellation_channel': {'channel': cancellation.idxmax(), 'percent': round(float(cancellation.max()) * 100, 1)},
            'delivery': {'slow': int((frame.delivery_days > 3).sum())}}


def text_has_number(text, value):
    normalized = re.sub(r'\s', '', text).replace(',', '.').replace('−', '-')
    tokens = re.findall(r'(?<![\d.])-?\d+(?:\.\d+)?(?![\d.])', normalized)
    return any(abs(float(token)-float(value)) <= 1e-9 for token in tokens)


def memo_evidence(spec, frame):
    statements = spec.get('statements', [])
    if not isinstance(statements, list) or not 1 <= len(statements) <= 5: raise ValueError('Добавьте от одного до пяти коротких тезисов.')
    computed = factual_metrics(frame); output = []
    for statement in statements:
        if not isinstance(statement, dict): raise ValueError('Тезис должен содержать тему и текст.')
        metric, text = statement.get('metric'), statement.get('text')
        if not isinstance(text, str) or not 15 <= len(text.strip()) <= 1200: raise ValueError('Напишите содержательный короткий тезис.')
        normalized = re.sub(r'[\s\u00a0]', '', text).lower().replace(',', '.')
        if metric == 'next_action':
            if not re.search(r'провер|сравн|исслед|разобрат|сопостав', text, re.I) or not re.search(r'отмен|достав|канал|магазин', text, re.I): raise ValueError('Следующее действие должно назвать конкретную дополнительную проверку.')
            evidence = {'action': 'additional_check'}
        else:
            if metric not in computed: raise ValueError('Неизвестная тема вывода.')
            evidence = computed[metric]
            for value in evidence.values():
                matched = text_has_number(text,value) if isinstance(value,numbers.Number) else str(value).lower() in normalized
                if not matched: raise ValueError('Текст вывода должен содержать рассчитанное число и объект сравнения.')
            if re.search(r'потому что|из-за|причин[аой]|вызван|привел|привёл', text, re.I) and not re.search(r'возможно|гипотез|нужно провер|требует провер', text, re.I): raise ValueError('Отделите предположение о причине от установленного факта.')
        output.append({'metric': metric, 'text': text, 'evidence': evidence})
    if len({row['metric'] for row in output}) != len(output): raise ValueError('Темы тезисов не должны повторяться.')
    return {'statements': output}


CHECK_IDS = ('totals', 'unique_orders', 'missing_rating', 'relationships', 'city_filters', 'channel_filters',
             'status_filters', 'clear_filters', 'city_reconciliation', 'category_reconciliation')


def checklist_evidence(spec, tables, model):
    source = tables['orders']; report = spec.get('report')
    if not isinstance(report, dict): raise ValueError('Добавьте проверяемый отчёт, не отметки о его наличии.')
    baseline = calculate_report(json.dumps(report), tables, 'power-bi')
    checks = spec.get('checks', [])
    if not isinstance(checks, list) or len(checks) < 10 or len(checks) > 20: raise ValueError('Чек-лист содержит минимум десять расчётных проверок.')
    if len({item.get('id') for item in checks if isinstance(item, dict)}) != len(checks): raise ValueError('Проверки не должны повторяться.')
    expected_totals = {'revenue': float(source.revenue.sum()), 'orders': int(source.order_id.nunique())}
    def totals(output): return {key: output['cards'].get(key) for key in expected_totals}
    result = []
    for check in checks:
        if not isinstance(check, dict) or check.get('id') not in CHECK_IDS or check.get('status') not in {'пройдено', 'нужна правка'}: raise ValueError('Выберите поддерживаемую проверку и её статус.')
        name = check['id']; evidence = {}; passed = True
        if name == 'totals':
            evidence = {'expected': expected_totals, 'actual': totals(baseline)}; passed = evidence['actual'] == expected_totals
        elif name == 'unique_orders':
            evidence = {'rows': len(source), 'unique': int(source.order_id.nunique())}; passed = evidence['rows'] == evidence['unique']
        elif name == 'missing_rating':
            evidence = {'missing': int(source.rating.isna().sum()), 'zero': int(source.rating.eq(0).sum())}; passed = evidence == {'missing': 2, 'zero': 0}
        elif name == 'relationships':
            evidence = {'relationships': model['relationships'] if model else []}; passed = len(evidence['relationships']) == 3 and all(row['unmatched'] == 0 for row in evidence['relationships'])
        elif name.endswith('_filters') and name != 'clear_filters':
            field = name.removesuffix('_filters'); cases = []
            for value in sorted(source[field].unique()):
                filtered = {**report, 'filters': {field: [value]}, 'selection': None}
                actual = totals(calculate_report(json.dumps(filtered), tables, 'power-bi'))
                selected = source.loc[source[field] == value]
                expected = {'revenue': float(selected.revenue.sum()), 'orders': int(selected.order_id.nunique())}
                cases.append({'value': value, 'actual': actual, 'expected': expected}); passed &= actual == expected
            evidence = {'cases': cases}
        elif name == 'clear_filters':
            cleared = calculate_report(json.dumps({**report, 'filters': {}, 'selection': None}), tables, 'power-bi')
            evidence = {'actual': totals(cleared), 'expected': expected_totals}; passed = evidence['actual'] == expected_totals
        else:
            field = name.removesuffix('_reconciliation')
            total = sum(row['value'] for row in baseline['visuals'][field])
            evidence = {'sum': total, 'revenue': expected_totals['revenue']}; passed = total == evidence['revenue']
        status = 'пройдено' if passed else 'нужна правка'
        result.append({'id': name, 'status': status, 'claimed_status': check['status'], 'evidence': evidence})
    return {'checks': result}


def interaction_evidence(code, dataset, requirements):
    """Replay configured actions and calculate results; client claims never mark a check passed."""
    spec = json.loads(code); events = spec.get('interaction_events', [])
    if not isinstance(events, list) or len(events) > 100: raise ValueError('История взаимодействий превышает учебный лимит.')
    tables = load_tables(dataset); frame = tables['orders']; filters = {}; selection = None; evidence = []
    observed = {'fields': set(), 'selected': set(), 'cleared': False, 'multiselect': False, 'filter_values': {}, 'selection_values': {}}
    for event in events:
        if not isinstance(event, dict): raise ValueError('Некорректное действие отчёта.')
        kind = event.get('type')
        if kind == 'filter':
            field, values = event.get('field'), event.get('values')
            if field not in {'city', 'channel', 'status', 'category'} or not isinstance(values, list) or not all(value in frame[field].unique() for value in values): raise ValueError('Некорректное действие фильтра.')
            filters[field] = values; observed['fields'].add(field); observed['multiselect'] |= len(values) > 1
            observed['filter_values'].setdefault(field, set()).update(values)
        elif kind == 'select':
            field, value = event.get('field'), event.get('value')
            if field not in {'city', 'category'} or (value is not None and value not in frame[field].unique()): raise ValueError('Некорректный выбор диаграммы.')
            if value is None:
                selection = None; observed['cleared'] = True
                report = spec.get('report', spec)
                output = calculate_report(json.dumps({**report, 'filters': filters, 'selection': None}), tables, requirements.get('mode', 'power-bi'))
                evidence.append({'event': event, 'cards': output.get('cards'), 'visuals': output.get('visuals')})
                continue
            next_selection = {'field': field, 'value': value}
            if selection == next_selection: selection = None; observed['cleared'] = True
            else: selection = next_selection
            observed['selected'].add(field)
            observed['selection_values'].setdefault(field, set()).add(value)
        elif kind == 'clear': filters = {}; selection = None; observed['cleared'] = True
        else: raise ValueError('Неизвестное действие отчёта.')
        report = spec.get('report', spec)
        output = calculate_report(json.dumps({**report, 'filters': filters, 'selection': selection}), tables, 'power-bi' if report.get('page') else requirements.get('mode', 'power-bi'))
        evidence.append({'event': event, 'cards': output.get('cards'), 'visuals': output.get('visuals')})
    missing = []
    for field in requirements.get('filter_fields', []):
        if field not in observed['fields']: missing.append(f'проверьте срез {field}')
    for field in requirements.get('selection_fields', []):
        if field not in observed['selected']: missing.append(f'выберите элемент диаграммы {field}')
    if requirements.get('clear') and not observed['cleared']: missing.append('очистите выбор')
    if requirements.get('multiselect') and not observed['multiselect']: missing.append('выберите несколько значений среза')
    for field in requirements.get('all_values', []):
        if observed['filter_values'].get(field, set()) != set(frame[field].unique()): missing.append(f'проверьте все значения среза {field}')
    for field, values in requirements.get('filter_values', {}).items():
        if not set(values).issubset(observed['filter_values'].get(field, set())): missing.append(f'проверьте заданные значения среза {field}')
    for field, values in requirements.get('selection_values', {}).items():
        if not set(values).issubset(observed['selection_values'].get(field, set())): missing.append(f'проверьте заданный элемент диаграммы {field}')
    return evidence, missing


def selected_rows_evidence(value, dataset, rule):
    if not isinstance(value, pd.DataFrame): raise ValueError('Ответ должен быть таблицей исходных заказов.')
    source = load_tables(dataset)[rule.get('source_table', 'orders')]
    identity, column = rule.get('identity_column', 'order_id'), rule['sort_column']
    if list(value.columns) != list(source.columns) or identity not in value or value[identity].duplicated().any(): raise ValueError('Сохраните исходные поля и уникальные номера выбранных заказов.')
    if not value[identity].isin(source[identity]).all(): raise ValueError('Выбран неизвестный заказ.')
    canonical = source.set_index(identity).loc[value[identity]].reset_index()[source.columns]
    actual = value.reset_index(drop=True).copy()
    if 'order_date' in actual:
        actual['order_date'] = pd.to_datetime(actual.order_date)
        canonical['order_date'] = pd.to_datetime(canonical.order_date)
    try: pd.testing.assert_frame_equal(actual, canonical.reset_index(drop=True), check_dtype=False)
    except AssertionError: raise ValueError('Выбранные строки не совпадают с исходными заказами.')
    if rule.get('kind') == 'top_n':
        count = rule['n']; descending = rule.get('descending', True)
        if len(value) != count or not 1 <= count <= len(source): raise ValueError('Выберите указанное число заказов.')
        ordered = source[column].sort_values(ascending=not descending); threshold = ordered.iloc[count - 1]
        above = source.loc[source[column] > threshold if descending else source[column] < threshold, identity]
        valid_boundary = value[column].ge(threshold) if descending else value[column].le(threshold)
        if not above.isin(value[identity]).all() or not valid_boundary.all() or not (value[column].is_monotonic_decreasing if descending else value[column].is_monotonic_increasing): raise ValueError('Соблюдайте рейтинг; при равенстве на границе можно выбрать любой заказ.')
    elif rule.get('kind') == 'minimum_per_group':
        group = rule['group_by']
        if len(value) != source[group].nunique() or value[group].duplicated().any() or set(value[group]) != set(source[group]): raise ValueError('Выберите один заказ каждого города.')
        minima = source.groupby(group)[column].min()
        if not all(row[column] == minima[row[group]] for _, row in value.iterrows()): raise ValueError('Для каждого города требуется минимальное значение; при равенстве допустим любой заказ.')
    else: raise ValueError('Неизвестное правило выбора строк.')
    return {'kind': 'scalar', 'data': {'selection_valid': True, 'rows': len(value)}}


def topics_evidence(value, dataset, topics):
    if not isinstance(value, pd.DataFrame) or list(value.columns) != ['topic', 'statement', 'value'] or len(value) != 5 or value.topic.duplicated().any() or set(value.topic) != set(topics): raise ValueError('Нужны пять различных тем и поля topic, statement, value.')
    frame = load_tables(dataset)['orders']; output = []
    dimensions = {'Города': 'city', 'Каналы': 'channel', 'Категории': 'category'}
    for _, row in value.iterrows():
        text = row.statement
        if not isinstance(text, str) or len(text.strip()) < 10 or not isinstance(row.value, numbers.Number) or pd.isna(row.value): raise ValueError('Каждый вывод содержит текст и числовое подтверждение.')
        normalized = re.sub(r'\s', '', text).lower().replace(',', '.')
        if not text_has_number(text,round(float(row.value),2)): raise ValueError('Укажите подтверждающее число в тексте вывода.')
        if row.topic in dimensions:
            candidates = []
            for label, group in frame.groupby(dimensions[row.topic]):
                for amount, words in [(float(group.revenue.sum()), r'выруч|продаж'), (len(group), r'заказ'), (float(group.revenue.mean()), r'чек|средн')]:
                    label_text = str(label).lower()
                    if label_text.endswith(('а','я')): label_text = label_text[:-1]
                    candidates.append((label_text in text.lower() and bool(re.search(words, text, re.I)), amount))
            valid = any(identified and abs(float(row.value) - amount) <= 0.01 for identified, amount in candidates)
        elif row.topic == 'Отмены':
            count = int(frame.status.eq('Отменён').sum())
            valid = bool(re.search(r'отмен', text, re.I)) and any(abs(float(row.value)-amount) <= 0.05 for amount in [count, count/len(frame)*100])
        else:
            valid = bool(re.search(r'достав', text, re.I)) and any(abs(float(row.value)-amount) <= 0.01 for amount in [(frame.delivery_days>3).sum(),frame.delivery_days.mean()])
        if not valid: raise ValueError('Вывод должен называть объект сравнения и подтверждаться расчётом по исходным данным.')
        output.append(row.topic)
    return {'kind': 'scalar', 'data': {'evidence_topics': sorted(output)}}


def variant_dataset(dataset, spec):
    """Make a task-scoped synthetic check fixture in memory; canonical files stay untouched."""
    result = json.loads(json.dumps(dataset)); tables = load_tables(dataset)
    table = spec.get('table', 'orders')
    if table not in tables: raise ValueError('Неизвестная таблица проверочного примера.')
    frame = tables[table].copy()
    for update in spec.get('row_updates', []):
        mask = pd.Series(True, index=frame.index)
        for column, value in update['where'].items(): mask &= frame[column].eq(value)
        for column, value in update['set'].items(): frame.loc[mask, column] = value
    for index in spec.get('append_rows', []): frame = pd.concat([frame, frame.iloc[[index]].copy()], ignore_index=True)
    for column, values in spec.get('remove_values', {}).items(): frame = frame.loc[~frame[column].isin(values)]
    filename = next(name for name in result['files'] if name.removeprefix('koda_market_').removesuffix('.csv') == table)
    result['files'][filename] = frame.to_csv(index=False)
    # Tasks may also expose arrays; keep their synthetic copy coherent.
    if table in result: result[table] = frame.where(frame.notna(), None).to_dict('list')
    return result


def execute_mode(code, dataset, mode):
    tables = load_tables(dataset)
    if mode == 'sql': return sql_result(code, tables)
    if mode in {'excel', 'power-bi'}: return calculate_report(code, tables, mode)
    raise ValueError('Неизвестный режим упражнения.')
