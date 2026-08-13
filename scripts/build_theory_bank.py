"""Build and persist the reviewed per-exercise theory bank."""
import ast,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'content/catalog.json'
TARGET=ROOT/'content/theory_bank.json'

TOPICS={
'start':('Создание DataFrame','Конструктор DataFrame превращает словарь, записи или двумерные строки в таблицу. Форма входа определяет строки и столбцы, а явные columns и index управляют схемой и метками. Перед созданием полезно проверить одинаковую длину столбцов и соответствие числа названий ширине строк.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html'),
'reading':('Чтение CSV','read_csv читает текстовый табличный файл и возвращает DataFrame. Разделитель, заголовок, имена столбцов, индекс, типы, даты и обозначения пропусков задаются параметрами чтения. Эти параметры лучше задавать явно, когда формат файла отличается от стандартного CSV.','https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html'),
'columns':('Выбор столбцов','Квадратные скобки выбирают данные по именам столбцов. Одно имя обычно возвращает Series, а список имён — DataFrame; порядок и повторы в списке сохраняются. Это различие влияет на размерность результата и дальнейшие доступные методы.','https://pandas.pydata.org/docs/user_guide/indexing.html'),
'change-columns':('Создание столбцов','Присваивание по имени создаёт или заменяет столбец. Выражение справа вычисляется векторно и выравнивается по индексу, поэтому циклы обычно не нужны. Копия таблицы защищает исходный объект, если условие требует сохранить входные данные.','https://pandas.pydata.org/docs/getting_started/intro_tutorials/05_add_columns.html'),
'vectorization':('Векторные операции','Арифметические операторы применяются сразу ко всем значениям Series. При операциях двух Series pandas выравнивает их по индексам; методы add и mul позволяют дополнительно управлять отсутствующими метками. Сравнение возвращает логическую Series.','https://pandas.pydata.org/docs/user_guide/dsintro.html#vectorized-operations-and-label-alignment-with-series'),
'attributes':('Размерность DataFrame','Атрибут shape возвращает кортеж из числа строк и числа столбцов. Это атрибут, поэтому круглые скобки не используются. Компоненты кортежа можно выбирать индексами 0 и 1, сравнивать и использовать в вычислениях.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.shape.html'),
'inspection':('Просмотр строк','Методы head и tail возвращают первые или последние строки без изменения исходной таблицы. Параметр n задаёт количество строк, а ноль позволяет получить пустой DataFrame с сохранённой схемой. Индекс и порядок столбцов сохраняются.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.head.html'),
'dataframe-methods':('Агрегация sum','Метод sum складывает значения Series или DataFrame. Для таблицы axis определяет направление вычисления, а skipna и min_count управляют пропусками и минимальным числом значений. Логические True и False при суммировании ведут себя как единица и ноль.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.sum.html'),
'series-methods':('Подсчёт частот','value_counts считает частоту каждого уникального значения Series. Параметры управляют пропусками, нормализацией, сортировкой, направлением порядка и разбиением чисел на интервалы. Результат — Series, индекс которой содержит исходные значения или интервалы.','https://pandas.pydata.org/docs/reference/api/pandas.Series.value_counts.html'),
'groupby':('Группировка и агрегация','groupby разбивает строки на группы по одному или нескольким ключам, после чего к выбранным столбцам применяется агрегация. Ключи обычно становятся индексом результата; as_index=False сохраняет их обычными столбцами. sort и dropna меняют порядок и обработку пустых ключей.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html'),
'filtering':('Фильтрация через query','query отбирает строки по строковому выражению. Имена столбцов используются внутри выражения напрямую, внешние Python-переменные отмечаются символом @, а имена с пробелами заключаются в обратные кавычки. Результат сохраняет строки, для которых условие истинно.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.query.html'),
'sorting':('Сортировка значений','sort_values упорядочивает строки по одному или нескольким столбцам. ascending задаёт направление отдельно для каждого ключа, na_position размещает пропуски, ignore_index создаёт новый последовательный индекс. Стабильная сортировка сохраняет порядок равных элементов.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.sort_values.html'),
'merge':('Соединение таблиц','merge соединяет строки таблиц по общим ключам или индексам. how определяет множество сохраняемых ключей, on и left_on/right_on выбирают поля связи. suffixes различает одноимённые столбцы, indicator показывает источник строки, validate проверяет ожидаемую кратность связи.','https://pandas.pydata.org/docs/reference/api/pandas.merge.html'),
'pivot':('Сводная таблица','pivot_table группирует данные по полям index и columns и агрегирует values. aggfunc определяет вычисление, fill_value заменяет пустые ячейки, margins добавляет итоги. Результат часто имеет многоуровневый индекс или столбцы.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.pivot_table.html'),
'dtypes':('Преобразование типов','astype создаёт объект с явно заданным dtype. Для DataFrame можно передать словарь типов по столбцам. Nullable-типы вроде Int64 сохраняют пропуски, category хранит повторяющиеся категории компактно, а преобразование индекса выполняется отдельно.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.astype.html'),
'datetime':('Даты и время','to_datetime преобразует строки или числовые метки времени в datetime. format, dayfirst, unit и errors уточняют разбор. После преобразования аксессор dt даёт векторный доступ к году, месяцу, дню, кварталу и другим календарным компонентам.','https://pandas.pydata.org/docs/reference/api/pandas.to_datetime.html'),
'recipes':('Заполнение пропусков','fillna заменяет отсутствующие значения скаляром, словарём или вычисленным значением. ffill переносит предыдущее известное значение, bfill — следующее. limit ограничивает число замен; методы возвращают новый объект, если явно не запрошено изменение на месте.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.fillna.html'),
'pandas-plots':('Графики pandas','DataFrame.plot строит график через Matplotlib и возвращает объект Axes. x и y выбирают данные, kind — тип графика, title, figsize и marker управляют оформлением. Возвращённые оси нужно сохранить, если проверяется структура графика.','https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.plot.html'),
'seaborn':('Столбчатые графики Seaborn','barplot отображает оценку показателя по категориям. data задаёт таблицу, x и y связывают столбцы с осями, hue создаёт группы, estimator определяет агрегацию. order, hue_order, errorbar и dodge управляют порядком и представлением групп.','https://seaborn.pydata.org/generated/seaborn.barplot.html'),
'matplotlib':('Линейные графики Matplotlib','plot добавляет линии на объект Axes. Последовательности x и y задают координаты, а marker, linestyle, color, linewidth, alpha и label управляют видом. Заголовок задаётся методом осей; результатом задачи обычно служит сам Axes.','https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.plot.html'),
}

