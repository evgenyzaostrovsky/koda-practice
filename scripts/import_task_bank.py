"""Build the deterministic KODA catalog from content/task_bank.md."""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "task_bank.md"
TARGET = ROOT / "content" / "catalog.json"
EDITORIAL = ROOT / "content" / "task_editorial.json"


SOLUTIONS = {
"start": ["result = pd.DataFrame(data)", "result = pd.DataFrame.from_records(records)", "result = pd.DataFrame(rows, columns=column_names)", "result = pd.DataFrame(data, columns=column_order)", "result = pd.DataFrame(data, index=row_labels)", "result = pd.DataFrame.from_records(rows, columns=column_names)", "result = pd.DataFrame(columns=column_names)", "result = pd.DataFrame({'score': scores})", "result = pd.DataFrame(data, columns=column_order)", "result = pd.DataFrame(records, columns=column_order, index=row_labels)"],
"reading": ["result = pd.read_csv(csv_path)", "result = pd.read_csv(csv_path, sep=';')", "result = pd.read_csv(csv_path, sep='\\t')", "result = pd.read_csv(csv_path, header=None)", "result = pd.read_csv(csv_path, header=None, names=column_names)", "result = pd.read_csv(csv_path, usecols=needed_columns)", "result = pd.read_csv(csv_path, index_col='id')", "result = pd.read_csv(csv_path, dtype={'client_id': 'string'})", "result = pd.read_csv(csv_path, parse_dates=['date'])", "result = pd.read_csv(csv_path, na_values=['нет', '-'])"],
"columns": ["result = df['name']", "result = df[['name']]", "result = df[['name', 'score']]", "result = df[['score', 'name']]", "result = df[selected_columns]", "result = df[['price', 'quantity', 'discount']]", "result = df[selected_columns]", "result = df[['score', 'score']]", "result = df[['client name', 'total sales']]", "result = df[report_columns]"],
"change-columns": ["result = df.copy()\nresult['status'] = 'new'", "result = df.copy()\nresult['price_copy'] = result['price']", "result = df.copy()\nresult['total'] = result['online'] + result['offline']", "result = df.copy()\nresult['change'] = result['current'] - result['previous']", "result = df.copy()\nresult['revenue'] = result['price'] * result['quantity']", "result = df.copy()\nresult['unit_price'] = result['amount'] / result['quantity']", "result = df.copy()\nresult['discount_amount'] = result['price'] * result['discount_pct'] / 100", "result = df.copy()\nresult['is_expensive'] = result['price'] >= price_limit", "result = df.copy()\nresult['name'] = names", "result = df.copy()\nresult['net'] = result['price'] * result['quantity'] - result['discount']"],
"vectorization": ["result = values + offset", "result = values - offset", "result = values * factor", "result = values / divisor", "result = left + right", "result = left * right", "result = left + right", "result = left.add(right, fill_value=0)", "result = values >= threshold", "result = (prices * quantities) * (1 - discount_rate)"],
"attributes": ["result = df.shape", "result = df.shape[0]", "result = df.shape[1]", "result = df.shape[0] == expected_rows", "result = left.shape == right.shape", "result = orders.shape[0] + returns.shape[0]", "result = df.shape[0] * df.shape[1]", "result = df.shape[1]", "result = train.shape[0] > test.shape[0]", "result = {'rows': df.shape[0], 'columns': df.shape[1]}"],
"inspection": ["result = df.head()", "result = df.head(3)", "result = df.head(1)", "result = df.head(n)", "result = df.head(0)", "result = df.tail()", "result = df.tail(2)", "result = df.tail(1)", "result = df.tail(n)", "result = df.head(n)"],
"dataframe-methods": ["result = values.sum()", "result = df['sales'].sum()", "result = values.sum()", "result = values.sum()", "result = values.sum(skipna=True)", "result = values.sum(skipna=False)", "result = values.sum(min_count=min_required)", "result = df.sum()", "result = df.sum(axis=1)", "result = flags.sum()"],
"series-methods": ["result = values.value_counts()", "result = values.value_counts()", "result = values.value_counts()", "result = values.value_counts()", "result = values.value_counts(dropna=False)", "result = values.value_counts(normalize=True)", "result = values.value_counts(sort=False)", "result = values.value_counts(ascending=True)", "result = values.value_counts(bins=bin_count)", "result = values.value_counts(dropna=False)"],
"groupby": ["result = df.groupby('category')['sales'].sum()", "result = df.groupby('city')['revenue'].sum()", "result = df.groupby('team')['points'].sum()", "result = df.groupby('category')[['sales', 'profit']].sum()", "result = df.groupby(['city', 'category'])['sales'].sum()", "result = df.groupby('category', as_index=False)['sales'].sum()", "result = df.groupby('category', sort=False)['sales'].sum()", "result = df.groupby('category', dropna=False)['sales'].sum()", "result = df.groupby('category')['sales'].sum(min_count=1)", "result = df.groupby('team')['won'].sum()"],
"filtering": ["result = df.query('score > 80')", "result = df.query('score >= 60')", "result = df.query(\"city == 'Москва'\")", "result = df.query(\"status != 'closed'\")", "result = df.query('score >= 60 and attempts <= 2')", "result = df.query(\"city == 'Москва' or city == 'Казань'\")", "result = df.query('score >= @min_score')", "result = df.query('city in @allowed_cities')", "result = df.query('`total sales` > 1000')", "result = df.query('price >= @min_price and price <= @max_price')"],
"sorting": ["result = df.sort_values('score')", "result = df.sort_values('score', ascending=False)", "result = df.sort_values('name')", "result = df.sort_values(['city', 'score'])", "result = df.sort_values(['city', 'score'], ascending=[True, False])", "result = df.sort_values('score', na_position='first')", "result = df.sort_values('score', ignore_index=True)", "result = df.sort_values('name', key=lambda s: s.str.lower())", "result = df.sort_values('score', kind='stable')", "result = df.sort_values(['priority', 'created_at'], ascending=[False, True])"],
"merge": ["result = pd.merge(left, right, on='id')", "result = pd.merge(left, right, on='id', how='left')", "result = pd.merge(left, right, on='id', how='right')", "result = pd.merge(left, right, on='id', how='outer')", "result = pd.merge(left, right, left_on='client_id', right_on='id')", "result = pd.merge(left, right, on=['city', 'year'])", "result = pd.merge(left, right, on='id', suffixes=('_old', '_new'))", "result = pd.merge(left, right, on='id', how='outer', indicator=True)", "result = pd.merge(left, right, on='category_id', validate='many_to_one')", "result = pd.merge(left, right, left_index=True, right_index=True)"],
"pivot": ["result = df.pivot_table(index='city', values='sales')", "result = df.pivot_table(index='city', values='sales', aggfunc='sum')", "result = df.pivot_table(index='city', columns='category', values='sales', aggfunc='sum')", "result = df.pivot_table(index=['city', 'year'], values='sales', aggfunc='sum')", "result = df.pivot_table(index='city', values=['sales', 'profit'], aggfunc='sum')", "result = df.pivot_table(index='city', columns='category', values='sales', aggfunc='sum', fill_value=0)", "result = df.pivot_table(index='city', values='sales', aggfunc='sum', margins=True)", "result = df.pivot_table(index='city', values='sales', aggfunc='sum', margins=True, margins_name=total_label)", "result = df.pivot_table(index='city', values='sales', aggfunc='sum', sort=False)", "result = df.pivot_table(index='city', columns='category', values='sales', aggfunc='sum', observed=False)"],
"dtypes": ["result = values.astype('int64')", "result = values.astype('float64')", "result = values.astype('string')", "result = values.astype('bool')", "result = df.copy()\nresult['score'] = result['score'].astype('int64')", "result = df.astype({'count': 'int64', 'price': 'float64'})", "result = values.astype('category')", "result = values.astype('Int64')", "result = df.copy()\nresult.index = result.index.astype('string')", "result = values.astype('string')"],
"datetime": ["result = pd.to_datetime(dates)", "result = pd.to_datetime(dates, dayfirst=True)", "result = pd.to_datetime(dates, format=date_format)", "result = pd.to_datetime(dates, errors='coerce')", "result = pd.to_datetime(timestamps, unit='s')", "result = dates.dt.year", "result = dates.dt.month", "result = dates.dt.day", "result = dates.dt.day_name()", "result = dates.dt.quarter"],
"recipes": ["result = values.fillna(0)", "result = cities.fillna('Неизвестно')", "result = scores.fillna(fill_value)", "result = df.copy()\nresult['discount'] = result['discount'].fillna(0)", "result = df.copy()\nresult['age'] = result['age'].fillna(result['age'].mean())", "result = df.copy()\nresult['salary'] = result['salary'].fillna(result['salary'].median())", "result = df.fillna({'city': 'Неизвестно', 'score': 0})", "result = prices.ffill()", "result = prices.bfill()", "result = values.fillna(0, limit=fill_limit)"],
"pandas-plots": ["result = df.plot()", "result = df.plot(y='sales')", "result = df.plot(x='date', y='sales')", "result = df.plot(x='category', y='sales', kind='bar')", "result = df.plot(x='category', y='sales', kind='barh')", "result = df.plot(y='score', kind='hist')", "result = df.plot(y='sales', title=chart_title)", "result = df.plot(y='sales', figsize=figure_size)", "result = df.plot(y='sales', marker='o')", "result = df.plot(x='month', y=['plan', 'fact'])"],
"seaborn": ["result = sns.barplot(data=df, x='category', y='sales')", "result = sns.barplot(data=df, x='category', y='sales', estimator='sum')", "result = sns.barplot(data=df, x='category', y='sales', color=bar_color)", "result = sns.barplot(data=df, x='category', y='sales', hue='region')", "result = sns.barplot(data=df, x='category', y='sales', order=category_order)", "result = sns.barplot(data=df, x='category', y='sales', hue='region', hue_order=region_order)", "result = sns.barplot(data=df, x='category', y='sales', errorbar=None)", "result = sns.barplot(data=df, x='sales', y='category')", "result = sns.barplot(data=df, x='category', y='sales', hue='region', dodge=False)", "result = sns.barplot(data=df, x='status', y='amount', estimator='sum', order=status_order)"],
"matplotlib": ["fig, ax = plt.subplots()\nax.plot(y)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, marker='o')\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, linestyle='--')\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, color=line_color)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, linewidth=line_width)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, alpha=line_alpha)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y, label=series_label)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, plan)\nax.plot(x, fact)\nresult = ax", "fig, ax = plt.subplots()\nax.plot(x, y)\nax.set_title(chart_title)\nresult = ax"],
}


