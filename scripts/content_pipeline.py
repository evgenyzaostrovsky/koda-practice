"""Persistent Content Pipeline for KODA Practice learning materials."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content" / "catalog.json"
THEORY_PATH = ROOT / "content" / "theory_bank.json"
UNITS_PATH = ROOT / "content" / "knowledge_units.json"
REPORTS = ROOT / "reports"
ALLOWED_DOC_HOSTS = {
    "pandas.pydata.org",
    "matplotlib.org",
    "seaborn.pydata.org",
    "numpy.org",
    "docs.python.org",
}
CREATED_AT = "2026-08-11T00:00:00Z"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def exercises(catalog):
    return [exercise for module in catalog["modules"] for topic in module["topics"] for exercise in topic["exercises"]]


def topics(catalog):
    return [topic for module in catalog["modules"] for topic in module["topics"]]


def code_calls(code: str) -> list[str]:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    names = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Attribute):
            names.append(node.func.attr)
        elif isinstance(node.func, ast.Name):
            names.append(node.func.id)
    return list(dict.fromkeys(names))


def normalized_solution(code: str) -> str:
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            node.id = "VAR"
        elif isinstance(node, ast.Constant):
            node.value = "CONST"
    return ast.dump(tree, include_attributes=False)


def theory_urls(article: dict) -> list[str]:
    return list(dict.fromkeys(method["documentationUrl"] for method in article.get("methods", [])))


CHEAT_GROUPS = {
    "start": "Создание таблиц", "reading": "Чтение файлов", "columns": "Выбор столбцов",
    "change-columns": "Изменение столбцов", "vectorization": "Векторные операции",
    "attributes": "Размер и форма", "inspection": "Просмотр данных",
    "dataframe-methods": "Агрегации", "series-methods": "Частоты",
    "groupby": "Группировка", "filtering": "Фильтрация", "sorting": "Сортировка",
    "merge": "Объединение", "pivot": "Сводные таблицы", "dtypes": "Преобразование типов",
    "datetime": "Дата и время", "recipes": "Пропуски", "pandas-plots": "Графики pandas",
    "seaborn": "Seaborn", "matplotlib": "Matplotlib",
}
CHEAT_NAMES = {
    "start": "pd.DataFrame()", "reading": "pd.read_csv()", "columns": "df[...]",
    "change-columns": "df[\"new\"] = ...", "vectorization": "Series: векторная операция",
    "attributes": "df.shape", "inspection": ".head() / .tail()",
    "dataframe-methods": ".sum()", "series-methods": ".value_counts()",
    "groupby": ".groupby().sum()", "filtering": ".query()", "sorting": ".sort_values()",
    "merge": "pd.merge()", "pivot": ".pivot_table()", "dtypes": ".astype()",
    "datetime": "pd.to_datetime() / .dt", "recipes": ".fillna()",
    "pandas-plots": ".plot()", "seaborn": "sns.barplot()", "matplotlib": "Axes.plot()",
}
ARTICLE_GUIDES = {
    "start": {
        "purpose": "DataFrame — двумерная таблица pandas: строки описывают наблюдения, столбцы — признаки, а индекс задаёт метки строк. Конструктор нужен, когда данные уже находятся в Python и их требуется привести к единой табличной форме.",
        "idea": "Форма входа определяет, как pandas сопоставляет значения со строками и столбцами. Словарь обычно задаёт столбцы, список словарей — строки с именованными полями, а двумерная последовательность требует явной схемы через columns.",
        "choice": "Словарь списков удобен для данных, организованных по столбцам; список словарей — для записей из API; список строк — для матриц без имён. from_records подчёркивает построчную природу данных, а обычный DataFrame остаётся универсальным вариантом.",
        "nuances": ["Все массивы в словаре должны иметь одинаковую длину.", "Порядок columns определяет и отбор, и порядок столбцов.", "Series выравниваются по индексу, поэтому несовпадающие метки могут создать NaN.", "Конструктор обычно создаёт новый объект, но вложенные изменяемые значения могут сохранять ссылки."],
        "errors": [("pd.DataFrame({'name': ['Аня', 'Борис'], 'score': [7]})", "Столбцы имеют разную длину, поэтому невозможно сформировать прямоугольную таблицу.", "pd.DataFrame({'name': ['Аня', 'Борис'], 'score': [7, 9]})"), ("pd.DataFrame([[1, 2]], columns=['a'])", "Число имён столбцов не совпадает с шириной строки.", "pd.DataFrame([[1, 2]], columns=['a', 'b'])"), ("pd.DataFrame(data, index=['only_one'])", "Длина index должна совпадать с числом строк.", "pd.DataFrame(data, index=['row_1', 'row_2'])")],
    },
    "reading": {"purpose":"pd.read_csv превращает текстовый табличный файл в DataFrame и отделяет формат хранения от дальнейшего анализа.","idea":"Парсер читает разделители и заголовки, затем определяет столбцы, типы, индекс, даты и обозначения пропусков.","choice":"Начинайте со стандартного чтения, а параметры добавляйте только когда устройство файла известно: sep для разделителя, header и names для схемы, dtype и parse_dates для типов.","nuances":["Явный dtype защищает идентификаторы с ведущими нулями.","usecols уменьшает память и время чтения.","na_values дополняет стандартный набор обозначений пропусков."],"errors":[("pd.read_csv('data.csv', sep=',')","Указан неверный разделитель для файла с точкой с запятой, поэтому данные попадут в один столбец.","pd.read_csv('data.csv', sep=';')")],},
    "columns": {"purpose":"Выбор столбцов формирует Series или новый DataFrame с нужной схемой.","idea":"Одна строковая метка возвращает Series, а список меток — DataFrame; порядок и повторы в списке сохраняются.","choice":"Используйте одну метку для одномерных вычислений и список, когда важна двумерная форма или дальнейшая табличная обработка.","nuances":["Имена с пробелами безопасно выбирать через квадратные скобки.","Пустой список создаёт DataFrame без столбцов, сохраняя индекс.","Выбор обычно не следует использовать как гарантию независимой копии."],"errors":[("df['name', 'score']","Кортеж воспринимается как одно имя столбца.","df[['name', 'score']]")],},
    "change-columns": {"purpose":"Присваивание в df[name] создаёт новый столбец или заменяет существующий, а векторные выражения вычисляют значения сразу для всех строк.","idea":"pandas выравнивает Series по индексу и выполняет арифметику поэлементно без Python-циклов.","choice":"Работайте с copy(), если исходная таблица должна остаться неизменной; присваивайте скаляр для константы, Series для выровненных данных и выражение для вычисляемого признака.","nuances":["Деление может породить бесконечность при нулевом знаменателе.","Series с другим индексом выравнивается по меткам.","Цепочечное присваивание может изменить не тот объект и вызывает предупреждения."],"errors":[("df[df['active']]['status'] = 'ok'","Цепочечное присваивание работает с временным срезом и ненадёжно изменяет исходные данные.","df.loc[df['active'], 'status'] = 'ok'")],},
    "vectorization": {"purpose":"Векторизация применяет арифметику и сравнения ко всей Series без явного обхода элементов.","idea":"Операции Series выполняются по меткам индекса; несовпадающие метки дают пропуски, а методы add и аналоги позволяют задать fill_value.","choice":"Операторы удобны при совпадающих индексах, методы add/sub/mul/div — когда требуется контролировать отсутствующие метки.","nuances":["Сначала происходит выравнивание индексов, затем вычисление.","Результат сравнения имеет boolean dtype.","Скобки фиксируют порядок сложных формул."],"errors":[("left.values + right.values","Преобразование в массив теряет безопасное выравнивание по индексам.","left.add(right, fill_value=0)")],},
    "attributes": {"purpose":"Атрибут shape быстро сообщает размер DataFrame и помогает проверять форму данных.","idea":"shape возвращает кортеж (число строк, число столбцов), поэтому отдельные измерения доступны по индексам 0 и 1.","choice":"Используйте shape для проверки двумерной формы, len(df) — когда требуется только количество строк, а size — для общего числа элементов.","nuances":["shape — атрибут, его не вызывают со скобками.","Пустая таблица может иметь ноль строк, но ненулевое число столбцов.","Равенство shape не означает равенство данных."],"errors":[("df.shape()","Кортеж shape ошибочно вызван как функция.","df.shape")],},
    "inspection": {"purpose":"head и tail показывают небольшой фрагмент таблицы для быстрой проверки структуры и значений.","idea":"head берёт первые строки, tail — последние; без аргумента оба метода возвращают пять строк и не изменяют источник.","choice":"Используйте head для проверки заголовка и начала набора, tail — конца файла или последних наблюдений.","nuances":["n=0 возвращает пустой объект с исходной схемой.","Если n больше длины объекта, возвращаются все строки.","Индекс исходных строк сохраняется."],"errors":[("df.head","Без скобок получается объект метода, а не строки таблицы.","df.head()")],},
    "dataframe-methods": {"purpose":"sum агрегирует числовые значения Series или DataFrame в итоговую сумму.","idea":"Для Series получается скаляр, для DataFrame — суммы по столбцам; axis=1 меняет направление и суммирует строки.","choice":"Настраивайте skipna для пропусков и min_count, когда итог не должен становиться нулём при недостатке наблюдений.","nuances":["Boolean-значения суммируются как 1 и 0.","skipna=True используется по умолчанию.","Тип результата зависит от входных типов и направления агрегации."],"errors":[("df.sum(axis=0)","Суммирование по столбцам ошибочно выбрано вместо требуемых итогов по строкам.","df.sum(axis=1)")],},
    "series-methods": {"purpose":"value_counts строит распределение значений Series и помогает быстро оценить категории.","idea":"Метод группирует одинаковые значения, считает частоты и по умолчанию сортирует их по убыванию, исключая NaN.","choice":"normalize=True используйте для долей, dropna=False — когда пропуски являются значимой категорией, bins — для интервалов чисел.","nuances":["sort=False сохраняет порядок появления категорий.","ascending=True меняет направление сортировки частот.","Нормализованные доли суммируются до единицы."],"errors":[("values.value_counts()","Пропуски исчезнут из результата при стандартном dropna=True.","values.value_counts(dropna=False)")],},
    "groupby": {"purpose":"groupby реализует схему split–apply–combine: разделяет строки по ключам, применяет агрегацию и собирает итог.","idea":"Ключи определяют группы, выбор столбцов ограничивает агрегируемые данные, а sum и другие функции вычисляют итог каждой группы.","choice":"Один ключ подходит для простого разреза, список ключей — для иерархии; as_index=False удобен для последующего merge и экспорта.","nuances":["sort=False сохраняет порядок появления групп.","dropna=False включает пустой ключ как группу.","min_count предотвращает превращение полностью пустой группы в ноль."],"errors":[("df.groupby('city')","Создан объект группировки, но не выбраны данные и агрегация.","df.groupby('city')['sales'].sum()")],},
    "filtering": {"purpose":"query фильтрует строки с помощью читаемого строкового выражения.","idea":"Имена столбцов участвуют в выражении напрямую, внешние переменные отмечаются @, а составные условия соединяются and и or.","choice":"query удобен для декларативных условий; boolean-маски лучше подходят для динамически собираемых выражений и сложных методов Series.","nuances":["Имена столбцов с пробелами заключаются в обратные кавычки.","Внешние списки и пороги требуют префикса @.","Строковые литералы внутри выражения нужно корректно заключать в кавычки."],"errors":[("df.query('score >= min_score')","Внешняя Python-переменная не отмечена символом @.","df.query('score >= @min_score')")],},
    "sorting": {"purpose":"sort_values упорядочивает строки по значениям одного или нескольких столбцов.","idea":"by задаёт ключи, ascending — направление каждого ключа, а дополнительные параметры управляют пропусками, индексом и стабильностью.","choice":"Один ключ используйте для простого ранжирования, несколько — когда внутри основной группы требуется второй порядок.","nuances":["Список ascending должен совпадать по длине со списком by.","na_position управляет положением пропусков независимо от направления.","Стабильная сортировка сохраняет исходный порядок равных значений."],"errors":[("df.sort_values(['city', 'score'], ascending=[False])","Для двух ключей передано только одно направление.","df.sort_values(['city', 'score'], ascending=[True, False])")],},
    "merge": {"purpose":"merge соединяет строки двух таблиц по общим ключам, аналогично JOIN в SQL.","idea":"Ключи сопоставляют строки, how определяет сохраняемый набор ключей, а suffixes разрешает конфликты одинаковых имён.","choice":"inner оставляет совпадения, left сохраняет все строки левой таблицы, right — правой, outer — все ключи обеих сторон.","nuances":["Дубликаты ключей могут многократно увеличить число строк.","validate проверяет ожидаемую кардинальность связи.","indicator помогает диагностировать источник каждой строки."],"errors":[("pd.merge(left, right, on='id')","Одинаковые имена ключа ошибочно указаны, хотя таблицы используют client_id и id.","pd.merge(left, right, left_on='client_id', right_on='id')")],},
    "pivot": {"purpose":"pivot_table строит сводную таблицу: группирует наблюдения по измерениям и агрегирует показатели.","idea":"index формирует строки, columns — столбцы, values выбирает показатели, aggfunc задаёт способ агрегации.","choice":"Используйте pivot_table для агрегации повторяющихся комбинаций; обычный pivot подходит только для уникальных пар ключей.","nuances":["fill_value заменяет пустые ячейки уже после агрегации.","margins добавляет итоговые строки и столбцы.","Несколько values создают многоуровневые столбцы."],"errors":[("df.pivot(index='city', columns='category', values='sales')","Повторяющиеся пары city/category делают обычный pivot невозможным.","df.pivot_table(index='city', columns='category', values='sales', aggfunc='sum')")],},
    "dtypes": {"purpose":"astype явно преобразует тип Series, столбцов DataFrame или индекса.","idea":"Новый dtype определяет допустимые значения, память и поведение операций; преобразование возвращает новый объект.","choice":"Используйте string для текстовых идентификаторов, Int64 для целых с пропусками, category для повторяющихся категорий.","nuances":["Обычный int64 не хранит NaN, nullable Int64 — хранит.","Нечисловая строка вызывает ошибку при преобразовании в число.","Словарь позволяет назначить разные типы нескольким столбцам."],"errors":[("values.astype('int64')","Series содержит пропуск, который нельзя представить обычным int64.","values.astype('Int64')")],},
    "datetime": {"purpose":"to_datetime преобразует строки и числа во временной тип, а аксессор dt извлекает календарные компоненты.","idea":"Парсер интерпретирует формат, порядок дня и месяца, единицы Unix-времени и стратегию обработки ошибок.","choice":"Указывайте format для предсказуемых однородных строк, dayfirst для неоднозначных дат и errors='coerce' для контролируемых дефектов.","nuances":["errors='coerce' превращает некорректные значения в NaT.","dt доступен только для datetime-подобной Series.","quarter возвращает номера кварталов от 1 до 4."],"errors":[("dates.dt.year","Строковая Series ещё не преобразована в datetime.","pd.to_datetime(dates).dt.year")],},
    "recipes": {"purpose":"fillna, ffill и bfill восстанавливают пропущенные значения выбранной стратегией.","idea":"Скаляр задаёт константу, словарь — правила по столбцам, статистика — оценку из данных, а направленное заполнение использует соседние наблюдения.","choice":"Ноль уместен для отсутствующего количества, медиана — для устойчивого числового заполнения, ffill — для состояний, действующих до следующего изменения.","nuances":["Заполнение меняет смысл данных, поэтому стратегию нужно выбирать по предметной области.","limit ограничивает число последовательных замен.","По умолчанию методы возвращают новый объект."],"errors":[("df.fillna(0)","Все столбцы, включая текстовые, без разбора заполнены числом.","df.fillna({'city': 'Неизвестно', 'score': 0})")],},
    "pandas-plots": {"purpose":"DataFrame.plot быстро строит графики из табличных данных через backend Matplotlib.","idea":"x и y выбирают столбцы, kind определяет тип графика, а параметры оформления передаются создаваемым осям.","choice":"Линия показывает динамику, bar сравнивает категории, hist раскрывает распределение числовой величины.","nuances":["Метод возвращает объект Axes, который можно дополнительно оформить.","Список y строит несколько серий на одних осях.","figsize задаётся кортежем в дюймах."],"errors":[("df.plot(kind='bar')","Без x и y график может включить не те числовые столбцы.","df.plot(x='category', y='sales', kind='bar')")],},
    "seaborn": {"purpose":"sns.barplot сравнивает статистику числового показателя между категориями.","idea":"data задаёт таблицу, x и y связывают столбцы с осями, estimator вычисляет высоту, hue разбивает каждую категорию на группы.","choice":"Используйте barplot для агрегированного сравнения; countplot — для числа наблюдений без числового y.","nuances":["По умолчанию estimator вычисляет среднее.","errorbar=None отключает интервалы неопределённости.","order и hue_order фиксируют порядок категорий."],"errors":[("sns.barplot(data=df, x='category')","Не указан числовой показатель y для вычисления высоты столбцов.","sns.barplot(data=df, x='category', y='sales')")],},
    "matplotlib": {"purpose":"Axes.plot строит линии на явно созданных осях Matplotlib и даёт полный контроль над оформлением.","idea":"plt.subplots создаёт Figure и Axes, plot добавляет одну или несколько линий, методы Axes задают заголовки и подписи.","choice":"Явные x и y используйте для осмысленной шкалы; несколько вызовов plot добавляют сравниваемые серии на те же оси.","nuances":["x и y должны иметь совместимую длину.","label становится видимым после вызова legend().","Figure управляет всем рисунком, Axes — конкретной областью построения."],"errors":[("ax.plot([1, 2], [10])","Число координат x и y различается.","ax.plot([1, 2], [10, 20])")],},
}


def cheat_kind(focus: str) -> str:
    if any(mark in focus for mark in ("+", " - ", "*", "/", ">", "<", "==")):
        return "operator"
    if focus.startswith(("pd.", "sns.", "plt.")):
        return "function"
    if focus.startswith("df.shape") or focus.startswith(".dt."):
        return "attribute"
    if focus.startswith(".") or "." in focus and "=" not in focus:
        return "method"
    return "pattern"


def compact_example(solution: str) -> str:
    lines = solution.strip().splitlines()
    if len(lines) == 1 and lines[0].startswith("result = "):
        return lines[0].removeprefix("result = ")
    return "\n".join(lines[:3])


def compact_description(instructions: str) -> str:
    text = " ".join(instructions.strip().split())
    boundary = re.search(r"[!?](?=\s|$)|\.(?=\s+[А-ЯA-ZЁ]|$)", text)
    if boundary:
        text = text[:boundary.end()]
    if len(text) > 180:
        text = text[:177].rstrip(" ,;:") + "…"
    return text


def cheat_name(topic_slug: str, focus: str) -> str:
    if not re.search(r"[А-Яа-яЁё]", focus):
        return focus
    parameter = re.search(r"\b[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:[^ ]+)", focus)
    return f"{CHEAT_NAMES[topic_slug]} — {parameter.group(0)}" if parameter else CHEAT_NAMES[topic_slug]


def build_cheat_entries(topic: dict, theory: dict) -> list[dict]:
    entries = []
    seen = set()
    for exercise in topic["exercises"]:
        focus = exercise["focus"].strip()
        example = compact_example(exercise["solution_code"])
        signature = (cheat_name(topic["slug"], focus), normalized_solution(exercise["solution_code"]))
        if signature in seen:
            continue
        seen.add(signature)
        article = theory[f"theory-{exercise['id']}"]
        documentation_url = article["methods"][0]["documentationUrl"]
        entries.append({
            "id": f"cheat-{exercise['id']}",
            "group": CHEAT_GROUPS[topic["slug"]],
            "name": cheat_name(topic["slug"], focus),
            "kind": cheat_kind(focus),
            "description": compact_description(exercise["instructions"]),
            "example": example,
            "documentationUrl": documentation_url,
        })
    return entries


RESULT_GUIDES = {
    "start": "Новый DataFrame с указанными столбцами, строками и индексом.",
    "reading": "DataFrame, схема и типы которого соответствуют параметрам чтения.",
    "columns": "Series для одной метки или DataFrame для списка меток.",
    "change-columns": "DataFrame с созданным или обновлённым столбцом.",
    "vectorization": "Series с результатом для каждой метки индекса.",
    "attributes": "Кортеж размеров, число или логическое значение проверки формы.",
    "inspection": "Фрагмент исходного объекта с сохранёнными столбцами и индексом.",
    "dataframe-methods": "Скаляр или Series агрегированных сумм.",
    "series-methods": "Series, где индекс содержит значения, а данные — их частоты или доли.",
    "groupby": "Series или DataFrame с одним итогом на каждую группу.",
    "filtering": "DataFrame только со строками, удовлетворяющими условию.",
    "sorting": "Новый DataFrame с упорядоченными строками.",
    "merge": "DataFrame с сопоставленными столбцами обеих таблиц.",
    "pivot": "Сводный DataFrame с агрегированными значениями.",
    "dtypes": "Объект той же формы с новым dtype.",
    "datetime": "DatetimeIndex, datetime-Series или Series календарных компонентов.",
    "recipes": "Объект той же формы с заполненными пропусками.",
    "pandas-plots": "Объект Matplotlib Axes с построенным графиком.",
    "seaborn": "Axes со столбцами, рассчитанными по категориям.",
    "matplotlib": "Axes с одной или несколькими линиями.",
}


START_ARTICLE_PARAGRAPHS = {
    "overview": [
        "DataFrame — основная двумерная структура pandas. Внешне он похож на таблицу: каждая строка представляет наблюдение, каждый столбец хранит отдельный признак, а индекс однозначно обозначает строки. В отличие от обычного списка списков, столбцы имеют имена и собственные типы данных, поэтому к ним можно обращаться напрямую и применять векторные операции.",
        "Конструктор pd.DataFrame() используют, когда исходные данные уже находятся в памяти Python: пришли из API как записи, рассчитаны в списках, собраны в словарь или представлены несколькими Series. От выбранной формы входа зависит, что pandas сочтёт строками, что столбцами и откуда возьмёт их метки.",
    ],
    "idea": [
        "DataFrame всегда должен иметь прямоугольную форму. В каждой строке одинаковое число ячеек, а каждый столбец содержит столько значений, сколько в таблице строк. Если словарь содержит списки разной длины, pandas не может достроить отсутствующие позиции автоматически и сообщает ValueError.",
        "Индекс не является порядковым номером строки в строгом смысле. Это набор меток, используемых для выбора и выравнивания данных. Если index не передан, создаётся RangeIndex 0, 1, 2 и далее. Явный индекс полезен для естественных идентификаторов, но его длина обязана совпадать с числом строк.",
        "Столбцы тоже являются индексом. Аргумент columns может задавать имена для безымянных двумерных данных, менять порядок полей словаря или отбирать только нужные поля. Поэтому columns влияет не только на подписи, но и на итоговую схему таблицы.",
    ],
    "syntax": [
        "Общий вызов имеет вид pd.DataFrame(data=None, index=None, columns=None, dtype=None). data задаёт значения, index — метки строк, columns — имена и порядок столбцов, dtype при необходимости принудительно задаёт общий тип. Обычно достаточно передать data, а остальные аргументы добавляют только для управления схемой.",
        "Словарь списков читается по столбцам: ключи становятся именами, значения — содержимым столбцов. Это самый прозрачный формат, когда данные уже организованы по признакам.",
    ],
    "applications": [
        "Список словарей устроен наоборот: каждый словарь описывает одну строку. Набор ключей может различаться, и отсутствующие поля будут заполнены NaN. Такой формат типичен для JSON-ответов и записей из API.",
        "Список строк или кортежей не содержит имён полей. Передайте columns, чтобы связать каждую позицию с понятным именем. Число названий должно точно совпадать с шириной каждой строки.",
        "DataFrame.from_records() явно сообщает, что вход состоит из записей. Он особенно удобен для списка словарей, кортежей и структурированных массивов; для обычных учебных данных результат часто совпадает с pd.DataFrame(records).",
        "Словарь Series сохраняет смысл индексов: pandas объединяет метки всех Series и выравнивает значения. Это полезно для согласования данных, но несовпадающие индексы создают пропуски, которые необходимо заметить и обработать.",
    ],
    "parameters": [
        "columns управляет схемой результата. Для словаря он может изменить порядок или оставить подмножество ключей; для списка строк задаёт имена позициям. Передача неизвестного столбца при создании из словаря создаёт пустой столбец с NaN.",
        "index задаёт метки строк. Хороший индекс стабилен и однозначно идентифицирует наблюдение, однако далеко не всякий id нужно немедленно превращать в индекс: обычный столбец проще объединять, экспортировать и проверять.",
        "Пустой DataFrame можно создать с заранее заданными columns. Это фиксирует схему, но типы пустых столбцов часто требуют отдельной настройки перед наполнением.",
    ],
}


def build_article(topic: dict, entries: list[dict]) -> dict:
    guide = ARTICLE_GUIDES[topic["slug"]]
    expected = RESULT_GUIDES[topic["slug"]]
    all_ids = [entry["id"] for entry in entries]
    examples = []
    seen_examples = set()
    for entry in entries:
        if entry["example"] in seen_examples:
            continue
        seen_examples.add(entry["example"])
        examples.append({"code": entry["example"], "result": expected, "explanation": entry["description"]})
    parameter_entries = [entry for entry in entries if "=" in entry["name"]]
    paragraphs = START_ARTICLE_PARAGRAPHS if topic["slug"] == "start" else {}
    return {
        "lead": guide["purpose"],
        "sections": [
            {"id":"article-overview","title":"Что изучаем","paragraphs":paragraphs.get("overview", [guide["purpose"], f"Тема «{topic['title']}» нужна для осознанной подготовки данных перед дальнейшим анализом и визуализацией."]),"covers":[],"syntax":None,"examples":[],"errors":[],"nuances":[]},
            {"id":"article-core","title":"Основная идея","paragraphs":paragraphs.get("idea", [guide["idea"], "Важно заранее понимать форму входа, правила сопоставления меток и тип возвращаемого объекта: это позволяет предсказать результат до запуска кода."]),"covers":[],"syntax":None,"examples":[],"errors":[],"nuances":[]},
            {"id":"article-syntax","title":"Базовый синтаксис","paragraphs":paragraphs.get("syntax", [f"Базовая запись темы: {topic['syntax']}. Начните с минимального вызова и добавляйте параметры только для конкретного поведения."]),"covers":all_ids[:1],"syntax":entries[0]["example"],"examples":examples[:1],"errors":[],"nuances":[]},
            {"id":"article-applications","title":"Основные способы применения","paragraphs":paragraphs.get("applications", ["Связанные приёмы ниже решают одну общую задачу, но отличаются формой входа, формой результата или правилами обработки пограничных значений.", "Сравнивайте не только синтаксис: обращайте внимание на индекс, порядок, типы и то, сохраняется ли двумерная форма."]),"covers":all_ids,"syntax":None,"examples":examples,"errors":[],"nuances":[]},
            {"id":"article-parameters","title":"Важные параметры","paragraphs":paragraphs.get("parameters", ["Именованные параметры делают поведение явным и воспроизводимым. Особенно важно фиксировать параметры, влияющие на схему, порядок, пропуски и типы данных.", *[f"Приём {entry['name']} следует указывать явно, когда требуется управлять соответствующим вариантом поведения." for entry in parameter_entries]]),"covers":[entry["id"] for entry in parameter_entries],"syntax":None,"examples":[],"errors":[],"nuances":[]},
            {"id":"article-choice","title":"Как выбрать подходящий способ","paragraphs":[guide["choice"], "Выбирайте самый простой вариант, который явно сохраняет необходимую форму результата. Если два вызова дают похожий вывод, сравните их поведение на пропусках, несовпадающих индексах и пустых данных."],"covers":[],"syntax":None,"examples":[],"errors":[],"nuances":[]},
            {"id":"article-errors","title":"Типичные ошибки","paragraphs":["Ошибку полезно разбирать как конкретную пару: проблемный вызов, причина и исправленный код."],"covers":[],"syntax":None,"examples":[],"errors":[{"wrongCode":wrong,"why":why,"correctCode":correct} for wrong,why,correct in guide["errors"]],"nuances":[]},
            {"id":"article-nuances","title":"Практические нюансы","paragraphs":["Эти детали влияют на корректность результата даже тогда, когда код выполняется без исключений."],"covers":[],"syntax":None,"examples":[],"errors":[],"nuances":guide["nuances"]},
            {"id":"article-summary","title":"Краткий итог","paragraphs":[f"Теперь вы можете объяснить механизм темы «{topic['title']}», выбрать подходящий вариант, настроить важные параметры и заранее определить форму результата.", f"Материал охватывает {len(entries)} основных приёмов; закрепите различия между ними в связанных упражнениях."],"covers":[],"syntax":None,"examples":[],"errors":[],"nuances":[]},
        ],
        "summary": f"Вы изучили тему «{topic['title']}» и можете перейти к практике, выбирая способ по форме данных и требуемому результату.",
    }


def build_unit(topic: dict, theory: dict, old: dict | None = None) -> dict:
    task_ids = [exercise["id"] for exercise in topic["exercises"]]
    calls = list(dict.fromkeys(call for exercise in topic["exercises"] for call in code_calls(exercise["solution_code"])))
    concepts = list(dict.fromkeys([topic.get("syntax", ""), *topic.get("methods", [])]))
    articles=[theory[f"theory-{task_id}"] for task_id in task_ids]
    unique_methods={}
    for article in articles:
        for method in article.get("methods",[]):
            unique_methods.setdefault(method["name"],method)
    method_items=[]
    for index,method in enumerate(unique_methods.values(),1):
        method_items.append({
            "id":f"method-{index}","name":method["name"],"description":method["description"],
            "syntax":method["syntax"],"example":method["example"],"parameters":method.get("keyParameters",[]),
            "result":method.get("parameterGuide",""),"errors":method.get("notes",[])[:1],
            "nuances":method.get("notes",[])[1:],"documentationUrl":method["documentationUrl"],
        })
    category="Seaborn" if topic["slug"]=="seaborn" else "Matplotlib" if topic["slug"]=="matplotlib" else "pandas"
    documentation=[{"label":method["documentationLabel"],"url":method["documentationUrl"]} for method in unique_methods.values()]
    cheat_entries = build_cheat_entries(topic, theory)
    return {
        "id": f"ku-{topic['slug']}",
        "slug":topic["slug"],
        "title": "Создание таблиц" if topic["slug"] == "start" else topic["title"],
        "description":topic["summary"],
        "category":category,
        "topicId": str(topic["id"]),
        "sourceTitle": (old or {}).get("sourceTitle", "KODA Practice task bank"),
        "sourceVersion": (old or {}).get("sourceVersion", "2"),
        "concepts": [item for item in concepts if item],
        "methods": calls,
        "functions": [name for name in calls if name in {"read_csv", "merge", "to_datetime", "barplot", "subplots"}],
        "attributes": [name for name in ("shape", "index", "columns", "dtypes", "dt") if any(name in exercise["solution_code"] for exercise in topic["exercises"])],
        "operators": [operator for operator in ("+", "-", "*", "/", "==", ">", "<") if any(operator in exercise["solution_code"] for exercise in topic["exercises"])],
        "keywords":list(dict.fromkeys([topic["title"],topic["slug"],*calls,*topic.get("methods",[])])),
        "cheatSheet":{"entries": cheat_entries},
        "article": build_article(topic, cheat_entries),
        "documentationLinks":documentation,
        "relatedTaskIds":task_ids,
        "version":1,
        "theoryArticleIds": [f"theory-{task_id}" for task_id in task_ids],
        "taskIds": task_ids,
        "createdAt": (old or {}).get("createdAt", CREATED_AT),
        "updatedAt": (old or {}).get("updatedAt", CREATED_AT),
    }


def sync() -> None:
    catalog = load_json(CATALOG_PATH)
    theory = load_json(THEORY_PATH)["articles"]
    previous = {unit["id"]: unit for unit in load_json(UNITS_PATH).get("units", [])} if UNITS_PATH.exists() else {}
    units = []
    for topic in topics(catalog):
        unit = build_unit(topic, theory, previous.get(f"ku-{topic['slug']}"))
        units.append(unit)
        for exercise in topic["exercises"]:
            article = theory[f"theory-{exercise['id']}"]
            exercise["knowledge_unit_id"] = unit["id"]
            exercise["concepts"] = list(dict.fromkeys([exercise["focus"], *topic.get("methods", [])]))
            exercise["required_methods"] = code_calls(exercise["solution_code"])
            exercise["documentation_urls"] = theory_urls(article)
    write_json(CATALOG_PATH, catalog)
    write_json(UNITS_PATH, {"version": 1, "units": units})
    print(f"CONTENT SYNC PASSED: {len(units)} knowledge units and {len(exercises(catalog))} linked tasks")


def extract_source(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    dotted = re.findall(r"\b(?:pd|sns|plt|np)\.([A-Za-z_][A-Za-z0-9_]*)", text)
    methods = re.findall(r"\.([A-Za-z_][A-Za-z0-9_]*)\s*\(", text)
    params = re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*=", text)
    headings = [match.strip() for match in re.findall(r"^#{1,4}\s+(.+)$", text, flags=re.MULTILINE)]
    return {
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "headings": headings,
        "methodsAndFunctions": sorted(set(dotted + methods)),
        "parameters": sorted(set(params)),
        "lineCount": len(text.splitlines()),
    }


def inspect_source(source: Path, source_title: str | None) -> None:
    inventory = extract_source(source)
    catalog = load_json(CATALOG_PATH)
    covered = defaultdict(list)
    for exercise in exercises(catalog):
        for method in code_calls(exercise["solution_code"]):
            covered[method].append(exercise["id"])
    inventory["sourceTitle"] = source_title or source.stem
    inventory["coverage"] = {
        method: {"status": "covered" if covered[method] else "new", "taskIds": covered[method]}
        for method in inventory["methodsAndFunctions"]
    }
    REPORTS.mkdir(exist_ok=True)
    target = REPORTS / f"content-inspection-{source.stem}.json"
    write_json(target, inventory)
    print(f"CONTENT INSPECTION WRITTEN: {target.relative_to(ROOT)}")


def audit() -> None:
    catalog = load_json(CATALOG_PATH)
    theory = load_json(THEORY_PATH)["articles"]
    units = load_json(UNITS_PATH).get("units", []) if UNITS_PATH.exists() else []
    task_by_id = {exercise["id"]: exercise for exercise in exercises(catalog)}
    errors = []
    banned_article_phrases = (
        "в этой задаче", "в данном задании", "вариант 1", "подготовленный объект",
        "переменной result", "присвойте результат",
    )
    required_task_fields = {
        "knowledge_unit_id", "learning_objective", "concepts", "required_methods", "setup_code",
        "starter_code", "solution_code", "tests", "hints", "completion_summary",
        "theory_article_id", "documentation_urls",
    }
    if len(units) != len(topics(catalog)):
        errors.append(f"expected {len(topics(catalog))} knowledge units, got {len(units)}")
    unit_ids = [unit["id"] for unit in units]
    unit_slugs = [unit.get("slug") for unit in units]
    if len(unit_ids) != len(set(unit_ids)):
        errors.append("knowledge unit IDs are not unique")
    if len(unit_slugs) != len(set(unit_slugs)) or any(not slug for slug in unit_slugs):
        errors.append("knowledge unit slugs are missing or duplicated")
    objectives = Counter(exercise["learning_objective"] for exercise in task_by_id.values())
    for objective, count in objectives.items():
        if count > 1:
            errors.append(f"duplicate learning objective ({count}): {objective}")
    for unit in units:
        entries = unit.get("cheatSheet",{}).get("entries", [])
        sections = unit.get("article",{}).get("sections", [])
        if not entries or not sections:
            errors.append(f"{unit['id']}: cheat sheet and article must be non-empty")
        if not unit.get("documentationLinks") or not unit.get("relatedTaskIds"):
            errors.append(f"{unit['id']}: documentation and related tasks are required")
        entry_signatures = []
        article_text = json.dumps(unit.get("article", {}), ensure_ascii=False)
        for entry in entries:
            missing = [key for key in ("id", "group", "name", "kind", "description", "example") if not entry.get(key)]
            if missing:
                errors.append(f"{unit['id']}: cheat entry is missing {missing}")
                continue
            description = entry["description"].strip()
            sentence_ends = re.findall(r"[!?](?=\s|$)|\.(?=\s+[А-ЯA-ZЁ]|$)", description)
            if len(sentence_ends) > 1 or len(description) > 180:
                errors.append(f"{unit['id']}/{entry['id']}: description must be one short sentence")
            if len(entry["example"].splitlines()) > 3:
                errors.append(f"{unit['id']}/{entry['id']}: example exceeds three lines")
            signature = (entry["name"].strip().casefold(), entry["example"].strip())
            entry_signatures.append(signature)
            parsed = urlparse(entry.get("documentationUrl", ""))
            if parsed.scheme != "https" or parsed.hostname not in ALLOWED_DOC_HOSTS:
                errors.append(f"{unit['id']}/{entry['id']}: invalid official documentation URL")
            if description and description in article_text and len(description) > 120:
                errors.append(f"{unit['id']}/{entry['id']}: cheat sheet contains article prose")
        if len(entry_signatures) != len(set(entry_signatures)):
            errors.append(f"{unit['id']}: duplicate cheat-sheet entries")
        if not unit.get("article",{}).get("lead") or not unit.get("article",{}).get("summary"):
            errors.append(f"{unit['id']}: detailed article content was lost")
        article = unit.get("article", {})
        if len(sections) < 7:
            errors.append(f"{unit['id']}: article needs at least seven substantive sections")
        lowered_article = article_text.casefold()
        for phrase in banned_article_phrases:
            if phrase in lowered_article:
                errors.append(f"{unit['id']}: task-specific phrase in article: {phrase}")
        section_ids = [section.get("id") for section in sections]
        if len(section_ids) != len(set(section_ids)) or any(not item for item in section_ids):
            errors.append(f"{unit['id']}: article section IDs are missing or duplicated")
        covered = {entry_id for section in sections for entry_id in section.get("covers", [])}
        missing_coverage = {entry["id"] for entry in entries} - covered
        if missing_coverage:
            errors.append(f"{unit['id']}: article misses cheat entries {sorted(missing_coverage)}")
        if any(not section.get("paragraphs") for section in sections):
            errors.append(f"{unit['id']}: article contains an empty/formal section")
        article_examples = [example for section in sections for example in section.get("examples", [])]
        distinct_cheat_examples = {entry["example"] for entry in entries}
        if len(article_examples) < min(6, len(distinct_cheat_examples)):
            errors.append(f"{unit['id']}: article relies on too few examples")
        for example in article_examples:
            if not isinstance(example, dict) or not example.get("code") or not example.get("result"):
                errors.append(f"{unit['id']}: article example lacks code or expected result")
        error_sections = [section for section in sections if section.get("id") == "article-errors"]
        concrete_errors = [item for section in error_sections for item in section.get("errors", [])]
        if not concrete_errors or any(not all(item.get(key) for key in ("wrongCode", "why", "correctCode")) for item in concrete_errors):
            errors.append(f"{unit['id']}: typical errors need wrong code, reason, and correction")
        prose = " ".join(paragraph for section in sections for paragraph in section.get("paragraphs", []))
        if any(entry["description"] in prose for entry in entries):
            errors.append(f"{unit['id']}: article duplicates cheat-sheet descriptions")
        if len({example.get("code") for example in article_examples}) < min(6, len(distinct_cheat_examples)):
            errors.append(f"{unit['id']}: article examples are predominantly duplicated")
        for link in unit.get("documentationLinks",[]):
            parsed=urlparse(link.get("url",""))
            if parsed.hostname not in ALLOWED_DOC_HOSTS:
                errors.append(f"{unit['id']}: invalid knowledge documentation URL")
        for task_id in unit.get("taskIds", []):
            if task_id not in task_by_id:
                errors.append(f"{unit['id']}: missing task {task_id}")
            elif task_by_id[task_id].get("knowledge_unit_id") != unit["id"]:
                errors.append(f"{task_id}: incorrect knowledge unit link")
        for article_id in unit.get("theoryArticleIds", []):
            if article_id not in theory:
                errors.append(f"{unit['id']}: missing theory {article_id}")
    structural = defaultdict(list)
    for task in task_by_id.values():
        missing = sorted(required_task_fields - set(task))
        if missing:
            errors.append(f"{task['id']}: missing {missing}")
        if len(task.get("hints", [])) != 3:
            errors.append(f"{task['id']}: must have exactly three hints")
        if task.get("theory_article_id") not in theory:
            errors.append(f"{task['id']}: invalid theory link")
        if set(task.get("documentation_urls", [])) != set(theory_urls(theory.get(task.get("theory_article_id"), {}))):
            errors.append(f"{task['id']}: documentation links differ from theory")
        for url in task.get("documentation_urls", []):
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname not in ALLOWED_DOC_HOSTS or len(parsed.path.strip("/").split("/")) < 2:
                errors.append(f"{task['id']}: invalid documentation URL {url}")
        structural[normalized_solution(task["solution_code"])].append(task["id"])
    duplicate_candidates = [ids for ids in structural.values() if len(ids) > 1]
    if errors:
        print("\n".join(errors))
        raise SystemExit(f"CONTENT PIPELINE AUDIT FAILED: {len(errors)} errors")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "audit_task_bank.py")], cwd=ROOT, check=True)
    REPORTS.mkdir(exist_ok=True)
    write_json(REPORTS / "content-pipeline-audit.json", {
        "knowledgeUnits": len(units),
        "tasks": len(task_by_id),
        "theoryArticles": len(theory),
        "duplicateCandidatesReviewed": duplicate_candidates,
        "status": "passed",
    })
    print(f"CONTENT PIPELINE AUDIT PASSED: {len(units)} units, {len(task_by_id)} tasks, {len(theory)} theory articles")


def main() -> None:
    parser = argparse.ArgumentParser(description="KODA Practice Content Pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("sync")
    subparsers.add_parser("audit")
    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--source", type=Path, required=True)
    inspect_parser.add_argument("--source-title")
    args = parser.parse_args()
    if args.command == "sync": sync()
    elif args.command == "audit": audit()
    else: inspect_source(args.source, args.source_title)


if __name__ == "__main__":
    main()
