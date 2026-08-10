import json
from pathlib import Path

modules = [
('start','Начало работы','pd.Series, pd.DataFrame и безопасные копии','pd.DataFrame(data)','Создание таблицы из словаря','result = pd.DataFrame(data)'),
('reading','Чтение данных','CSV, Excel, JSON, SQL, Parquet и параметры чтения','pd.read_csv(path, sep=";")','Загрузка данных','result = pd.read_csv(csv_path, sep=";")'),
('columns','Работа со столбцами','Выбор, loc/iloc, rename, drop, insert и pop','df[["name", "score"]]','Выбор столбцов','result = df[["name", "score"]]'),
('change-columns','Создание и изменение столбцов','assign, map, replace, apply и преобразования типов','df.assign(total=df.price * df.qty)','Расчёт выручки','result = df.assign(revenue=df["price"] * df["qty"])'),
('vectorization','Векторизация','Операции над Series, str, where, mask и eval','df["price"] * 1.2','Цена с НДС','result = df["price"] * 1.2'),
('attributes','Атрибуты DataFrame','shape, size, ndim, index, columns, dtypes и axes','df.shape','Размер таблицы','result = df.shape'),
('inspection','Просмотр данных','head, tail, sample, info, describe и memory_usage','df.head(3)','Первые строки','result = df.head(3)'),
('dataframe-methods','Методы DataFrame','Агрегации, пропуски, дубли, value_counts и корреляция','df.drop_duplicates()','Удаление дублей','result = df.drop_duplicates()'),
('series-methods','Методы Series','unique, nunique, value_counts, str и арифметика Series','df["city"].value_counts()','Частоты городов','result = df["city"].value_counts()'),
('groupby','GroupBy','split-apply-combine, agg, transform, filter и size','df.groupby("category")["revenue"].sum()','Выручка по категориям','result = df.groupby("category")["revenue"].sum()'),
('filtering','Фильтрация и query','Булевы маски, query, isin, between и работа с пропусками','df.query("score >= 8")','Отбор сильных результатов','result = df.query("score >= 8")'),
('sorting','Сортировка','sort_values, sort_index, ascending и na_position','df.sort_values("score", ascending=False)','Рейтинг по баллам','result = df.sort_values("score", ascending=False)'),
('merge','Объединение таблиц','merge, concat, join, validate и indicator','orders.merge(customers, on="customer_id")','Заказы с клиентами','result = orders.merge(customers, on="customer_id", how="left")'),
('pivot','Pivot и сводные таблицы','pivot, pivot_table, crosstab, melt, stack и unstack','pd.pivot_table(df, index="city", values="revenue", aggfunc="sum")','Сводная по городам','result = pd.pivot_table(df, index="city", values="revenue", aggfunc="sum")'),
('dtypes','Типы данных','astype, to_numeric, convert_dtypes и nullable-типы','pd.to_numeric(df["score"], errors="coerce")','Числовой тип','result = pd.to_numeric(df["score"], errors="coerce")'),
('datetime','Дата и время','to_datetime, компоненты .dt и Timedelta','pd.to_datetime(df["date"]).dt.month','Месяц события','result = pd.to_datetime(df["date"]).dt.month'),
('recipes','Полезные рецепты','Пропуски, дубли, reset_index и нормализация','df.dropna(subset=["score"]).reset_index(drop=True)','Очистка данных','result = df.dropna(subset=["score"]).reset_index(drop=True)'),
('pandas-plots','Графики pandas','bar, barh, hist и line через DataFrame.plot','df.plot(kind="bar", x="name", y="score")','Столбчатый график','result = df.plot(kind="bar", x="name", y="score")'),
('seaborn','Seaborn','barplot, countplot, histplot и displot','sns.barplot(data=df, x="name", y="score")','График Seaborn','result = sns.barplot(data=df, x="name", y="score")'),
('matplotlib','Matplotlib','figure, title, xlabel, ylabel и savefig','plt.plot(df["name"], df["score"])','Линейный график','result = plt.plot(df["name"], df["score"])'),
]