def series(name, values, index=None):
    spec = {"data": values}
    if index is not None: spec["index"] = index
    return {"series": {name: spec}}


def py(value):
    return repr(value)


def setup_code(data, slug):
    lines=["import pandas as pd"]
    if slug=="seaborn": lines.append("import seaborn as sns")
    if slug in {"pandas-plots","matplotlib"}: lines.append("import matplotlib.pyplot as plt")
    for name,value in data.get("variables",{}).items():
        lines.append(f"{name} = {py(value)}")
    for name,spec in data.get("series",{}).items():
        args=[py(spec.get("data",[]))]
        if spec.get("index") is not None: args.append(f"index={py(spec['index'])}")
        if spec.get("name") is not None: args.append(f"name={py(spec['name'])}")
        if spec.get("dtype") is not None: args.append(f"dtype={py(spec['dtype'])}")
        lines.append(f"{name} = pd.Series({', '.join(args)})")
    for name,value in data.items():
        if name not in {"variables","series","files"}:
            lines.append(f"{name} = pd.DataFrame({py(value)})")
    return "\n".join(lines)


def available_names(data):
    return list(data.get("variables",{}))+list(data.get("series",{}))+[k for k in data if k not in {"variables","series","files"}]


NUANCES={
 "start":"В конструкторе важны форма входных данных, одинаковая длина столбцов и явный порядок меток.",
 "reading":"`pd.read_csv()` возвращает DataFrame; параметры чтения должны соответствовать реальному формату файла.",
 "columns":"Одинарные скобки возвращают Series, а список имён — DataFrame с сохранённым порядком.",
 "change-columns":"Работа через копию защищает исходный DataFrame от случайного изменения.",
 "vectorization":"Векторные операции учитывают индекс Series и обычно не требуют циклов.",
 "attributes":"Атрибуты формы описывают объект и не вызываются как методы.",
 "inspection":"`head()` и `tail()` сохраняют исходные столбцы и индекс выбранных строк.",
 "dataframe-methods":"Агрегации учитывают ось вычисления и правила обработки пропусков.",
 "series-methods":"Результат метода Series сохраняет метки и может менять порядок значений.",
 "groupby":"Группировка сначала разбивает строки по ключу, затем агрегирует выбранные столбцы.",
 "filtering":"Условие фильтра должно возвращать только нужные строки, не меняя исходную таблицу.",
 "sorting":"Параметры сортировки определяют направление, стабильность и положение пропусков.",
 "merge":"Тип соединения определяет, какие ключи и строки останутся в результате.",
 "pivot":"Сводная таблица группирует значения по строкам и столбцам, применяя выбранную агрегацию.",
 "dtypes":"Преобразование типа может изменить допустимые значения и способ представления пропусков.",
 "datetime":"Параметры парсинга определяют формат, единицы времени и обработку ошибок.",
 "recipes":"Методы очистки возвращают новый объект, если результат явно не записан обратно.",
 "pandas-plots":"Метод `.plot()` возвращает объект осей, который нужно сохранить в `result`.",
 "seaborn":"Seaborn получает DataFrame через `data` и связывает его столбцы с визуальными каналами.",
 "matplotlib":"Объект `Axes` хранит линии, подписи и параметры построенного графика.",
}