PARAMS={'columns':'задаёт имена или порядок столбцов','index':'задаёт метки строк','sep':'задаёт разделитель полей','header':'указывает строку заголовка','names':'задаёт собственные имена столбцов','usecols':'ограничивает читаемые столбцы','index_col':'выбирает столбец индекса','dtype':'фиксирует тип данных','parse_dates':'разбирает выбранные столбцы как даты','na_values':'добавляет обозначения пропусков','axis':'выбирает направление операции','skipna':'управляет пропуском пустых значений','min_count':'задаёт минимум непустых значений','dropna':'управляет учётом пропусков','normalize':'возвращает доли вместо количества','sort':'управляет сортировкой результата','ascending':'задаёт направление сортировки','bins':'разбивает числа на интервалы','as_index':'управляет размещением ключей группировки','how':'задаёт тип соединения','on':'задаёт общий ключ','left_on':'задаёт ключ левой таблицы','right_on':'задаёт ключ правой таблицы','suffixes':'задаёт суффиксы совпавших имён','indicator':'добавляет источник строки','validate':'проверяет кратность связи','aggfunc':'задаёт агрегирующую функцию','fill_value':'заполняет пустые ячейки','margins':'добавляет итоговые строки','format':'задаёт формат даты','errors':'задаёт поведение при ошибке','unit':'задаёт единицу timestamp','kind':'выбирает тип графика','x':'выбирает данные оси X','y':'выбирает данные оси Y','hue':'задаёт группировку цветом','order':'задаёт порядок категорий','errorbar':'управляет интервалами ошибки'}

EXAMPLES={
'start':"frame = pd.DataFrame({'item': ['A', 'B'], 'qty': [2, 5]})",
'reading':"report = pd.read_csv(report_path, sep=';')",
'columns':"names = people[['first_name', 'department']]",
'change-columns':"report = source.copy()\nreport['amount'] = report['price'] * report['units']",
'vectorization':"adjusted = measurements * scale",
'attributes':"column_count = inventory.shape[1]",
'inspection':"sample = events.head(4)",
'dataframe-methods':"total = metrics.sum(axis=1)",
'series-methods':"frequencies = colors.value_counts(dropna=False)",
'groupby':"totals = orders.groupby('region')['amount'].sum()",
'filtering':"selected = people.query('age >= @minimum_age')",
'sorting':"ordered = items.sort_values('cost', ascending=False)",
'merge':"joined = pd.merge(products, prices, on='product_id', how='left')",
'pivot':"matrix = sales.pivot_table(index='store', columns='month', values='amount', aggfunc='sum')",
'dtypes':"codes = raw_codes.astype('string')",
'datetime':"parsed = pd.to_datetime(raw_dates, errors='coerce')",
'recipes':"clean = temperatures.fillna(temperatures.median())",
'pandas-plots':"axes = metrics.plot(x='week', y='value', marker='o')",
'seaborn':"axes = sns.barplot(data=survey, x='group', y='rating', errorbar=None)",
'matplotlib':"fig, axes = plt.subplots()\naxes.plot(days, temperature, linestyle='--')",
}