datasets={
 'start':{"variables":{"data":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}}},
 'columns':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9],"group":["A","B","A"]}},
 'change-columns':{"df":{"product":["Курс","Книга","Вебинар"],"price":[1200,600,900],"qty":[2,3,1]}},
 'vectorization':{"df":{"product":["Курс","Книга","Вебинар"],"price":[1200,600,900]}},
 'attributes':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}},
 'inspection':{"df":{"name":["Анна","Борис","Вера","Глеб"],"score":[8,6,9,7]}},
 'dataframe-methods':{"df":{"order_id":[101,101,102,103],"amount":[500,500,700,300]}},
 'series-methods':{"df":{"city":["Москва","Казань","Москва","Тула","Москва"]}},
 'groupby':{"df":{"category":["Книги","Игры","Книги","Игры"],"revenue":[1200,800,1500,900]}},
 'filtering':{"df":{"name":["Анна","Борис","Вера","Глеб"],"score":[8,6,9,7]}},
 'sorting':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}},
 'pivot':{"df":{"city":["Москва","Казань","Москва","Казань"],"revenue":[1200,800,1500,900]}},
 'dtypes':{"df":{"score":["8","ошибка","9","6"]}},
 'datetime':{"df":{"date":["2026-01-10","2026-02-12","2026-03-01"]}},
 'recipes':{"df":{"name":["Анна","Борис","Вера"],"score":[8,None,9]}},
 'pandas-plots':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}},
 'seaborn':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}},
 'matplotlib':{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}},
}
out=[]
for mi,(slug,title,desc,syntax,task,solution) in enumerate(modules,1):
 dataset=datasets.get(slug,{"df":{"name":["Анна","Борис","Вера"],"score":[8,6,9]}})
 if slug=='reading': dataset={"files":{"data.csv":"name;score\nАнна;8\nБорис;6\n"},"variables":{"csv_path":"data.csv"}}
 if slug=='merge': dataset={"orders":{"order_id":[1,2,3],"customer_id":[10,20,10],"amount":[500,700,300]},"customers":{"customer_id":[10,20],"customer":["Анна","Борис"]}}
 exercises=[]
 for i in range(1,4):
  if slug=='start':
   instructions='Создайте DataFrame из словаря data и сохраните его в переменную result. Не изменяйте исходный словарь.'
   starter='result = pd.DataFrame(...)'
   hints=['Словарь с одинаковыми по длине списками можно преобразовать в таблицу.','Используйте конструктор pd.DataFrame.','Заполните пропуск: result = pd.DataFrame(____)']
  else:
   instructions=f"Выполните операцию «{task.lower()}» над показанными данными. Сохраните итог в переменную result."
   starter='# Входные данные показаны слева\nresult = '
   rhs=solution.removeprefix('result = ')
   hints=[f"Определите, какой объект pandas нужен для темы «{title}».",f"Используйте конструкцию: {syntax}",f"Заполните пропуск: result = ____  # форма: {rhs.split('(')[0]}(...)"]
  exercises.append({"id":f"{slug}-{i:03}","difficulty":i,"title":task+("" if i==1 else f" · вариант {i}"),"instructions":instructions,"result_variable":"result","starter_code":starter,"solution_code":solution,"dataset":dataset,"hints":hints,"is_control":i==3,"xp":10+i*5})
 out.append({"id":mi,"slug":slug,"title":title,"description":desc,"order":mi,"topics":[{"id":mi,"slug":slug,"title":title,"summary":desc,"theory":"Методы pandas обычно возвращают новый объект — сохраняйте результат явно и не изменяйте входные данные без необходимости.","syntax":syntax,"example":solution,"mistakes":["Забыто присваивание результата","Перепутаны имя столбца или тип результата","Изменён исходный DataFrame"],"methods":[x.strip() for x in syntax.replace('(',' ').replace(')',' ').replace(',',' ').split() if '.' in x][:5] or [syntax],"exercises":exercises}]})
Path('content').mkdir(exist_ok=True)
Path('content/catalog.json').write_text(json.dumps({"modules":out},ensure_ascii=False,indent=2),encoding='utf-8')
print('Создано',sum(len(t['exercises']) for m in out for t in m['topics']),'задач')