def dataset(slug, n):
    k = n
    if slug == "start":
        variants = [
            {"variables":{"data":{"name":["Аня","Борис","Вера"],"score":[7,9,8]}}},
            {"variables":{"records":[{"product":"Курс","price":1200},{"product":"Книга","price":600},{"product":"Видео","price":900}]}},
            {"variables":{"rows":[["Москва",12],["Казань",8]],"column_names":["city","sales"]}},
            {"variables":{"data":{"score":[9,7],"name":["Ира","Лев"],"group":["A","B"]},"column_order":["name","score"]}},
            {"variables":{"data":{"name":["Олег","Мила"],"score":[6,10]},"row_labels":["u-1","u-2"]}},
            {"variables":{"rows":[["Москва",15],["Тула",9]],"column_names":["city","sales"]}},
            {"variables":{"column_names":["id","name","score"]}},
            {"series":{"scores":{"data":[4,8,6],"index":["a","b","c"]}}},
            {"variables":{"data":{"id":[1,2],"name":["А","Б"],"score":[5,9],"note":["x","y"]},"column_order":["id","score"]}},
            {"variables":{"records":[{"name":"Нина","score":8,"city":"Пермь"},{"name":"Роман","score":7,"city":"Омск"}],"column_order":["city","name","score"],"row_labels":["r1","r2"]}},
        ]; return variants[n-1]
    if slug == "reading":
        texts=["name,score\nАня,8\nБорис,6\n","name;score\nВера;9\nГлеб;7\n","name\tscore\nДина\t8\nЕгор\t5\n","Аня,8\nБорис,6\n","Тула,12\nОмск,9\n","id,name,score\n1,Аня,8\n2,Борис,6\n","id,name\n101,Аня\n102,Вера\n","client_id,amount\n0012,500\n0040,700\n","date,sales\n2026-01-05,10\n2026-02-07,15\n","name,score\nАня,нет\nБорис,-\nВера,9\n"]
        vars={"csv_path":"data.csv"}
        if n==5: vars["column_names"]=["city","sales"]
        if n==6: vars["needed_columns"]=["name","score"]
        return {"files":{"data.csv":texts[n-1]},"variables":vars}
    base={"name":["Анна","Борис","Вера","Глеб"],"score":[72+k,55,91,None],"attempts":[1,3,2,1],"city":["Москва","Казань","Москва","Тула"],"status":["open","closed","open","new"],"price":[100+k,250,80,140],"quantity":[2,1,4,3],"discount":[10,20,0,15],"online":[4,7,3,8],"offline":[2,1,5,4],"current":[12,9,15,11],"previous":[10,10,12,8],"amount":[200,250,320,420],"discount_pct":[10,5,0,20],"total sales":[800,1200,1500,600],"client name":["Анна","Борис","Вера","Глеб"],"priority":[2,1,3,2],"created_at":["2026-02-01","2026-01-03","2026-03-01","2026-01-01"]}
    if slug in {"columns","change-columns","filtering","sorting"}:
        variables={}
        if slug=="columns": variables={"selected_columns":[] if n==7 else ["city","score"],"report_columns":["name","city","score"]}
        if slug=="change-columns": variables={"price_limit":150,"names":["А","Б","В","Г"]}
        if slug=="filtering": variables={"min_score":70,"allowed_cities":["Москва","Тула"],"min_price":90,"max_price":200}
        return {"df":base,"variables":variables}
    if slug == "vectorization":
        if n in (5,6,7,8): return {"series":{"left":{"data":[10+k,20,30],"index":["a","b","c"]},"right":{"data":[1,2,4],"index":["b","c","d"] if n in (7,8) else ["a","b","c"]}}}
        names={1:("values",[1,3,5],"offset",k),2:("values",[10,20,30],"offset",k),3:("values",[2,4,6],"factor",k+1),4:("values",[12,18,24],"divisor",3),9:("values",[4,8,12],"threshold",8)}
        if n in names:
            a,v,b,x=names[n]; return {**series(a,v),"variables":{b:x}}
        return {"series":{"prices":{"data":[100,200,150]},"quantities":{"data":[2,1,3]},"discount_rate":{"data":[.1,.2,0]}}}
    if slug == "attributes":
        frames={"df":{"a":[1,2,3],"b":[4,5,6]}}
        if n==5: frames={"left":{"a":[1,2]},"right":{"b":[3,4]}}
        if n==6: frames={"orders":{"id":[1,2,3]},"returns":{"id":[2]}}
        if n==9: frames={"train":{"x":[1,2,3,4]},"test":{"x":[5,6]}}
        return {**frames,"variables":{"expected_rows":3}}
    if slug == "inspection": return {"df":{"id":list(range(1,9)),"value":[k*x for x in range(1,9)]},"variables":{"n":12 if n==10 else (2+k%4)}}
    if slug in {"dataframe-methods","series-methods"}:
        vals=[1,2,None,4,2,1] if slug=="dataframe-methods" else ([1,2,2,4,7,9] if n==9 else ["A","B","A",None,"C","A"])
        if n==8 and slug=="dataframe-methods": return {"df":{"sales":[10,20,30],"profit":[2,5,7]}}
        if n==9 and slug=="dataframe-methods": return {"df":{"q1":[1,2,3],"q2":[4,5,6]}}
        if n==2 and slug=="dataframe-methods": return {"df":{"sales":[10,20,30]}}
        key="flags" if n==10 and slug=="dataframe-methods" else "values"
        data=[True,False,True,True] if key=="flags" else vals
        return {**series(key,data),"variables":{"min_required":5,"bin_count":3}}
    if slug in {"groupby","pivot"}:
        frame={"category":["A","B","A",None],"city":["Москва","Казань","Москва","Тула"],"year":[2025,2025,2026,2026],"sales":[10,20,None,15],"profit":[2,5,3,4],"revenue":[100,200,150,90],"team":["X","Y","X","Y"],"points":[2,1,3,4],"won":[True,False,True,True]}
        return {"df":frame,"variables":{"total_label":"Итого"}}
    if slug == "merge":
        left={"id":[1,2,3],"client_id":[10,20,10],"city":["Москва","Тула","Москва"],"year":[2025,2025,2026],"value":[10,20,30],"category_id":[100,200,100]}
        right={"id":[10,20,30],"city":["Москва","Тула","Казань"],"year":[2025,2025,2026],"value":[100,200,300],"category_id":[100,200,300],"category":["A","B","C"]}
        if n<5: right={"id":[2,3,4],"label":["B","C","D"]}
        if n==6: left={"city":["Москва","Тула"],"year":[2025,2026],"sales":[10,20]}; right={"city":["Москва","Тула"],"year":[2025,2026],"plan":[12,18]}
        if n==9: right={"category_id":[100,200],"category":["A","B"]}
        if n==10: left={"value":[10,20]}; right={"label":["A","B"]}
        return {"left":left,"right":right}
    if slug == "dtypes":
        if n in (5,6,9): return {"df":{"count":["1","2","3"],"price":["1.5","2.0","3.25"],"score":["7","8","9"]}}
        vals=["1","2","3"] if n not in (4,8) else ([0,1,1] if n==4 else [1,None,3])
        return series("values",vals)
    if slug == "datetime":
        if n==5:return {"variables":{"timestamps":[0,86400,172800]}}
        raw=["31/01/2026","15/02/2026","28/03/2026"] if n==2 else (["2026-01-05","bad","2026-10-20"] if n==4 else ["2026-01-05","2026-04-12","2026-10-20"])
        if n>=6:return {"series":{"dates":{"data":[f"{value}T00:00:00.000" for value in raw],"dtype":"datetime64[ns]"}}}
        return {"variables":{"dates":raw,"date_format":"%Y-%m-%d"}}
    if slug == "recipes":
        if n in (4,5,6,7): return {"df":{"discount":[10,None,0],"age":[20,None,40],"salary":[50,None,90],"city":["Москва",None,"Тула"],"score":[8,None,6]}}
        name={2:"cities",3:"scores",8:"prices",9:"prices"}.get(n,"values")
        vals=[1,None,None,4] if name!="cities" else ["Москва",None,"Тула"]
        return {**series(name,vals),"variables":{"fill_value":7,"fill_limit":1}}
    if slug in {"pandas-plots","seaborn"}:
        return {"df":{"date":["2026-01","2026-02","2026-03","2026-04"],"month":[1,2,3,4],"category":["A","B","A","C"],"region":["Север","Юг","Юг","Север"],"sales":[10+k,15,8,20],"score":[6,8,7,9],"plan":[9,12,15,18],"fact":[8,14,13,20],"status":["new","done","new","hold"],"amount":[100,200,150,80]},"variables":{"chart_title":"Продажи","figure_size":[6,4],"bar_color":"steelblue","category_order":["C","B","A"],"region_order":["Юг","Север"],"status_order":["new","hold","done"]}}
    if slug == "matplotlib": return {"variables":{"x":[1,2,3,4],"y":[2+k,4,3,6],"plan":[2,4,5,7],"fact":[1,5,4,8],"line_color":"navy","line_width":3,"line_alpha":.5,"series_label":"Продажи","chart_title":"Динамика"}}
    raise KeyError(slug)