def keywords(code):
    return list(dict.fromkeys(n.arg for n in ast.walk(ast.parse(code)) if isinstance(n,ast.keyword) and n.arg))

def method_name(code,focus):
    attrs=[n.attr for n in ast.walk(ast.parse(code)) if isinstance(n,ast.Attribute)]
    return attrs[-1] if attrs else focus

METHOD_DOCS={
    'sum':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.sum.html',
    'mean':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.mean.html',
    'reset_index':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.reset_index.html',
    'set_index':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.set_index.html',
    'rename':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.rename.html',
    'drop':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.drop.html',
    'groupby':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html',
    'sort_values':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.sort_values.html',
    'plot':'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.plot.html',
    'set_title':'https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.set_title.html',
}

def secondary_method(code,primary):
    calls=[n.func.attr for n in ast.walk(ast.parse(code)) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute)]
    return next((name for name in calls if name!=primary and name not in {'copy','DataFrame','Series','subplots'} and name in METHOD_DOCS),None)

def build():
    catalog=json.loads(CATALOG.read_text(encoding='utf-8'));articles={}
    exercises=[e for m in catalog['modules'] for t in m['topics'] for e in t['exercises']]
    for e in exercises:
        slug=e['id'].rsplit('-',1)[0];topic_title,core,url=TOPICS[slug];params=keywords(e['solution_code']);method=method_name(e['solution_code'],e['focus']);position=int(e['id'].rsplit('-',1)[1])
        param_text=' '.join(f"Параметр `{p}` {PARAMS.get(p,'уточняет поведение операции')}." for p in params) or 'В этой задаче достаточно базового вызова без дополнительных именованных параметров.'
        intro=f"Материал для задачи «{e['title']}» объясняет приём {e['focus']}. Нужно понимать форму входного объекта, тип возвращаемого результата и то, как операция сохраняет индекс, порядок или схему данных."
        description=(f"{core} Отдельно разберите приём {e['focus']}: проследите, какие входные данные он принимает, "
                     "какой тип возвращает и как его параметры влияют на индекс, столбцы или отображение результата.")
        notes=[f"Сначала мысленно определите тип и форму результата для варианта {position}.","Не изменяйте подготовленные входные объекты, если задача требует новый результат.","Проверьте, что итог присвоен переменной result и сохраняет требуемые метки."]
        article={'id':f"theory-{e['id']}",'title':f"Теория: {e['title']}",'introduction':intro,'methods':[{'name':method,'description':description,'syntax':f"{e['focus']}  # общий вид приёма",'keyParameters':[{'name':p,'description':PARAMS.get(p,'уточняет поведение операции')} for p in params],'parameterGuide':param_text,'example':EXAMPLES[slug],'notes':notes,'documentationUrl':url,'documentationLabel':f"Официальная документация: {topic_title}"}]}
        extra=secondary_method(e['solution_code'],method)
        if extra:
            article['methods'].append({'name':extra,'description':f"Метод {extra} — отдельный существенный шаг цепочки. Он получает результат предыдущей операции и преобразует его дальше; порядок вызовов важен, потому что тип промежуточного объекта определяет доступные параметры и итоговую форму.",'syntax':f"object.{extra}(...) ",'keyParameters':[],'parameterGuide':'Параметры этого шага выбирают после проверки типа промежуточного объекта.','example':EXAMPLES[slug],'notes':['Читайте цепочку слева направо и проверяйте результат каждого существенного шага.'],'documentationUrl':METHOD_DOCS[extra],'documentationLabel':f"Официальная документация: {extra}"})
        articles[article['id']]=article
    TARGET.write_text(json.dumps({'version':1,'articles':articles},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Создан банк теории: {len(articles)} статей')
if __name__=='__main__':build()