def parse_bank():
    text=SOURCE.read_text(encoding="utf-8")
    editorial=json.loads(EDITORIAL.read_text(encoding="utf-8"))["tasks"]
    existing={e["id"]:e for m in json.loads(TARGET.read_text(encoding="utf-8")).get("modules",[]) for t in m.get("topics",[]) for e in t.get("exercises",[])} if TARGET.exists() else {}
    topics=[]
    for block in re.split(r"(?m)^## ", text)[1:]:
        lines=block.splitlines(); match=re.match(r"(\d+)\. (.+?) — `?(.+?)`?$",lines[0])
        rows=[line for line in lines if re.match(r"^\| `[^`]+`",line)]
        if not match or len(rows)!=10: continue
        order,title,method=match.groups(); exercises=[]
        for position,line in enumerate(rows,1):
            cells=[part.strip() for part in line.strip("|").split("|")]
            first=re.match(r"`([^`]+)` — (.+)",cells[0]); eid,name=first.groups()
            difficulty=cells[1].count("★"); focus=cells[2].replace("`",""); instructions=cells[3].replace("`","")
            slug=eid.rsplit("-",1)[0]; solution=SOLUTIONS[slug][position-1]
            data=dataset(slug,position); prepared=setup_code(data,slug)
            starter=f"{prepared}\n\nresult = None"
            copy=editorial.get(eid)
            if not copy: raise ValueError(f"Missing editorial content for {eid}")
            generated={"id":eid,"topic_id":int(order),"difficulty":difficulty,"title":copy["title"],"instructions":copy["instructions"],"focus":focus,"learning_objective":copy["learning_objective"],"result_variable":"result","expected_type":"plot" if slug in {"pandas-plots","seaborn","matplotlib"} else "auto","setup_code":prepared,"starter_code":starter,"solution_code":solution,"theory_article_id":f"theory-{eid}","required_tokens":[token for token in re.findall(r"(?:pd\.|sns\.|\.)([A-Za-z_]+)",solution)][:2],"tests":["result_type","values","shape","column_order","index","dtype","input_immutability","required_method"],"dataset":data,"hints":copy["hints"],"completion_summary":copy["completion_summary"],"explanation":copy["explanation"],"is_control":position==10,"xp":{1:15,2:25,3:40}[difficulty]}
            # Editorial imports are not allowed to rewrite executable task contracts.
            # Existing technical fields win; only the explicit learner-facing copy changes.
            if eid in existing:
                generated={**existing[eid], **{key:copy[key] for key in ("title","instructions","learning_objective","hints","completion_summary","explanation")}}
            exercises.append(generated)
        slug=exercises[0]["id"].rsplit("-",1)[0]
        topics.append({"id":int(order),"slug":slug,"title":title,"summary":f"10 упражнений на {method}","theory":f"Практическая серия на {method}: от прямого применения к параметрам и пограничным случаям.","syntax":method,"example":exercises[0]["solution_code"],"mistakes":["Изменён исходный объект","Ответ не сохранён в result","Не использован приём серии"],"methods":[method],"exercises":exercises})
    return topics


topics=parse_bank()
if len(topics)!=20: raise SystemExit(f"Ожидалось 20 тем, найдено {len(topics)}")
modules=[{"id":t["id"],"slug":t["slug"],"title":t["title"],"description":t["summary"],"order":t["id"],"bank_version":2,"topics":[t]} for t in topics]
TARGET.write_text(json.dumps({"bank_version":2,"modules":modules},ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Создан каталог: {len(topics)} тем, {sum(len(t['exercises']) for t in topics)} заданий")
