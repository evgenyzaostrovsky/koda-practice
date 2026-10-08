"""Idempotent KODA Market source integration; stable legacy IDs are extended."""
from pathlib import Path
import copy
import ast
from collections import defaultdict
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'apps/api'))
from app.runner import run

def load(name): return json.loads((ROOT/'content'/name).read_text(encoding='utf-8'))
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def write_course_manifest(disposition):
    """Project ordering is a projection of stable task identities, not another bank."""
    source=(ROOT/'content/datasets/koda-market/KODA_Market_full_task_bank.md').read_text(encoding='utf-8-sig')
    titles={int(number):title.strip() for number,title in re.findall(r'^## (\d+)\. (.+)$',source,re.MULTILINE)}
    catalog_source=load('catalog.json')
    task_ids={task['id'] for module in catalog_source['modules'] for topic in module['topics'] for task in topic['exercises']}
    lessons=[]
    for section in range(1,20):
        points=sorted((item for item in disposition['objectives'] if item['section']==section),key=lambda item:item['point'])
        ordered=list(dict.fromkeys(item['task_id'] for item in points))
        if not ordered or any(task_id not in task_ids for task_id in ordered):
            raise ValueError(f'Project lesson {section} contains absent task identities')
        lessons.append({'id':f'market-{section}','title':titles[section],
                        'exercise_mode':{17:'sql',18:'excel',19:'power-bi'}.get(section,'python'),'taskIds':ordered})
    if len(lessons[5]['taskIds']) != 12:raise ValueError('The project groupby lesson must retain all twelve source objectives')
    target=ROOT/'apps/web/public/market-course.json'
    write(target,{'id':'koda-market','title':'KODA Market — проект аналитика','lessons':lessons})
    print(f'Market project course: {len(lessons)} lessons; {sum(len(lesson["taskIds"]) for lesson in lessons)} lesson task links; unchanged catalog identities.')

if '--course-only' in sys.argv:
    write_course_manifest(json.loads((ROOT/'reports/market-source-disposition.json').read_text(encoding='utf-8')))
    raise SystemExit(0)

TARGET = ROOT/'content'/'datasets'/'koda-market'
TARGET.mkdir(parents=True, exist_ok=True)
SOURCE = Path(sys.argv[1]) if len(sys.argv)>1 else (TARGET if (TARGET/'koda_market_orders.csv').exists() else Path.home()/'Downloads')
files = {}
for name in ('orders','customers','products','managers'):
    filename = f'koda_market_{name}.csv'
    raw = (SOURCE/filename).read_bytes()
    (TARGET/filename).write_bytes(raw)
    files[filename] = raw.decode('utf-8-sig')
for filename in ('KODA_Market_full_task_bank.md','KODA_Market_groupby_lesson.md','KODA_Practice_Codex_master_prompt.md'):
    (TARGET/filename).write_bytes((SOURCE/filename).read_bytes())

import pandas as pd
import io
tables = {name:pd.read_csv(io.StringIO(files[f'koda_market_{name}.csv'])) for name in ('orders','customers','products','managers')}
assert tables['orders'].shape == (30,18)
assert ((tables['orders'].quantity*tables['orders'].price-tables['orders'].discount)==tables['orders'].revenue).all()
DATA = {'files':files, **{name:json.loads(frame.to_json(orient='columns')) for name,frame in tables.items()}}
# to_json(orient=columns) indexes columns; convert them back to prepared arrays.
DATA = {'files':files, **{name:{col:[None if pd.isna(v) else v for v in frame[col].tolist()] for col in frame} for name,frame in tables.items()}}
SETUP = "import pandas as pd\norders = pd.read_csv('koda_market_orders.csv', parse_dates=['order_date'])\ncustomers = pd.read_csv('koda_market_customers.csv')\nproducts = pd.read_csv('koda_market_products.csv')\nmanagers = pd.read_csv('koda_market_managers.csv')\ndf = orders.copy()\ncsv_path = 'koda_market_orders.csv'"
catalog, theory, editorial, units = load('catalog.json'), load('theory_bank.json'), load('task_editorial.json'), load('knowledge_units.json')
old_tasks = {e['id']:e for m in catalog['modules'] for t in m['topics'] for e in t['exercises']}
old_units = {u['id']:u for u in units['units']}
existing_topics = {t['slug']: t for m in catalog['modules'] for t in m['topics']}
authored_teaching = {}
for teaching_file in ('market_teaching_a.json','market_teaching_b.json'):
    if (ROOT/'content'/teaching_file).exists(): authored_teaching.update(load(teaching_file))
next_topic = max(t['id'] for m in catalog['modules'] for t in m['topics'])+1
mapping = []
PANDAS = 'https://pandas.pydata.org/docs/reference/api/'
DOCS = {
 'read_csv':PANDAS+'pandas.read_csv.html', 'shape':PANDAS+'pandas.DataFrame.shape.html',
 'head':PANDAS+'pandas.DataFrame.head.html', 'dtypes':PANDAS+'pandas.DataFrame.dtypes.html',
 'isna':PANDAS+'pandas.DataFrame.isna.html', 'selection':'https://pandas.pydata.org/docs/user_guide/indexing.html',
 'sort_values':PANDAS+'pandas.DataFrame.sort_values.html', 'assign':PANDAS+'pandas.DataFrame.assign.html',
 'cut':PANDAS+'pandas.cut.html', 'dates':'https://pandas.pydata.org/docs/user_guide/timeseries.html',
 'groupby':PANDAS+'pandas.DataFrame.groupby.html', 'agg':PANDAS+'pandas.core.groupby.DataFrameGroupBy.agg.html',
 'transform':PANDAS+'pandas.core.groupby.DataFrameGroupBy.transform.html', 'fillna':PANDAS+'pandas.Series.fillna.html',
 'duplicated':PANDAS+'pandas.DataFrame.duplicated.html', 'drop_duplicates':PANDAS+'pandas.DataFrame.drop_duplicates.html',
 'pivot_table':PANDAS+'pandas.DataFrame.pivot_table.html', 'melt':PANDAS+'pandas.DataFrame.melt.html',
 'merge':PANDAS+'pandas.DataFrame.merge.html', 'cumsum':PANDAS+'pandas.Series.cumsum.html',
 'strings':'https://pandas.pydata.org/docs/user_guide/text.html', 'map':PANDAS+'pandas.Series.map.html',
 'apply':PANDAS+'pandas.Series.apply.html', 'plot':PANDAS+'pandas.DataFrame.plot.html',
 'sql':'https://www.sqlite.org/lang_select.html', 'excel':'https://support.microsoft.com/en-us/office/using-structured-references-with-excel-tables-f5ed2452-2337-4f71-bed3-c8ae6d2b276e',
 'power-bi':'https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-report-view',
}

# Source section, reuse ID or None, title, human task, solution, primary technique,
# principle hint, API hint, syntax hint, completion and explanation are authored below.
SECTIONS = [
('market-overview','Загрузка и обзор данных',[
 ('reading-009','Первая загрузка','Загрузите продажи из CSV, распознав дату заказа как дату. Сохраните таблицу в result.',"result = pd.read_csv(csv_path, parse_dates=['order_date'])",'read_csv','Текст даты нужно превратить в календарное значение при чтении файла.','Параметр parse_dates получает список полей с датами.','`pd.read_csv(csv_path, parse_dates=[...])`','Дата заказа теперь пригодна для календарных фильтров и периодов.'),
 ('attributes-001','Размер магазина','Узнайте количество заказов и полей в таблице. Сохраните пару чисел в result.',"result = orders.shape",'shape','Размер таблицы — две величины, а не число всех ячеек.','Атрибут shape возвращает число строк и число столбцов.','`result = orders.shape`','В магазине 30 заказов и 18 полей; размер помогает контролировать загрузку.'),
 ('inspection-001','Первые заказы','Покажите первые пять заказов со всеми полями в result.',"result = orders.head()",'head','Небольшое начало таблицы помогает проверить заголовки и реальные значения.','head без аргументов показывает пять строк.','`result = orders.head()`','Превью сохраняет схему всех 18 полей, поэтому видно устройство заказов.'),
 (None,'Типы данных','Покажите тип каждого поля продаж в result. Дата уже распознана, оценка допускает пропуски.',"result = orders.dtypes.astype(str)",'dtypes','Пропуск в числах влияет на тип, даже когда заполненные оценки целые.','Атрибут dtypes показывает тип каждого столбца.','`result = orders.dtypes.astype(str)`','Дата имеет временной тип, а оценка — дробный тип из-за пропусков.'),
 (None,'Быстрый аудит','Посчитайте пропуски по каждому полю и оставьте только проблемные поля в result.',"missing = orders.isna().sum()\nresult = missing[missing > 0]",'isna','Проблемным является поле хотя бы с одним незаполненным значением.','isna строит маску; sum считает True по столбцам.','`missing = orders.isna().sum(); result = missing[missing > 0]`','Отсутствуют две оценки клиентов; остальные поля заполнены.'),
]),
('market-selection','Выбор данных',[
 ('columns-010','Поля отчёта','Оставьте дату, город, категорию и выручку именно в таком порядке. Сохраните таблицу в result.',"result = orders[['order_date','city','category','revenue']]",'selection','Отчёт должен сохранять все заказы, но показывать только четыре нужных поля.','Список имён в квадратных скобках выбирает столбцы в заданном порядке.','`orders[["order_date", "city", "category", "revenue"]]`','Выбор полей меняет ширину отчёта, сохраняя исходные заказы.'),
 ('filtering-001','Крупные продажи','Покажите заказы с выручкой строго больше 20 000 рублей в result.',"result = orders.query('revenue > 20000')",'selection','Граница не входит в отбор: заказ на 20 000 рублей не подходит.','query сравнивает выручку с порогом через >.','`orders.query("revenue > 20000")`','Строгий порог отличается от отбора заказов на сумму не меньше 20 000.'),
 ('filtering-008','Два города','Оставьте заказы из Москвы и Тулы в исходном порядке в result.',"result = orders[orders.city.isin(['Москва','Тула'])]",'selection','Нужен один отбор, который допускает любое из двух названий города.','isin проверяет принадлежность списку городов.','`orders[orders.city.isin(["Москва", "Тула"])]`','Проверка списка объединяет два городских условия без повторного обхода таблицы.'),
 (None,'Первые заказы приложения','Покажите первые пять заказов, оформленных через приложение, в result.',"result = orders.loc[orders.channel == 'Приложение'].head(5)",'head','Сначала ограничьте канал, затем выберите начало отфильтрованной таблицы.','loc оставляет канал, head показывает пять его строк.','`orders.loc[orders.channel == "Приложение"].head(5)`','Первые пять заказов канала могут отличаться от первых пяти заказов магазина.'),
 ('filtering-005','Высокая оценка и чек','Оставьте заказы с оценкой 5 и выручкой строго больше 10 000 рублей в result.',"result = orders[(orders.rating == 5) & (orders.revenue > 10000)]",'selection','Оба условия должны выполняться у одного и того же заказа.','Соедините маски через &, заключив каждое сравнение в скобки.','`orders[(orders.rating == 5) & (orders.revenue > 10000)]`','Совместный отбор связывает удовлетворённость покупателя и размер заказа.'),
]),
('market-sorting','Сортировка',[
 (None,'Десять самых дорогих','Покажите десять заказов с наибольшей выручкой. При равной выручке раньше идёт меньший номер заказа. Сохраните в result.',"result = orders.sort_values(['revenue','order_id'], ascending=[False,True]).head(10)",'sort_values','Рейтинг требует ограничить число строк после сортировки.','Укажите выручку по убыванию и номер заказа как второй ключ.','`sort_values(["revenue", "order_id"], ascending=[False, True]).head(10)`','Второй ключ делает рейтинг воспроизводимым даже при равных продажах.'),
 ('sorting-002','Долгая доставка','Отсортируйте заказы по сроку доставки от долгого к короткому; равные сроки сохраняют исходный порядок. Сохраните в result.',"result = orders.sort_values('delivery_days', ascending=False, kind='stable')",'sort_values','Отмена с нулём дней не означает доставленный заказ, но входит в общий обзор.','ascending=False меняет направление, kind="stable" сохраняет порядок равных значений.','`sort_values("delivery_days", ascending=False, kind="stable")`','Устойчивый порядок позволяет сравнивать одинаковые сроки без случайных перестановок.'),
 (None,'Дешёвый заказ каждого города','Найдите один заказ с наименьшей выручкой в каждом городе. При равенстве выберите меньший номер; отсортируйте города по алфавиту. Сохраните в result.',"result = orders.sort_values(['city','revenue','order_id']).drop_duplicates('city')",'drop_duplicates','Каждый город должен дать одного победителя после сортировки по цене.','drop_duplicates оставляет первую строку каждого города.','`sort_values(["city", "revenue", "order_id"]).drop_duplicates("city")`','Порядок перед удалением повторных ключей определяет выбранный заказ.'),
 (None,'Клиенты по выручке','Посчитайте выручку каждого клиента и отсортируйте её по убыванию. Равные суммы сохраняют алфавитный порядок клиентов. Сохраните Series в result.',"result = orders.groupby('customer_id').revenue.sum().sort_values(ascending=False, kind='stable')",'groupby','Клиент может сделать несколько заказов; сначала нужен итог клиента.','groupby и sum создают сумму, sort_values ранжирует её.','`groupby("customer_id").revenue.sum().sort_values(ascending=False, kind="stable")`','Рейтинг клиентов складывает повторные покупки и не изменяет таблицу заказов.'),
 ('sorting-005','Город и выручка','Отсортируйте заказы по городу по алфавиту, а внутри города по выручке от большей к меньшей. Равные суммы сохраняют исходный порядок. Сохраните в result.',"result = orders.sort_values(['city','revenue'], ascending=[True,False], kind='stable')",'sort_values','Основной порядок задаёт город, дополнительный — размер заказа.','Для двух ключей ascending получает два направления.','`sort_values(["city", "revenue"], ascending=[True, False], kind="stable")`','Два направления позволяют одновременно группировать города визуально и ранжировать заказы.'),
]),
('market-features','Новые колонки',[
 (None,'Выручка до скидки','Создайте копию заказов и добавьте выручку до скидки в поле gross_revenue. Сохраните копию в result. Скидка указана в рублях на весь заказ.',"result = orders.assign(gross_revenue=orders.revenue+orders.discount)",'assign','Абсолютную скидку нужно вернуть к выручке, а не трактовать как процент.','assign добавляет поле, выражение revenue + discount восстанавливает сумму.','`orders.assign(gross_revenue=orders.revenue + orders.discount)`','Скидка вычтена из суммы заказа один раз, поэтому её возвращают сложением.'),
 ('change-columns-008','Признак крупного заказа','Создайте копию с булевым полем is_large: выручка не меньше 15 000 рублей. Сохраните в result.',"result = orders.assign(is_large=orders.revenue >= 15000)",'assign','Заказ ровно на границе тоже считается крупным.','Сравнение >= создаёт булеву Series для assign.','`orders.assign(is_large=orders.revenue >= 15000)`','Булев признак позволяет далее фильтровать и считать долю крупных заказов.'),
 (None,'Размер заказа','Разделите заказы на small, medium, large: до 5 000 включительно, от 5 000 до 15 000 включительно, больше 15 000. Добавьте категориальное поле order_size в копию result.',"result = orders.assign(order_size=pd.cut(orders.revenue, bins=[0,5000,15000,float('inf')], labels=['small','medium','large']))",'cut','Границы интервалов должны распределить каждый заказ ровно в одну группу.','pd.cut использует правую включённую границу по умолчанию.','`pd.cut(orders.revenue, [0, 5000, 15000, float("inf")], labels=["small", "medium", "large"])`','Интервалы отличаются от произвольных условий и фиксируют принадлежность граничных значений.'),
 ('change-columns-006','Стоимость единицы','Добавьте к копии заказов поле unit_revenue: выручка после скидки на одну единицу. Округлите до двух знаков и сохраните в result.',"result = orders.assign(unit_revenue=(orders.revenue/orders.quantity).round(2))",'assign','Цена по прайсу и фактическая выручка единицы могут отличаться из-за скидки.','Разделите revenue на quantity и округлите Series.','`orders.assign(unit_revenue=(orders.revenue / orders.quantity).round(2))`','Стоимость единицы учитывает распределённую на количество абсолютную скидку.'),
 (None,'Долгая доставка как признак','Добавьте булево поле is_slow в копию: доставка строго дольше трёх дней. Сохраните в result.',"result = orders.assign(is_slow=orders.delivery_days > 3)",'assign','Три дня допустимы; признак должен отмечать только превышение.','Создайте маску delivery_days > 3 и передайте в assign.','`orders.assign(is_slow=orders.delivery_days > 3)`','Признак превышения срока удобно агрегировать как долю проблемных заказов.'),
]),
('market-date-filters','Фильтрация и даты',[
 (None,'Январские заказы','Оставьте заказы за январь 2026 года в result.',"result = orders[orders.order_date.dt.to_period('M') == '2026-01']",'dates','Номер месяца без года может смешать разные годы.','dt.to_period("M") задаёт год и месяц вместе.','`orders[orders.order_date.dt.to_period("M") == "2026-01"]`','Календарный период задаёт точные границы января выбранного года.'),
 (None,'После 10 февраля','Покажите заказы строго после 10 февраля 2026 года в result.',"result = orders[orders.order_date > pd.Timestamp('2026-02-10')]",'dates','День границы исключается при строгом сравнении.','Timestamp задаёт дату для сравнения временной Series.','`orders[orders.order_date > pd.Timestamp("2026-02-10")]`','Временное сравнение надёжнее отбора по текстовым частям даты.'),
 ('filtering-002','Быстрая доставка','Оставьте заказы со сроком доставки не больше двух дней в result. Статус в этом обзоре не ограничивается.',"result = orders[orders.delivery_days <= 2]",'selection','Нулевой срок входит в условие, даже если заказ отменён.','Оператор <= включает оба дня и нулевые значения.','`orders[orders.delivery_days <= 2]`','Числовой фильтр сам по себе не доказывает, что заказ был оплачен или доставлен.'),
 (None,'Оплаченные и довольные','Оставьте оплаченные заказы с оценкой не ниже 4 в result.',"result = orders[(orders.status == 'Оплачен') & (orders.rating >= 4)]",'selection','Неизвестная оценка не подтверждает удовлетворённость покупателя.','Соедините точный оплаченный статус и порог rating через &.','`orders[(orders.status == "Оплачен") & (orders.rating >= 4)]`','Пропуски оценок автоматически не проходят положительный порог.'),
 (None,'Новые клиенты последней недели','Оставьте заказы новых клиентов за последние семь календарных дней данных, включая последний день. Сохраните в result.',"start = orders.order_date.max()-pd.Timedelta(days=6)\nresult = orders[orders.is_new_customer & (orders.order_date >= start)]",'dates','Последняя неделя отсчитывается от последней даты набора, а не от сегодняшнего дня.','max находит последний день; Timedelta(days=6) задаёт начало семи включённых дат.','`start = orders.order_date.max() - pd.Timedelta(days=6)`','Период остаётся воспроизводимым при запуске урока в любой день.'),
]),
('market-groupby','Рабочий день: группировка',[
 ('groupby-001','Выручка по городам','Сгруппируйте заказы по городу и посчитайте общую выручку. Сохраните Series в result, города по алфавиту.',"result = orders.groupby('city').revenue.sum()",'groupby','Каждый город должен встретиться один раз, а его продажи сложиться.','groupby разделит города, sum сложит revenue.','`orders.groupby("city")["revenue"].sum()`','Выручка по городам учитывает все статусы, включая положительные суммы отмен и возвратов.'),
 (None,'Средний чек по каналам','Посчитайте среднюю выручку заказа для каждого канала. Округлите до двух знаков и сохраните Series в result, каналы по алфавиту.',"result = orders.groupby('channel').revenue.mean().round(2)",'groupby','У каждого канала нужна сумма продаж в пересчёте на один заказ.','mean вычисляет среднее, round(2) задаёт денежную точность.','`groupby("channel").revenue.mean().round(2)`','Средний чек сравнивает каналы независимо от количества заказов.'),
 (None,'Три показателя менеджеров','Подготовьте таблицу менеджеров с количеством заказов, суммой выручки и средним чеком. Среднее округлите до двух знаков. Сохраните в result, менеджеры по алфавиту.',"result = orders.groupby('manager').agg(orders_count=('order_id','count'),total_revenue=('revenue','sum'),avg_revenue=('revenue','mean')).round({'avg_revenue':2})",'agg','Все показатели относятся к одной группе, но используют разные функции.','Именованные агрегации задают имя, поле и функцию.','`agg(orders_count=("order_id", "count"), total_revenue=("revenue", "sum"), avg_revenue=("revenue", "mean"))`','Именованные агрегации дают отчёту явную схему без последующего переименования.'),
 ('groupby-005','Города и категории','Посчитайте выручку каждой пары город — категория. Сохраните Series с составным индексом в result, ключи по алфавиту.',"result = orders.groupby(['city','category']).revenue.sum()",'groupby','Разрез по городу без категории скрывает структуру продаж.','Передайте два ключа списком в groupby.','`groupby(["city", "category"]).revenue.sum()`','Составной ключ показывает товарную структуру выручки каждого города.'),
 (None,'Выручка оплаченных заказов','Оставьте только оплаченные заказы, затем посчитайте выручку по городам. Сохраните Series в result.',"result = orders[orders.status == 'Оплачен'].groupby('city').revenue.sum()",'groupby','Суммы отмен положительные, поэтому их нельзя убрать по знаку выручки.','Сначала фильтр status, затем groupby и sum.','`orders[orders.status == "Оплачен"].groupby("city").revenue.sum()`','Финансовый срез исключает отмены и возвраты по статусу, сохраняя канонические суммы.'),
 (None,'Доля отмен по каналам','Рассчитайте процент отменённых заказов каждого канала. Округлите до одного знака и сохраните Series в result.',"result = orders.status.eq('Отменён').groupby(orders.channel).mean().mul(100).round(1)",'groupby','Доля — отмены, делённые на все заказы того же канала.','Среднее булевой Series равно доле True.','`orders.status.eq("Отменён").groupby(orders.channel).mean().mul(100).round(1)`','Процент отмен описывает качество канала и не зависит от размера чека.'),
 (None,'Повторные клиенты','Посчитайте уникальные номера заказов клиента. Оставьте клиентов с двумя и более заказами, отсортируйте по убыванию; равенства по коду клиента. Сохраните Series в result.',"counts = orders.groupby('customer_id').order_id.nunique()\nresult = counts[counts >= 2].sort_values(ascending=False, kind='stable')",'groupby','Повторный клиент имеет несколько разных заказов, а не несколько одинаковых строк.','nunique считает уникальные номера внутри клиента.','`counts[counts >= 2].sort_values(ascending=False, kind="stable")`','Уникальные номера защищают число повторных покупок от случайного дублирования строк.'),
 (None,'Лучшая категория города','Подготовьте таблицу город, категория, выручка с лучшей категорией каждого города. При равенстве выберите первую категорию по алфавиту. Сбросьте индекс и сохраните в result.',"totals = orders.groupby(['city','category'],as_index=False).revenue.sum()\nresult = totals.loc[totals.groupby('city').revenue.idxmax()].reset_index(drop=True)",'groupby','Победителя нужно искать по сумме категории, а не по самому дорогому заказу.','idxmax возвращает индекс строки с максимумом внутри города.','`totals.loc[totals.groupby("city").revenue.idxmax()]`','Максимум агрегата отвечает на вопрос о категории, максимум отдельного заказа — на другой вопрос.'),
 (None,'Средние оценки категорий','Посчитайте среднюю оценку каждой категории, игнорируя пропуски. Округлите до двух знаков, сохраните Series в result.',"result = orders.groupby('category').rating.mean().round(2)",'groupby','Неизвестная оценка не равна нулевой.','mean исключает пропуски в каждой группе.','`groupby("category").rating.mean().round(2)`','Средняя оценка основана только на фактически полученных отзывах.'),
 (None,'Доставка оплаченных заказов','Посчитайте средний срок доставки по городам среди оплаченных заказов. Округлите до одного знака, сохраните Series в result.',"result = orders[orders.status == 'Оплачен'].groupby('city').delivery_days.mean().round(1)",'groupby','Отменённые заказы с нулевым сроком исказили бы скорость реальной доставки.','Отбор оплаченных строк должен предшествовать mean.','`orders[orders.status == "Оплачен"].groupby("city").delivery_days.mean().round(1)`','Разделение статусов делает логистический показатель содержательным.'),
]),
('market-groupby-report','Группировка: итоговый отчёт',[
 (None,'Привлечение новых клиентов','Рассчитайте процент заказов новых клиентов по каналам. Округлите до одного знака, сохраните Series в result.',"result = orders.groupby('channel').is_new_customer.mean().mul(100).round(1)",'groupby','Признак относится к заказу, поэтому это доля заказов новых клиентов, а не уникальных людей.','Среднее булева is_new_customer даёт долю; умножьте на 100.','`groupby("channel").is_new_customer.mean().mul(100).round(1)`','Доля заказов новых клиентов не тождественна доле уникальных новых покупателей.'),
 (None,'Отчёт для директора','Соберите показатели городов: количество заказов, выручка, средний чек, средняя доставка. Средние округлите до двух знаков, города отсортируйте по выручке по убыванию. Сохраните в result.',"result = orders.groupby('city').agg(orders_count=('order_id','count'),total_revenue=('revenue','sum'),avg_revenue=('revenue','mean'),avg_delivery=('delivery_days','mean')).round(2).sort_values('total_revenue',ascending=False)",'agg','Одна таблица должна объединять четыре различных агрегата одного уровня.','agg задаёт именованные показатели; sort_values ранжирует итог, а не исходные заказы.','`agg(orders_count=("order_id", "count"), total_revenue=("revenue", "sum"), avg_revenue=("revenue", "mean"), avg_delivery=("delivery_days", "mean"))`','Итоговый отчёт связывает объём, деньги и логистику на одном уровне города.'),
]),
('market-transform','Показатели на уровне заказа',[
 (None,'Выручка города в заказе','Добавьте в копию заказов поле city_revenue с полной выручкой города каждой строки. Сохраните в result.',"result = orders.assign(city_revenue=orders.groupby('city').revenue.transform('sum'))",'transform','Нужно сохранить 30 заказов, повторив итог города возле каждого заказа.','transform возвращает столько значений, сколько было исходных строк.','`groupby("city").revenue.transform("sum")`','В отличие от агрегации, transform сохраняет уровень отдельного заказа.'),
 (None,'Доля заказа в городе','Добавьте поле city_share — долю выручки заказа в выручке его города от 0 до 1, округлённую до четырёх знаков. Сохраните копию в result.',"result = orders.assign(city_share=(orders.revenue/orders.groupby('city').revenue.transform('sum')).round(4))",'transform','Знаменатель у каждой строки зависит от её города.','Разделите revenue на городской transform("sum").','`(orders.revenue / orders.groupby("city").revenue.transform("sum")).round(4)`','Доля показывает вклад заказа внутри собственного города, а не всего магазина.'),
 (None,'Отклонение от среднего канала','Добавьте поле channel_deviation — выручку заказа минус средний чек канала, округлённую до двух знаков. Сохраните копию в result.',"result = orders.assign(channel_deviation=(orders.revenue-orders.groupby('channel').revenue.transform('mean')).round(2))",'transform','Положительное отклонение означает чек выше типичного для канала.','transform("mean") выравнивает среднее канала с заказами.','`orders.revenue - orders.groupby("channel").revenue.transform("mean")`','Сравнение со своим каналом учитывает различия между способами покупки.'),
 (None,'Доставка города в заказе','Добавьте поле city_delivery — средний срок доставки города каждой строки, округлённый до двух знаков. Статус не ограничивайте. Сохраните копию в result.',"result = orders.assign(city_delivery=orders.groupby('city').delivery_days.transform('mean').round(2))",'transform','Сохраните все строки и добавьте городской ориентир сроков.','transform("mean") применяется к delivery_days внутри city.','`groupby("city").delivery_days.transform("mean").round(2)`','Общий ориентир включает все статусы; для оплаченной доставки требуется отдельный фильтр.'),
 (None,'Выше своей категории','Оставьте заказы, чья выручка строго выше среднего чека своей категории, в result.',"result = orders[orders.revenue > orders.groupby('category').revenue.transform('mean')]",'transform','Единый порог магазина заменяется собственным порогом каждой категории.','Сравните revenue с transform("mean") категории.','`orders[orders.revenue > orders.groupby("category").revenue.transform("mean")]`','Групповой порог учитывает разную стоимость товаров в категориях.'),
]),
('market-quality','Пропуски и качество',[
 (None,'Количество пропусков','Посчитайте пропуски каждого поля, включая поля без пропусков. Сохраните Series в result.',"result = orders.isna().sum()",'isna','Нули важны для подтверждения полноты остальных полей.','isna().sum() возвращает число пропусков по каждому столбцу.','`result = orders.isna().sum()`','Полный профиль пропусков отличает отсутствие проблем от отсутствия проверок.'),
 (None,'Заказы без оценки','Покажите заказы без клиентской оценки в result.',"result = orders[orders.rating.isna()]",'isna','Пропуск нельзя надёжно искать сравнением с NaN.','isna создаёт булеву маску отсутствующих оценок.','`orders[orders.rating.isna()]`','Оба заказа без оценки отменены; отсутствие отзыва здесь имеет бизнес-причину.'),
 ('recipes-003','Специальная оценка','Замените пропуски оценок значением -1 только для отображения. Сохраните Series оценок в result; для среднего этот маркер использовать нельзя.',"result = orders.rating.fillna(-1)",'fillna','Маркер отображает отсутствие, но не является реальной оценкой.','fillna(-1) сохраняет известные оценки без изменения таблицы.','`result = orders.rating.fillna(-1)`','Маркер -1 допустим для вывода; перед аналитикой его нужно вернуть к пропуску.'),
 (None,'Пропуски по каналам','Посчитайте процент отсутствующих оценок каждого канала. Округлите до одного знака, сохраните Series в result.',"result = orders.rating.isna().groupby(orders.channel).mean().mul(100).round(1)",'isna','Сравнивайте доли, поскольку число заказов каналов различается.','Среднее маски isna внутри channel даёт долю пропусков.','`orders.rating.isna().groupby(orders.channel).mean().mul(100).round(1)`','Процент незаполненных оценок делает каналы сопоставимыми по полноте отзывов.'),
 (None,'Ключевые поля','Проверьте наличие пропусков в номере заказа, дате и коде клиента. Сохраните булеву Series по трём полям в result.',"result = orders[['order_id','order_date','customer_id']].isna().any()",'isna','Ключевые поля требуют отдельной проверки даже при полном заполнении.','any по маске отмечает хотя бы один пропуск в поле.','`orders[["order_id", "order_date", "customer_id"]].isna().any()`','Номер, дата и клиент заполнены; это проверка целостности связей и временных отчётов.'),
]),
('market-duplicates','Дубликаты',[
 (None,'Повторные номера','Проверьте, встречается ли номер заказа несколько раз. Сохраните булево значение в result.',"result = bool(orders.order_id.duplicated().any())",'duplicated','Повторный клиент допустим, повторный номер заказа требует проверки.','duplicated отмечает повтор номера, any сводит проверку к одному признаку.','`bool(orders.order_id.duplicated().any())`','Канонический файл не содержит повторных номеров заказов.'),
 (None,'Повторные строки клиентов','Покажите все полные дубликаты строк заказов, включая первое появление, в result. Повторная покупка клиента не считается дубликатом.',"result = orders[orders.duplicated(keep=False)]",'duplicated','Совпадать должны все поля строки, а не только код клиента.','keep=False отмечает каждую строку повторяющегося полного набора.','`orders[orders.duplicated(keep=False)]`','Пустой результат подтверждает отсутствие полных дубликатов, хотя клиенты покупают повторно.'),
 (None,'Удаление полных дубликатов','Удалите полные дубликаты в новой таблице, сохранив первое появление и исходный индекс. Сохраните в result.',"result = orders.drop_duplicates()",'drop_duplicates','Проверка может не найти повторов; очистка тогда должна сохранить таблицу полностью.','drop_duplicates без subset сравнивает все поля.','`result = orders.drop_duplicates()`','На чистом файле удаление дубликатов не меняет ни строки, ни индекс.'),
 (None,'Пара клиента и заказа','Покажите строки с повторяющейся парой код клиента — номер заказа, включая первое появление. Сохраните в result.',"result = orders[orders.duplicated(['customer_id','order_id'],keep=False)]",'duplicated','Составной ключ отличает разные заказы одного покупателя.','subset задаётся списком полей, keep=False показывает обе копии.','`orders.duplicated(["customer_id", "order_id"], keep=False)`','Составной ключ уникален в канонических данных, поэтому подозрительный отбор пуст.'),
 (None,'Задвоенная выручка','Посчитайте выручку лишних копий номеров заказов, сохраняя первое появление. Сохраните число в result.',"result = int(orders.loc[orders.order_id.duplicated(), 'revenue'].sum())",'duplicated','При двух копиях ошибочной является только одна лишняя запись.','Стандартный duplicated не отмечает первое появление номера.','`orders.loc[orders.order_id.duplicated(), "revenue"].sum()`','Задвоенная выручка равна нулю; проверка не путает повторные покупки с копиями заказов.'),
]),
('market-reshape','Сводные и форма отчёта',[
 ('pivot-006','Выручка городов и категорий','Постройте сводную выручки: города в строках, категории в столбцах. Отсутствующие сочетания заполните нулём, оба ключа по алфавиту. Сохраните в result.',"result = orders.pivot_table(index='city',columns='category',values='revenue',aggfunc='sum',fill_value=0)",'pivot_table','Сводная представляет пары город — категория прямоугольной таблицей.','pivot_table использует sum, а fill_value закрывает пустые сочетания.','`pivot_table(index="city", columns="category", values="revenue", aggfunc="sum", fill_value=0)`','Заполненные нули означают отсутствие продаж сочетания, а не пропущенные суммы.'),
 (None,'Каналы по месяцам','Постройте сводную выручки: каналы в строках, месяцы YYYY-MM в столбцах. Заполните пустые сочетания нулём, сохраните в result.',"result = orders.assign(month=orders.order_date.dt.strftime('%Y-%m')).pivot_table(index='channel',columns='month',values='revenue',aggfunc='sum',fill_value=0)",'pivot_table','Для сравнения каналов даты нужно привести к общему месячному уровню.','strftime задаёт год-месяц; pivot_table раскладывает периоды по колонкам.','`orders.order_date.dt.strftime("%Y-%m")`','Месячная схема позволяет сопоставить январь и февраль каждого канала.'),
 (None,'Количество по статусам','Постройте таблицу количества заказов: статусы в строках, города в столбцах. Нули для отсутствующих сочетаний, ключи по алфавиту. Сохраните в result.',"result = orders.pivot_table(index='status',columns='city',values='order_id',aggfunc='count',fill_value=0)",'pivot_table','Здесь нужен объём заказов, а не денежная сумма.','count номера заказа задаёт число строк каждой пары.','`pivot_table(index="status", columns="city", values="order_id", aggfunc="count", fill_value=0)`','Отдельные статусы делают отмены и возвраты видимыми в структуре заказов.'),
 (None,'Широкий отчёт в длинный','Сгруппируйте города с выручкой и числом заказов, затем превратите показатели в строки. Колонки: city, metric, value; сначала revenue, затем orders_count. Сохраните в result.',"wide = orders.groupby('city',as_index=False).agg(revenue=('revenue','sum'),orders_count=('order_id','count'))\nresult = wide.melt(id_vars='city',value_vars=['revenue','orders_count'],var_name='metric',value_name='value')",'melt','В длинной форме имя показателя становится значением отдельного поля.','melt сохраняет city и переносит два показателя в metric/value.','`wide.melt(id_vars="city", value_vars=["revenue", "orders_count"], var_name="metric", value_name="value")`','Длинная форма удобна для единых фильтров и сравнения разных показателей.'),
 (None,'Два показателя сводной','Соберите сводную городов: общая выручка и количество заказов. Используйте колонки order_id и revenue, города по алфавиту. Сохраните в result.',"result = orders.pivot_table(index='city',values=['order_id','revenue'],aggfunc={'order_id':'count','revenue':'sum'})",'pivot_table','Разные значения требуют разных агрегирующих функций в одной таблице.','aggfunc принимает словарь поля и функции.','`pivot_table(index="city", values=["order_id", "revenue"], aggfunc={"order_id": "count", "revenue": "sum"})`','Одна сводная связывает число заказов и деньги, сохраняя смысл каждого агрегата.'),
]),
('market-joins','Объединение таблиц',[
 ('merge-009','Лояльность клиентов','Добавьте к каждому заказу уровень лояльности клиента. Сохраните все заказы и проверьте связь многие-к-одному. Сохраните в result.',"result = orders.merge(customers[['customer_id','loyalty_level']],on='customer_id',how='left',validate='many_to_one')",'merge','У каждого клиента один уровень, но заказов может быть несколько.','left сохраняет заказы, validate проверяет уникальность клиентов.','`merge(customers[["customer_id", "loyalty_level"]], on="customer_id", how="left", validate="many_to_one")`','Проверка связи защищает выручку от размножения строк при присоединении справочника.'),
 (None,'Бренд товара','Добавьте бренд товара к каждому заказу, сохранив все строки и проверив уникальность товара справочника. Сохраните в result.',"result = orders.merge(products[['product','brand']],on='product',how='left',validate='many_to_one')",'merge','Бренд хранится в справочнике товаров, где каждый товар встречается один раз.','Соединение по product использует только нужные поля справочника.','`merge(products[["product", "brand"]], on="product", how="left", validate="many_to_one")`','Ограниченный набор полей предотвращает ненужные суффиксы одинаковых категорий.'),
 (None,'Не найденные клиенты','Найдите заказы, не нашедшие клиента в справочнике. Сохраните полную объединённую таблицу только таких заказов, включая поле _merge, в result.',"joined = orders.merge(customers,on='customer_id',how='left',indicator=True)\nresult = joined[joined._merge == 'left_only']",'merge','Отсутствующую связь нельзя надёжно искать по необязательному описательному полю.','indicator помечает источник ключа; left_only означает отсутствующего клиента.','`joined[joined._merge == "left_only"]`','Все 30 заказов находят клиента; пустой отбор подтверждает целостность справочника.'),
 (None,'Внутреннее и левое объединение','Сравните количество строк внутреннего и левого соединения заказов с клиентами. Сохраните словарь с ключами inner_rows и left_rows в result.',"result = {'inner_rows':len(orders.merge(customers,on='customer_id',how='inner')),'left_rows':len(orders.merge(customers,on='customer_id',how='left'))}",'merge','Полный справочник может дать одинаковые размеры разных типов объединения.','len каждого соединения показывает фактическое число строк.','`{"inner_rows": len(...), "left_rows": len(...)}`','Оба соединения дают 30 строк, потому что каждый клиент присутствует в справочнике.'),
 (None,'Выручка и стаж менеджера','Присоедините стаж менеджера и посчитайте выручку по стажу. Сохраните Series в result, стаж по возрастанию.',"result = orders.merge(managers[['manager','experience_years']],on='manager',validate='many_to_one').groupby('experience_years').revenue.sum()",'merge','Стаж — признак менеджера, поэтому сначала нужна связь со справочником.','merge по manager добавляет experience_years, groupby суммирует продажи.','`merge(managers[["manager", "experience_years"]], on="manager", validate="many_to_one")`','Присоединённый признак позволяет анализировать продажи по опыту без изменения заказов.'),
]),
('market-time','Временные ряды',[
 (None,'Выручка по месяцам','Посчитайте общую выручку по месяцам. Индекс YYYY-MM по возрастанию, сохраните Series в result.',"result = orders.groupby(orders.order_date.dt.strftime('%Y-%m')).revenue.sum()",'dates','Суммирование на уровне месяца объединяет календарные дни.','Группируйте по дате, отформатированной год-месяц.','`groupby(orders.order_date.dt.strftime("%Y-%m")).revenue.sum()`','Январь и февраль сравниваются по одинаковому месячному уровню.'),
 (None,'Будни и выходные','Посчитайте выручку будней и выходных. Индекс — False для будней, True для выходных. Сохраните Series в result.',"result = orders.revenue.groupby(orders.order_date.dt.dayofweek >= 5).sum()",'dates','Суббота и воскресенье — дни с номерами 5 и 6.','dt.dayofweek и сравнение >=5 создают две календарные группы.','`orders.revenue.groupby(orders.order_date.dt.dayofweek >= 5).sum()`','Календарное сравнение позволяет увидеть различия поведения покупателей по дням недели.'),
 (None,'День максимальных продаж','Найдите дату с максимальной суммарной выручкой. При равенстве выберите более раннюю дату, сохраните Timestamp в result.',"result = orders.groupby('order_date').revenue.sum().idxmax()",'dates','Сначала сложите заказы одного дня, затем найдите максимум дня.','idxmax возвращает метку максимальной суммы; группировка сортирует даты.','`groupby("order_date").revenue.sum().idxmax()`','Пиковый день определяется суммой всех его заказов, а не максимумом отдельного чека.'),
 (None,'Накопленная выручка','Посчитайте выручку каждого дня, затем её накопительную сумму по датам по возрастанию. Сохраните Series в result.',"result = orders.groupby('order_date').revenue.sum().cumsum()",'cumsum','Накопление должно идти в календарном порядке после дневной агрегации.','cumsum складывает текущий итог со всеми предыдущими.','`groupby("order_date").revenue.sum().cumsum()`','Накопительный итог показывает пройденный объём продаж на каждую дату.'),
 (None,'Неделя к предыдущей','Для недель с понедельника по воскресенье посчитайте выручку и разницу с предыдущей неделей. Индекс — начало недели YYYY-MM-DD; колонки revenue и change, первая разница пропущена. Сохраните в result.',"weekly = orders.set_index('order_date').revenue.resample('W-MON',closed='left',label='left').sum()\nresult = pd.DataFrame({'revenue':weekly,'change':weekly.diff()})\nresult.index = result.index.strftime('%Y-%m-%d')",'dates','Сравнение требует одинаковых недель, включая недели без продаж.','resample задаёт понедельничную границу; diff сравнивает соседние периоды.','`resample("W-MON", closed="left", label="left").sum()`','Регулярные недельные интервалы позволяют увидеть изменение, не пропуская пустые недели.'),
]),
('market-strings','Строки и категории',[
 (None,'Единый вид категорий','Приведите категории к нижнему регистру, уберите пробелы по краям. Сохраните Series в result.',"result = orders.category.str.strip().str.lower()",'strings','Одинаковый смысл должен иметь одинаковую запись перед группировкой.','str.strip убирает внешние пробелы, str.lower нормализует регистр.','`orders.category.str.strip().str.lower()`','Нормализация строк предотвращает ложные отдельные группы из-за регистра и пробелов.'),
 (None,'Заказы мониторов','Найдите товары, содержащие слово монитор без учёта регистра. Сохраните строки заказов в result.',"result = orders[orders['product'].str.contains('монитор',case=False,regex=False)]",'strings','Часть названия нужно искать независимо от заглавной буквы.','contains с case=False и regex=False ищет буквальный текст.','`str.contains("монитор", case=False, regex=False)`','Буквальный поиск не трактует текст как регулярное выражение.'),
 (None,'Коды каналов','Создайте Series кодов: Приложение → app, Сайт → web, Магазин → store. Сохраните в result.',"result = orders.channel.map({'Приложение':'app','Сайт':'web','Магазин':'store'})",'map','Словарь должен покрыть каждый существующий канал.','map заменяет значение по точному ключу словаря.','`orders.channel.map({"Приложение": "app", "Сайт": "web", "Магазин": "store"})`','Короткие коды сохраняют смысл каналов для обмена данными между инструментами.'),
 (None,'Лишние пробелы','Посчитайте число названий товаров с пробелами по краям. Сохраните целое число в result.',"result = int(orders['product'].ne(orders['product'].str.strip()).sum())",'strings','Проверка качества должна сравнить оригинал с очищенным названием.','ne находит отличие от str.strip, sum считает проблемные строки.',"`orders['product'].ne(orders['product'].str.strip()).sum()`",'В исходных названиях нет внешних пробелов; нулевой итог подтверждает проверку.'),
 (None,'Первая буква товара','Посчитайте выручку по первой букве названия товара в верхнем регистре. Сохраните Series в result, буквы по алфавиту.',"result = orders.revenue.groupby(orders['product'].str[0].str.upper()).sum()",'strings','Текстовый признак может стать новым ключом группировки.','str[0] выбирает первую букву, upper задаёт единый регистр.',"`orders.revenue.groupby(orders['product'].str[0].str.upper()).sum()`",'Производный текстовый ключ позволяет строить новые разрезы без изменения исходной таблицы.'),
]),
('market-mapping','Правила map и apply',[
 (None,'Коды статусов','Переведите статусы: Оплачен → paid, Возврат → returned, Отменён → cancelled. Сохраните Series в result.',"result = orders.status.map({'Оплачен':'paid','Возврат':'returned','Отменён':'cancelled'})",'map','Каждый статус должен получить однозначный короткий код.','map применяет словарь к каждому статусу.','`orders.status.map({"Оплачен": "paid", "Возврат": "returned", "Отменён": "cancelled"})`','Коды статусов не меняют положительные суммы выручки отмен и возвратов.'),
 (None,'Уровень повторного клиента','Посчитайте уникальные заказы клиента. Один заказ означает new, два — repeat, три и больше — loyal. Сохраните Series уровней с кодом клиента в индексе в result.',"counts = orders.groupby('customer_id').order_id.nunique()\nresult = counts.apply(lambda n: 'loyal' if n >= 3 else ('repeat' if n == 2 else 'new'))",'apply','Уровень зависит от покупок клиента, а не суммы его расходов.','apply с lambda выбирает одну из трёх меток по числу уникальных заказов.','`lambda n: "loyal" if n >= 3 else ("repeat" if n == 2 else "new")`','Границы уровня делают правило лояльности явным и воспроизводимым.'),
 (None,'Комментарий к оценке','Создайте комментарий для каждой оценки: пропуск → Нет отзыва, от 4 → Доволен, ниже 4 → Нужен контакт. Сохраните Series в result.',"result = orders.rating.apply(lambda rating: 'Нет отзыва' if pd.isna(rating) else ('Доволен' if rating >= 4 else 'Нужен контакт'))",'apply','Пропуск нужно обработать раньше сравнения с порогом.','pd.isna внутри lambda отделяет неизвестную оценку.','`lambda rating: "Нет отзыва" if pd.isna(rating) else (...)`','Неизвестный отзыв отделяется от негативной оценки и не получает ложный статус.'),
 (None,'Ценовые сегменты товаров','По справочнику товаров классифицируйте себестоимость: до 3 000 включительно → budget, до 10 000 включительно → middle, выше → premium. Сохраните Series с названиями товаров в индексе в result.',"result = products.set_index('product').cost_price.apply(lambda price: 'budget' if price <= 3000 else ('middle' if price <= 10000 else 'premium'))",'apply','Сегмент относится к себестоимости справочника, а не цене заказа.','set_index сохраняет название товара возле сегмента, apply использует два порога.','`lambda price: "budget" if price <= 3000 else ("middle" if price <= 10000 else "premium")`','Разделение цены продажи и себестоимости предотвращает смешение разных экономических показателей.'),
 (None,'map и apply дают один код','Получите коды статусов словарём через map и функцией через apply; сохраните словарь с булевым равенством и числом непереведённых значений. Ключи equal, missing.',"codes = {'Оплачен':'paid','Возврат':'returned','Отменён':'cancelled'}\nmapped = orders.status.map(codes)\napplied = orders.status.apply(lambda value: codes.get(value))\nresult = {'equal':mapped.equals(applied),'missing':int(mapped.isna().sum())}",'map','Совпадение подходов проверяется по значениям и индексу, а полнота — по пропускам.','equals сравнивает Series, isna считает отсутствующие переводы.','`{"equal": mapped.equals(applied), "missing": int(mapped.isna().sum())}`','Для полного словаря оба способа дают одинаковый перевод без пропусков.'),
]),
('market-charts','Визуализация продаж',[
 (None,'Выручка городов на графике','Постройте столбчатый график общей выручки городов по алфавиту. Заголовок Выручка городов, оси Город и Рубли. Сохраните Axes в result.',"result = orders.groupby('city').revenue.sum().plot(kind='bar',title='Выручка городов',xlabel='Город',ylabel='Рубли')",'plot','График должен показывать городской итог, а не отдельные заказы.','Агрегируйте groupby.sum перед plot(kind="bar").','`...plot(kind="bar", title="Выручка городов", xlabel="Город", ylabel="Рубли")`','Городские столбцы показывают вклад каждого региона в продажи.'),
 ('pandas-plots-003','Динамика продаж','Постройте линию суммарной выручки по датам по возрастанию. Заголовок Динамика выручки, оси Дата и Рубли. Сохраните Axes в result.',"result = orders.groupby('order_date').revenue.sum().plot(title='Динамика выручки',xlabel='Дата',ylabel='Рубли')",'plot','Временная линия требует упорядоченных дат и дневных итогов.','Группировка по order_date формирует упорядоченную Series для plot.','`groupby("order_date").revenue.sum().plot(...)`','Дневной график объединяет заказы одной даты и сохраняет календарный порядок.'),
 (None,'Каналы на одном графике','Покажите выручку каналов по месяцам на одном линейном графике. Месяцы YYYY-MM по возрастанию, каналы по алфавиту. Заголовок Каналы по месяцам, оси Месяц и Рубли. Сохраните Axes в result.',"monthly = orders.assign(month=orders.order_date.dt.strftime('%Y-%m')).pivot_table(index='month',columns='channel',values='revenue',aggfunc='sum',fill_value=0)\nresult = monthly.plot(title='Каналы по месяцам',xlabel='Месяц',ylabel='Рубли')",'plot','Несколько линий должны иметь одну общую временную ось.','Сводная даёт месяцам строки и каналам отдельные столбцы.','`monthly.plot(title="Каналы по месяцам", xlabel="Месяц", ylabel="Рубли")`','Общий масштаб помогает сравнить динамику каналов без разных осей.'),
 ('pandas-plots-006','Распределение доставки','Постройте гистограмму сроков доставки всех заказов с границами интервалов 0,1,2,3,4,5,6. Заголовок Срок доставки, оси Дни и Заказы. Сохраните Axes в result.',"result = orders.delivery_days.plot(kind='hist',bins=[0,1,2,3,4,5,6],title='Срок доставки',xlabel='Дни',ylabel='Заказы')",'plot','Гистограмма показывает частоты сроков, а не среднюю доставку города.','kind="hist" группирует числа в заданные bins.','`plot(kind="hist", bins=[0, 1, 2, 3, 4, 5, 6], ...)`','Нулевые сроки включают отмены и самовывоз, поэтому общий график требует осторожной интерпретации.'),
 (None,'Оценки категорий','Постройте столбчатый график средней оценки категорий без пропусков, категории по алфавиту. Заголовок Оценки категорий, оси Категория и Оценка. Сохраните словарь chart, best_category и means с графиком, лучшей категорией и средними оценками.',"means = orders.groupby('category').rating.mean()\nchart = means.plot(kind='bar',title='Оценки категорий',xlabel='Категория',ylabel='Оценка')\nresult = {'chart':chart,'best_category':means.idxmax(),'means':means.round(2).to_dict()}",'plot','Деловой вывод должен опираться на те же средние, что показаны на графике.','idxmax находит лучшую категорию, mean игнорирует неизвестные оценки.','`means = orders.groupby("category").rating.mean(); means.idxmax()`','Лучший средний отзыв определён расчётом, а график помогает увидеть остальные категории.'),
]),
('market-cases','Итоговые pandas-кейсы',[
 (None,'Изменение выручки города','Для Москвы сравните январь и февраль по каналу и категории. Верните таблицу с колонками january, february, change; отсутствующие продажи — ноль. Сохраните в result.',"sliced = orders[orders.city == 'Москва'].assign(month=lambda frame: frame.order_date.dt.strftime('%Y-%m'))\nreport = sliced.pivot_table(index=['channel','category'],columns='month',values='revenue',aggfunc='sum',fill_value=0).reindex(columns=['2026-01','2026-02'],fill_value=0)\nreport.columns = ['january','february']\nresult = report.assign(change=report.february-report.january)",'pivot_table','Падение нельзя предполагать заранее: сначала сравните фактические продажи каждого разреза.','Сводная по каналу и категории разделяет месяцы, разница показывает вклад.','`report.assign(change=report.february - report.january)`','Декомпозиция показывает, какие сочетания выросли и упали, без выдуманной причины.'),
 (None,'Отмены и доставка','По каналам рассчитайте процент отмен и среднюю доставку оплаченных заказов. Колонки cancel_pct, paid_delivery; округление один знак, каналы по алфавиту. Сохраните в result.',"cancel = orders.status.eq('Отменён').groupby(orders.channel).mean().mul(100)\npaid = orders[orders.status == 'Оплачен'].groupby('channel').delivery_days.mean()\nresult = pd.DataFrame({'cancel_pct':cancel,'paid_delivery':paid}).round(1)",'groupby','Доставку отменённых заказов нельзя считать фактической скоростью выполнения.','Считайте отмены по всем строкам, доставку только по оплаченной части.','`pd.DataFrame({"cancel_pct": cancel, "paid_delivery": paid}).round(1)`','Сопоставление не доказывает причинность, но даёт проверяемые показатели для дальнейшего расследования.'),
 (None,'Профиль лучшего клиента','Найдите клиента с наибольшей выручкой всех заказов. При равенстве первый код по алфавиту. Сохраните словарь customer_id, revenue, orders_count, home_city.',"totals = orders.groupby('customer_id').revenue.sum()\nbest = totals.idxmax()\nresult = {'customer_id':best,'revenue':int(totals.loc[best]),'orders_count':int(orders.loc[orders.customer_id == best,'order_id'].nunique()),'home_city':customers.set_index('customer_id').loc[best,'home_city']}",'merge','Лучшего клиента определяет агрегированная выручка, его город берётся из справочника.','idxmax выбирает клиента, loc извлекает профиль по ключу.','`best = orders.groupby("customer_id").revenue.sum().idxmax()`','Профиль объединяет деньги, повторные заказы и город одного конкретного клиента.'),
 (None,'Еженедельный отчёт','Соберите по неделям с понедельника оплаченные продажи: количество заказов, выручка и средний чек. Индекс начало недели YYYY-MM-DD, среднее два знака. Сохраните в result.',"result = orders[orders.status == 'Оплачен'].set_index('order_date').resample('W-MON',closed='left',label='left').agg(orders_count=('order_id','count'),revenue=('revenue','sum'),average_order=('revenue','mean')).round(2)\nresult.index = result.index.strftime('%Y-%m-%d')",'dates','Еженедельный управленческий отчёт должен фиксировать календарь и оплаченный статус.','resample группирует регулярные недели, agg связывает три показателя.','`resample("W-MON", closed="left", label="left").agg(...)`','Отчёт сохраняет календарные недели даже когда оплаченных продаж нет.'),
 (None,'Пять проверяемых выводов','Подкрепите пять выводов расчётом: общая выручка, доля отмен в процентах, лучший город, лучший канал и число повторных клиентов. Словарь total_revenue, cancel_pct, top_city, top_channel, repeat_customers; процент два знака.',"result = {'total_revenue':int(orders.revenue.sum()),'cancel_pct':round(float(orders.status.eq('Отменён').mean()*100),2),'top_city':orders.groupby('city').revenue.sum().idxmax(),'top_channel':orders.groupby('channel').revenue.sum().idxmax(),'repeat_customers':int((orders.groupby('customer_id').order_id.nunique() >= 2).sum())}",'agg','Каждый вывод должен иметь конкретную метрику и правило её расчёта.','sum, mean, idxmax и nunique отвечают на разные вопросы отчёта.','`orders.groupby("customer_id").order_id.nunique() >= 2`','Пять вычисленных фактов пригодны для отчёта; причинные выводы требуют дополнительного исследования.'),
]),
]

SQL = [
 ('Оплаченные дорогие заказы','Покажите номер, город и выручку оплаченных заказов дороже 10 000 рублей. Порядок номера по возрастанию.',"SELECT order_id, city, revenue FROM orders WHERE status = 'Оплачен' AND revenue > 10000 ORDER BY order_id",'WHERE исключает неподходящие строки до любых агрегатов.'),
 ('Выручка городов SQL','Посчитайте выручку каждого города; колонки city и revenue, города по алфавиту.',"SELECT city, SUM(revenue) AS revenue FROM orders GROUP BY city ORDER BY city",'GROUP BY создаёт один итог каждой группы.'),
 ('Сравнение каналов SQL','По каналам покажите количество заказов, выручку и средний чек с двумя знаками: channel, orders_count, revenue, average_order. Каналы по алфавиту.',"SELECT channel, COUNT(*) AS orders_count, SUM(revenue) AS revenue, ROUND(AVG(revenue),2) AS average_order FROM orders GROUP BY channel ORDER BY channel",'Несколько агрегатов описывают один уровень канала.'),
 ('Повторные клиенты SQL','Покажите клиентов с двумя и более уникальными заказами: customer_id, orders_count. Количество по убыванию, равенства по коду.',"SELECT customer_id, COUNT(DISTINCT order_id) AS orders_count FROM orders GROUP BY customer_id HAVING COUNT(DISTINCT order_id) >= 2 ORDER BY orders_count DESC, customer_id",'HAVING отбирает группы после агрегации.'),
 ('Отмены SQL','Посчитайте процент отмен по каналам с одним знаком: channel, cancel_pct. Каналы по алфавиту.',"SELECT channel, ROUND(100.0 * AVG(CASE WHEN status = 'Отменён' THEN 1 ELSE 0 END),1) AS cancel_pct FROM orders GROUP BY channel ORDER BY channel",'CASE превращает условие в число, среднее которого даёт долю.'),
 ('Три заказа города SQL','Получите три самых дорогих заказа каждого города оконной функцией. Колонки city, order_id, revenue, rank; город по алфавиту, ранг по возрастанию; равенства по номеру.',"WITH ranked AS (SELECT city, order_id, revenue, ROW_NUMBER() OVER (PARTITION BY city ORDER BY revenue DESC, order_id) AS rank FROM orders) SELECT city, order_id, revenue, rank FROM ranked WHERE rank <= 3 ORDER BY city, rank",'Окно ранжирует строки внутри города, не сворачивая их.'),
 ('Месяц к предыдущему SQL','Сравните месячную выручку с предыдущим месяцем. Колонки month, revenue, previous_revenue, change; первая предыдущая сумма и разница NULL, месяцы по возрастанию.',"WITH monthly AS (SELECT strftime('%Y-%m',order_date) AS month, SUM(revenue) AS revenue FROM orders GROUP BY month) SELECT month, revenue, LAG(revenue) OVER (ORDER BY month) AS previous_revenue, revenue-LAG(revenue) OVER (ORDER BY month) AS change FROM monthly ORDER BY month",'LAG сохраняет текущую строку и обращается к предыдущему периоду.'),
 ('Отчёт через CTE','Подготовьте через CTE оплаченный отчёт городов: city, orders_count, revenue. Сортировка выручки по убыванию, равенства по городу.',"WITH paid AS (SELECT * FROM orders WHERE status = 'Оплачен') SELECT city, COUNT(*) AS orders_count, SUM(revenue) AS revenue FROM paid GROUP BY city ORDER BY revenue DESC, city",'CTE отделяет бизнес-отбор от расчёта итогового отчёта.'),
 ('Клиенты через JOIN','Подтяните уровень лояльности клиента. Колонки order_id, customer_id, loyalty_level; сохраните все заказы, номера по возрастанию.',"SELECT o.order_id, o.customer_id, c.loyalty_level FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id ORDER BY o.order_id",'LEFT JOIN сохраняет заказ даже при отсутствии клиента справочника.'),
 ('Проверка размножения JOIN','Проверьте размер и уникальные номера после соединения клиентов. Одна строка с колонками rows_before, rows_after, unique_orders.',"SELECT (SELECT COUNT(*) FROM orders) AS rows_before, COUNT(*) AS rows_after, COUNT(DISTINCT o.order_id) AS unique_orders FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id",'Размер после JOIN и уникальные ключи выявляют размножение строк.'),
]

def field(key,label,type='text',options=None):
    item={'key':key,'label':label,'type':type}
    if options is not None:item['options']=options
    return item
VIS=field('visual','Визуализация','select',['bar','line','table'])
SUM='SUM(orders[revenue])'
EXCEL=[
 ('Импорт CSV в таблицу','Импортируйте CSV с запятой, заголовками, датой заказа и числовой выручкой; имя таблицы orders.',{'operation':'import','delimiter':',','headers':True,'table':'orders','types':{'order_date':'date','revenue':'number'}},[field('delimiter','Разделитель','select',[',',';']),field('headers','Первая строка — заголовки','checkbox'),field('table','Имя таблицы'),field('types.order_date','Тип даты','select',['date','text','number']),field('types.revenue','Тип выручки','select',['number','text'])]),
 ('Сводная городов и категорий','Постройте сводную выручки по городам и категориям через поля отчёта.',{'operation':'pivot','group_by':['city','category'],'measure':SUM},[field('group_by','Измерения','multiselect',['city','category','channel','status']),field('measure','Формула показателя')]),
 ('Выручка формулой Excel','Рассчитайте выручку каждой строки как количество × цена минус абсолютная скидка. Проверьте разницу с готовой выручкой.',{'operation':'formula','formula':'=[@quantity]*[@price]-[@discount]'},[field('formula','Формула вычисляемого столбца')]),
 ('Форматирование отмен','Выделите красным отменённые заказы по статусу.',{'operation':'format','column':'status','equals':'Отменён','style':'red'},[field('column','Поле','select',['status','channel','city']),field('equals','Равно','select',['Оплачен','Отменён','Возврат']),field('style','Цвет','select',['red','green','blue'])]),
 ('Лист руководителя','Создайте три KPI: выручка, количество заказов и средний чек. Имена показателей revenue, orders_count, average_order.',{'operation':'kpis','measures':{'revenue':SUM,'orders_count':'COUNTA(orders[order_id])','average_order':'AVERAGE(orders[revenue])'}},[field('measures.revenue','Выручка — формула'),field('measures.orders_count','Количество — формула'),field('measures.average_order','Средний чек — формула')]),
 ('Фильтр Excel','Отберите заказы сайта из Москвы и проверьте число строк и сумму выручки.',{'operation':'filter','filters':{'channel':'Сайт','city':'Москва'}},[field('filters.channel','Канал','select',['Сайт','Приложение','Магазин']),field('filters.city','Город','select',['Москва','Тула','Волгоград'])]),
 ('Средний чек формулой','Вычислите средний чек всех заказов формулой. Имя показателя average_order; округление проверяется до двух знаков.',{'operation':'measure','measures':{'average_order':'SUM(orders[revenue])/COUNTA(orders[order_id])'}},[field('measures.average_order','Формула среднего чека')]),
 ('Качество Excel','Проверьте пропуски в оценке, номере заказа и дате; дополнительно проверьте повторные номера.',{'operation':'quality','columns':['rating','order_id','order_date']},[field('columns','Поля проверки','multiselect',['rating','order_id','order_date','revenue','city'])]),
 ('График динамики Excel','Подготовьте линейный график ежедневной выручки по дате заказа.',{'operation':'chart','date_field':'order_date','period':'day','visual':'line','measure':SUM},[field('date_field','Поле даты','select',['order_date','delivery_days']),field('period','Период','select',['day','month']),VIS,field('measure','Формула выручки')]),
 ('Вывод для письма','Подкрепите вывод для руководителя: укажите город с наибольшей выручкой и числом общую выручку.',{'operation':'insight','claims':[{'metric':'top_city','value':'Москва'},{'metric':'revenue','value':398100}]},[field('claims.0.metric','Вывод 1','select',['top_city','top_channel']),field('claims.0.value','Категория вывода 1'),field('claims.1.metric','Вывод 2','select',['revenue','cancelled_orders']),field('claims.1.value','Число вывода 2','number')]),
]
BI=[
 ('Типы модели BI','Назначьте дату заказа как дату, выручку и номер заказа как числа, признак нового клиента как boolean.',{'operation':'import','types':{'order_date':'date','revenue':'number','order_id':'number','is_new_customer':'boolean'}},[field('types.order_date','Дата заказа','select',['date','text','number']),field('types.revenue','Выручка','select',['number','text']),field('types.order_id','Номер','select',['number','text']),field('types.is_new_customer','Новый клиент','select',['boolean','text'])]),
 ('Карточки BI','Создайте карточки выручки и количества заказов. Назовите меры revenue и orders_count.',{'operation':'cards','measures':{'revenue':SUM,'orders_count':'COUNTROWS(orders)'}},[field('measures.revenue','DAX выручки'),field('measures.orders_count','DAX количества')]),
 ('Разрез по городам BI','Создайте столбчатое сравнение выручки городов.',{'operation':'bar','group_by':['city'],'visual':'bar','measure':SUM},[field('group_by','Измерение','multiselect',['city','channel','category','status']),VIS,field('measure','DAX выручки')]),
 ('Срез канала BI','Добавьте фильтр канала Приложение и проверьте состав заказов и выручку отфильтрованного отчёта.',{'operation':'slicer','filters':{'channel':'Приложение'}},[field('filters.channel','Канал','select',['Сайт','Приложение','Магазин'])]),
 ('Мера среднего чека BI','Создайте DAX меру average_order: выручка на один заказ. Среднее проверяется до двух знаков.',{'operation':'measure','measures':{'average_order':'DIVIDE(SUM(orders[revenue]),COUNTROWS(orders))'}},[field('measures.average_order','DAX среднего чека')]),
 ('Месячная динамика BI','Постройте линейную динамику общей выручки по месяцам даты заказа.',{'operation':'line','date_field':'order_date','period':'month','visual':'line','measure':SUM},[field('date_field','Поле даты','select',['order_date','delivery_days']),field('period','Период','select',['day','month']),VIS,field('measure','DAX выручки')]),
 ('Качество доставки BI','Сравните города по средней доставке и оценке только оплаченных заказов; столбчатая визуализация.',{'operation':'delivery','filters':{'status':'Оплачен'},'group_by':'city','visual':'bar'},[field('filters.status','Статус','select',['Оплачен','Отменён','Возврат']),field('group_by','Разрез','select',['city','channel']),VIS]),
 ('Взаимодействия BI','Выберите Москву в городском графике и настройте фильтрацию графика каналов. Проверьте пересчитанную выручку каналов.',{'operation':'interactions','selected_city':'Москва','interaction':'filter'},[field('selected_city','Выбранный город','select',['Москва','Тула','Волгоград']),field('interaction','Взаимодействие','select',['filter','none'])]),
 ('Отмены отдельно BI','Покажите выручку отдельно по статусам столбчатым графиком, сохраняя отмены и возвраты самостоятельными группами.',{'operation':'status','group_by':['status'],'visual':'bar','measure':SUM},[field('group_by','Измерение','multiselect',['status','city','channel']),VIS,field('measure','DAX выручки')]),
 ('Три вывода BI','Подтвердите три вывода: лучший город по выручке, количество отменённых заказов и лучший канал по выручке.',{'operation':'insights','claims':[{'metric':'top_city','value':'Москва'},{'metric':'cancelled_orders','value':2},{'metric':'top_channel','value':'Приложение'}]},[field('claims.0.metric','Метрика 1','select',['top_city','top_channel']),field('claims.0.value','Категория 1'),field('claims.1.metric','Метрика 2','select',['cancelled_orders','revenue']),field('claims.1.value','Число 2','number'),field('claims.2.metric','Метрика 3','select',['top_city','top_channel']),field('claims.2.value','Категория 3')]),
]
# Source values are always derived, including evidence-backed written insights.
total = int(tables['orders'].revenue.sum())
top_city = tables['orders'].groupby('city').revenue.sum().idxmax()
top_channel = tables['orders'].groupby('channel').revenue.sum().idxmax()
EXCEL[-1][2]['claims'][0]['value']=top_city
EXCEL[-1][2]['claims'][1]['value']=total
BI[-1][2]['claims'][0]['value']=top_city
BI[-1][2]['claims'][2]['value']=top_channel

def install_section(slug,title, rows, section, mode='python'):
    global next_topic
    topic_id = existing_topics.get(slug,{}).get('id',next_topic)
    novel=[]; techniques=[]
    for source_pos,row in enumerate(rows,1):
        if mode=='python':
            reuse,name,instructions,solution,method,h1,h2,h3,completion=row
            eid=reuse or f'{slug}-{len(novel)+1:03}'
            url=DOCS[method]
            starter=SETUP+'\n\nresult = None'
            response=None
            explanation=h2+' '+completion+' Проверка сравнивает вычисленные значения, индекс, порядок полей и точность; альтернативное корректное выражение допустимо.'
        elif mode=='sql':
            name,instructions,solution,completion=row
            eid=f'{slug}-{len(novel)+1:03}';reuse=None;method='SQL';url=DOCS['sql'];starter='SELECT NULL AS answer';response=None
            h1='Определите строки и уровень отчёта до выбора агрегата.'
            h2=completion
            h3='`'+solution.replace('revenue','...')+'`'
            explanation=completion+' Запрос выполняется в отдельной памяти SQLite по тем же CSV; порядок колонок и строк указан в условии. Точность ROUND должна совпадать с денежным или процентным показателем.'
        else:
            name,instructions,spec,fields=row
            eid=f'{slug}-{len(novel)+1:03}';reuse=None;method=mode;url=DOCS[mode]
            solution=json.dumps(spec,ensure_ascii=False,indent=2)
            initial=copy.deepcopy(spec)
            for f in fields:
                parts=f['key'].split('.'); target=initial
                for part in parts[:-1]: target=target[int(part)] if isinstance(target,list) else target[part]
                key=int(parts[-1]) if isinstance(target,list) else parts[-1]
                target[key]= False if f['type']=='checkbox' else ([] if f['type']=='multiselect' else (0 if f['type']=='number' else ''))
            response={'fields':fields,'initial':initial};starter=json.dumps(initial,ensure_ascii=False)
            h1='Сначала выберите смысл отчёта: '+instructions
            h2='Настройки применяются к реальным заказам: формулы пересчитываются, фильтры меняют состав строк.'
            h3='Синтаксический ориентир: `'+json.dumps(spec,ensure_ascii=False)+'`'
            completion='Расчёт «'+name+'» подтверждён значениями канонических заказов. Настройки отчёта и данные вычисляются вместе.'
            explanation='Это учебный симулятор '+('Excel' if mode=='excel' else 'Power BI')+'. Он вычисляет таблицы, KPI, формулы и выбранные разрезы; настоящий рабочий файл не создаётся. Поддерживается только явно описанный набор формул и настроек. '+instructions
        task=copy.deepcopy(old_tasks[eid]) if reuse else {'id':eid,'topic_id':topic_id,'difficulty':min(3,1+(source_pos-1)//4),'is_control':source_pos==len(rows),'xp':25}
        task['knowledge_unit_id']=task.get('knowledge_unit_id') or f'ku-{slug}'
        task.update(title=name,instructions='KODA Market. '+instructions+(' Сохраните ответ в result.' if mode=='python' and 'result' not in instructions else ''),focus=method,
          learning_objective=f'{title}: {name}. '+completion, result_variable='result',expected_type='auto',setup_code=SETUP if mode=='python' else '',
          starter_code=starter,solution_code=solution,theory_article_id=f'theory-{eid}',required_tokens=[],tests=['values','shape','column_order','index','dtype','input_immutability'],dataset=copy.deepcopy(DATA),
          hints=[{'level':i,'text':text} for i,text in enumerate((h1,h2,h3),1)],completion_summary=completion,explanation=explanation,
          exercise_mode=mode,source_section=section,source_position=source_pos,source_title='KODA Market — полный банк задач',source_version='2026-10-07')
        if response: task['response_spec']=response
        result=run(solution,task['dataset'],'result',setup_code=task['setup_code'],exercise_mode=mode)
        if not result.get('ok'):raise RuntimeError((eid,result))
        task['expected_result']={key:value for key,value in result['result'].items() if key!='image'}
        task['output_contract']={'kind':result['result']['kind'],'columns':result['result'].get('columns'), 'index':result['result'].get('index'), 'dtypes':result['result'].get('dtypes'), 'precision':'Точность и порядок заданы в условии; сравниваются значения, а не текст решения.'}
        if mode=='python' and result['result']['kind']=='plot':task['expected_type']='plot'
        if reuse:
            old_tasks[eid].update(task)
        else:novel.append(task)
        editorial['tasks'][eid]={key:task[key] for key in ('title','instructions','learning_objective','hints','completion_summary','explanation','setup_code','starter_code','solution_code')}
        mapping.append({'section':section,'point':source_pos+10 if slug=='market-groupby-report' else source_pos,'task_id':eid,'disposition':'extend' if reuse else 'add','primary_skill':method,'reason':'Existing stable skill task extended to canonical Market context.' if reuse else 'Distinct source objective requires a runnable step; no renamed-literal variants added.'})
        task['knowledge_unit_id']=task.get('knowledge_unit_id') or f'ku-{slug}'
        task['concepts']=[method];task['required_methods']=[];task['documentation_urls']=[url]
        techniques.append((method,url,{'groupby':"frame.groupby('city').sales.sum()",'transform':"frame.groupby('city').sales.transform('sum')",'isna':'frame.isna().sum()','dates':"pd.to_datetime(['2026-01-01'])",'SQL':'SELECT city, SUM(sales) FROM sales GROUP BY city','excel':'=SUM(orders[revenue])','power-bi':'SUM(orders[revenue])'}.get(method, "frame.head()")))
    # Reused objectives retain their old KU. New units contain no more than ten steps.
    if novel:
        assert len(novel)<=10
        topic={'id':topic_id,'slug':slug,'title':title,'summary':f'{len(novel)} шагов проекта KODA Market','theory':title,'syntax':mode if mode!='python' else title,'example':novel[0]['solution_code'],'mistakes':['Неверный бизнес-статус','Неправильная единица наблюдения'],'methods':list(dict.fromkeys(r['focus'] for r in novel)),'exercises':novel}
        existing_module=next((m for m in catalog['modules'] if m['slug']==slug),None)
        module={'id':topic_id,'slug':slug,'title':title,'description':topic['summary'],'order':topic_id,'bank_version':2,'topics':[topic]}
        if existing_module:catalog['modules'][catalog['modules'].index(existing_module)]=module
        else:catalog['modules'].append(module)
        unique=list(dict.fromkeys(techniques))
        if slug not in authored_teaching:raise ValueError(f'{slug}: separately authored teaching is required')
        sheet,article=authored_teaching[slug]['cheatSheet'],authored_teaching[slug]['article']
        old_units[f'ku-{slug}']={'id':f'ku-{slug}','slug':slug,'title':title,'sourceTitle':'KODA Market — полный банк задач','sourceVersion':'2026-10-07','cheatSheet':sheet,'article':article,'createdAt':'2026-10-07T00:00:00Z','updatedAt':'2026-10-07T00:00:00Z'}
        if slug not in existing_topics:next_topic+=1

for i,(slug,title,rows) in enumerate(SECTIONS,1):install_section(slug,title,rows,6 if i==7 else i if i<7 else i-1)
install_section('market-sql','SQL: продажи KODA Market',SQL,17,'sql')
install_section('market-excel','Excel: учебный симулятор',EXCEL,18,'excel')
install_section('market-power-bi','Power BI: учебный симулятор',BI,19,'power-bi')
all_tasks={e['id']:e for m in catalog['modules'] for t in m['topics'] for e in t['exercises']}
consolidations=[
 ('market-joins-001','merge-009', 'Присоединение лояльности и бренда',
  'Добавьте к каждому заказу уровень лояльности клиента и бренд товара. Сохраните все заказы, проверив обе связи многие-к-одному; столбцы справочников в порядке loyalty_level, brand. Сохраните result.',
  "result = orders.merge(customers[['customer_id','loyalty_level']],on='customer_id',how='left',validate='many_to_one').merge(products[['product','brand']],on='product',how='left',validate='many_to_one')",
  'Два справочника присоединяются по своим ключам без размножения заказов; состав полей задаётся явно.'),
 ('market-strings-003','market-mapping-001','Коды каналов и статусов',
  'Создайте таблицу двух коротких кодов: channel_code для каналов app/web/store и status_code для статусов paid/returned/cancelled. Сохраните исходный индекс и этот порядок полей в result.',
  "result = pd.DataFrame({'channel_code':orders.channel.map({'Приложение':'app','Сайт':'web','Магазин':'store'}),'status_code':orders.status.map({'Оплачен':'paid','Возврат':'returned','Отменён':'cancelled'})})",
  'map переводит оба категориальных поля полными словарями. Каждый код сохраняет индекс исходного заказа.'),
 ('market-features-003','change-columns-008','Признаки размера и доставки',
  'Создайте копию заказов с двумя булевыми полями: is_large для выручки не меньше 15 000 и is_slow для доставки строго дольше трёх дней. Добавьте поля именно в этом порядке, сохраните result.',
  "result = orders.assign(is_large=orders.revenue >= 15000,is_slow=orders.delivery_days > 3)",
  'Не меньше включает границу размера, строго дольше исключает границу срока. Оба сравнения создают булевы признаки.'),
 ('market-quality-001','market-overview-002','Профиль отсутствующих данных',
  'Посчитайте пропуски по полям и покажите только поля с пропусками в result.',
  "missing = orders.isna().sum()\nresult = missing[missing > 0]",
  'Две отсутствующие оценки — единственная проблема полноты файла. isna считает отсутствие без замены его нулём.'),
]
for removed, retained, title, instructions, solution, completion in consolidations:
    task=all_tasks[retained]
    task.update(title=title,instructions='KODA Market. '+instructions,solution_code=solution,completion_summary=completion,
                learning_objective=title+': '+completion,explanation=completion+' Словарь полей и порядок ответа фиксируют техническую схему, исходные заказы сохраняются.')
    if retained=='merge-009':
        task['hints']=[{'level':1,'text':'Каждый справочник содержит одну запись на ключ, а заказов у ключа может быть несколько.'},{'level':2,'text':'Соедините customers по customer_id, затем products по product, в обоих вызовах how="left" и validate="many_to_one".'},{'level':3,'text':'`orders.merge(customers[["customer_id", "loyalty_level"]], on="customer_id", how="left", validate="many_to_one").merge(...)`'}]
    elif retained=='market-mapping-001':
        task['hints']=[{'level':1,'text':'Перевод сохраняет исходную строку; нужны два независимых столбца кодов.'},{'level':2,'text':'Примените map к channel и status с полными словарями, затем соберите DataFrame.'},{'level':3,'text':'`pd.DataFrame({"channel_code": orders.channel.map({...}), "status_code": orders.status.map({...})})`'}]
    elif retained=='change-columns-008':
        task['hints']=[{'level':1,'text':'У размера граница включена, у долгой доставки три дня ещё допустимы.'},{'level':2,'text':'assign добавляет два признака, сравнения >= и > создают значения True/False.'},{'level':3,'text':'`orders.assign(is_large=orders.revenue >= 15000, is_slow=orders.delivery_days > 3)`'}]
    result=run(solution,task['dataset'],setup_code=task['setup_code'])
    assert result.get('ok'), result
    task['expected_result']={key:value for key,value in result['result'].items() if key!='image'}
    task['output_contract']={'kind':result['result']['kind'],'columns':result['result'].get('columns'),'index':result['result'].get('index'),'dtypes':result['result'].get('dtypes'),'precision':'Порядок и точность заданы в условии.'}
    editorial['tasks'][retained]={k:task[k] for k in ('title','instructions','learning_objective','hints','completion_summary','explanation','setup_code','starter_code','solution_code')}
    for record in mapping:
        if record['task_id'] in {removed,retained}:
            action='reuse' if record['task_id']==removed else 'extend'
            record.update(task_id=retained,disposition=action,reason=completion+' The same primary technique is practised once; both source objectives map to the combined task.')
    for m in catalog['modules']:
        for t in m['topics']:
            t['exercises']=[e for e in t['exercises'] if e['id']!=removed]
    theory['articles'].pop('theory-'+removed,None)
    editorial['tasks'].pop(removed,None)
for slug, teaching in authored_teaching.items():
    if f'ku-{slug}' in old_units:
        old_units[f'ku-{slug}']['article']=teaching['article']
        old_units[f'ku-{slug}']['cheatSheet']=teaching['cheatSheet']
        old_units[f'ku-{slug}']['sourceTitle']='KODA Market — полный банк задач'
        old_units[f'ku-{slug}']['sourceVersion']='2026-10-07'
for slug,title,rows in SECTIONS:
    if f'ku-{slug}' in old_units and slug not in authored_teaching:
        raise ValueError(f'{slug}: separately authored Market teaching is required; no generated fallback is permitted')
for slug in ('market-sql','market-excel','market-power-bi'):
    if slug not in authored_teaching:raise ValueError(f'{slug}: separately authored native-mode teaching is required')
MODE_GUIDES={
 'import':('Импорт превращает текстовый файл в типизированную таблицу; дата и число должны поддерживать дальнейшие расчёты.','Проверьте запятую, заголовки и календарный тип даты; денежное поле должно быть числом.','Дата: `order_date → date`; выручка: `revenue → number`.','Правильные типы сохраняют календарные фильтры и числовую агрегацию; импорт проверяется на реальных 30 строках.'),
 'pivot':('Сводная должна объединить продажи отдельно каждой пары город — категория.','Выберите два измерения city/category и сумму поля revenue.','Показатель: `SUM(orders[revenue])`, измерения: `city`, `category`.','Сводная складывает реальные продажи сочетаний; сумма отличается от среднего чека и количества заказов.'),
 'formula':('Скидка задана в рублях на весь заказ, поэтому её вычитают один раз после умножения.','Структурированные ссылки [@...] обращаются к полям текущей строки таблицы.','`=[@quantity]*[@price]-[@discount]`','Вычисленная выручка совпадает с источником в каждой строке; разницы равны нулю.'),
 'format':('Отмену определяет статус, а не знак денежной суммы.','Условное выделение сравнивает status с Отменён и задаёт красный стиль.','Правило: `status = "Отменён"`, цвет: `red`.','Красным отмечены ровно два отменённых заказа, их исходная положительная выручка сохранена.'),
 'kpis':('Руководителю нужны разные масштабы: сумма денег, число заказов и деньги на один заказ.','SUM считает деньги, COUNTA считает заполненные номера, AVERAGE даёт средний чек.','`=SUM(orders[revenue])`; `=COUNTA(orders[order_id])`; `=AVERAGE(orders[revenue])`.','Три KPI согласованы: средний чек равен общей выручке, делённой на 30 заказов.'),
 'cards':('Карточка показывает один показатель, сохраняя его агрегирующее правило.','SUM выручки и COUNTROWS таблицы отвечают на разные вопросы.','`SUM(orders[revenue])` и `COUNTROWS(orders)`.','Карточки показывают 385 000 рублей и 30 заказов одного и того же набора.'),
 'filter':('Оба фильтра действуют одновременно и ограничивают один набор заказов.','Задайте канал Сайт и город Москва; проверьте номера оставшихся заказов и их сумму.','Срез: `channel = "Сайт"`, `city = "Москва"`.','Двойной фильтр пересчитывает состав таблицы и выручку только московских заказов сайта.'),
 'slicer':('Фильтр должен менять весь расчёт отчёта, а не только подпись канала.','Выберите Приложение; состав заказов и выручка пересчитаются по выбранному каналу.','Срез: `channel = "Приложение"`.','Срез приложения вычисляет выручку и номера только реально попавших под фильтр заказов.'),
 'measure':('Средний чек сравнивает деньги с числом заказов в одном контексте.','Разделите сумму выручки на число заказов; прямое среднее полного поля равно этому отношению.','Excel: `=AVERAGE(orders[revenue])`; DAX: `DIVIDE(SUM(orders[revenue]),COUNTROWS(orders))`.','Средний чек всех заказов равен 12 833,33 рубля; отмены включены в общий набор, поскольку оплаченный статус не выбран.'),
 'quality':('Отсутствующая оценка и повторный номер — разные проблемы, требующие отдельных проверок.','Выберите rating, order_id и order_date для полноты; проверка номеров дополнительно ищет дубликаты.','Поля качества: `rating`, `order_id`, `order_date`.','Найдены две отсутствующие оценки и ноль повторных номеров; ключ заказа и дата заполнены.'),
 'chart':('Динамика требует хронологической оси и суммарной выручки на каждом дне.','Выберите order_date, период day и линию; мерой остаётся сумма выручки.','Период: `day`; визуализация: `line`; показатель: `SUM(orders[revenue])`.','Линия построена по вычисленным дневным суммам, а не по случайным точкам или средним.'),
 'line':('Календарные месяцы объединяют ежедневные продажи в сопоставимые периоды.','Выберите month для даты order_date и линейную визуализацию общей выручки.','Период: `month`; визуализация: `line`; DAX: `SUM(orders[revenue])`.','Месячная линия содержит реальные суммы января и февраля в календарном порядке.'),
 'bar':('Город — категориальное измерение, поэтому столбцы подходят для сравнения сумм.','Измерение city группирует данные; SUM выручки вычисляет высоту столбца.','Разрез: `city`; визуализация: `bar`; DAX: `SUM(orders[revenue])`.','Каждый столбец показывает рассчитанную выручку города; смена измерения меняет бизнес-вопрос.'),
 'delivery':('Доставка отменённых заказов не описывает скорость выполнения оплаченных покупок.','Ограничьте status значением Оплачен, затем сравните города по средней доставке и оценке.','Фильтр: `status = "Оплачен"`; разрез: `city`; визуализация: `bar`.','Показатели качества доставки рассчитаны только по оплаченной части; неизвестные оценки не превращаются в ноль.'),
 'interactions':('Выбор города должен сузить строки второго графика, а не оставить общие итоги.','Настройте взаимодействие filter и выберите Москву; канальная выручка пересчитается внутри города.','Выбранный город: `Москва`; взаимодействие: `filter`.','Выбор города изменяет расчёт графика каналов; результаты совпадают с московскими заказами.'),
 'status':('Положительная выручка отмены не делает заказ оплаченным; статусы должны оставаться раздельными.','Используйте status как измерение столбцов и сумму revenue как показатель.','Разрез: `status`; визуализация: `bar`; DAX: `SUM(orders[revenue])`.','Отмена и возврат показаны отдельными группами, поэтому общий итог не выдаётся за оплаченные продажи.'),
 'insight':('Короткий вывод для письма должен содержать проверяемую категорию и денежное число.','Лучший город определяется максимальной городской суммой, общая выручка — суммой всех заказов.','Метрики доказательств: `top_city` и `revenue`.','Лидер выручки и общий денежный итог подтверждены расчётом; утверждение о причине роста из этих данных не следует.'),
 'insights':('Три вывода описывают разные факты: лидер города, отмены и лидер канала.','Для лидеров сравните групповые суммы; отмены посчитайте по статусу, не по знаку выручки.','Метрики доказательств: `top_city`, `cancelled_orders`, `top_channel`.','Все три утверждения согласованы с дашбордом и каноническими заказами; неподтверждённые значения не принимаются.'),
}
for m in catalog['modules']:
 for t in m['topics']:
  for task in t['exercises']:
   if task.get('exercise_mode') in {'excel','power-bi'}:
    op=json.loads(task['solution_code'])['operation']
    h1,h2,h3,completion=MODE_GUIDES[op]
    # Mode-specific native syntax is shown only for the tool actually being practised.
    if op=='measure': h3='`=AVERAGE(orders[revenue])`' if task['exercise_mode']=='excel' else '`DIVIDE(SUM(orders[revenue]),COUNTROWS(orders))`'
    if op=='import' and task['exercise_mode']=='power-bi':
     h1='Модель отчёта различает календарные даты, числовые показатели, ключи и булевы признаки.'
     h2='Назначьте order_date календарный тип, revenue/order_id числовой тип и is_new_customer булевый тип.'
     h3='Типы модели: `order_date → date`, `revenue → number`, `order_id → number`, `is_new_customer → boolean`.'
    task['hints']=[{'level':i,'text':text} for i,text in enumerate((h1,h2,h3),1)]
    if op=='measure':completion += (' DAX мера пересчитывается в контексте фильтра отчёта.' if task['exercise_mode']=='power-bi' else ' Структурированная ссылка охватывает полный столбец таблицы orders.')
    if op=='import':completion += (' Типы назначены модели, включая булевый признак нового клиента.' if task['exercise_mode']=='power-bi' else ' Заголовки и имя таблицы позволяют использовать структурированные ссылки Excel.')
    task['completion_summary']=completion
    task['explanation']=h2+' '+('Учебный симулятор вычисляет выбранные показатели и настройки на канонических CSV; реальный файл Excel/Power BI не создаётся.')
    editorial['tasks'][task['id']].update(hints=task['hints'],completion_summary=completion,explanation=task['explanation'])
   if task.get('source_title'):
    if task['id']=='filtering-002':task['title']='Доставка не дольше двух дней'
    if task['id']=='filtering-008':task['title']='Заказы Москвы и Тулы'
    # Learning data exposes only lookup tables actually needed by this objective.
    needed=['orders']+[name for name in ('customers','products','managers') if name in task['solution_code'] or (task.get('exercise_mode')=='sql')]
    task['dataset']={'files':{f'koda_market_{name}.csv':files[f'koda_market_{name}.csv'] for name in needed},**{name:copy.deepcopy(DATA[name]) for name in needed}}
    if task.get('exercise_mode','python')=='python':
     task['setup_code']='import pandas as pd\n'+ '\n'.join(f"{name} = pd.read_csv('koda_market_{name}.csv'"+(", parse_dates=['order_date'])" if name=='orders' else ')') for name in needed)+"\ndf = orders.copy()\ncsv_path = 'koda_market_orders.csv'"
     task['starter_code']=task['setup_code']+'\n\nresult = None'
    if task['id']=='reading-009':
     task['dataset']={'files':{'koda_market_orders.csv':files['koda_market_orders.csv']},'variables':{'csv_path':'koda_market_orders.csv'}}
     task['preview_dataset']={'orders':copy.deepcopy(DATA['orders'])}
     task['setup_code']="import pandas as pd\ncsv_path = 'koda_market_orders.csv'"
     task['starter_code']=task['setup_code']+'\n\nresult = None'
     task['required_tokens']=['read_csv']
     task['required_calls']=['read_csv']
    if task['id'] in {'market-groupby-002','market-groupby-report-002'}:
     task['required_tokens']=['agg']
     task['required_calls']=['agg']
     task['instructions']+=' Используйте именованные агрегации agg.'
    if task['id'].startswith('market-transform-'):
     task['required_tokens']=['transform']
     task['required_calls']=['transform']
     task['instructions']+=' Примените transform, чтобы сопоставить групповой показатель с каждой строкой.'
    editorial['tasks'][task['id']].update(title=task['title'],instructions=task['instructions'],setup_code=task['setup_code'],starter_code=task['starter_code'])
    unit=old_units[task['knowledge_unit_id']]
    entries=unit['cheatSheet']['entries']
    selected=[entry for entry in entries if task['focus'].lower() in entry['name'].lower()]
    if not selected:selected=entries
    sections=unit['article']['sections']
    theory['articles'][task['theory_article_id']]={'id':task['theory_article_id'],'title':'Разбор: '+task['title'],'knowledge_unit_id':unit['id'],
      'introduction':unit['article']['lead'], 'methods':[{'name':entry['name'],'description':' '.join(next((section['paragraphs'] for section in sections if entry['id'] in section.get('covers',[])),[entry['description']])),
      'syntax':entry['example'],'keyParameters':[], 'parameterGuide':task['output_contract']['precision'], 'example':entry['example'],'notes':[task['completion_summary']],
      'documentationUrl':entry['documentationUrl'],'documentationLabel':entry['name']} for entry in selected]}
write(ROOT/'content/catalog.json',catalog)
write(ROOT/'content/theory_bank.json',theory)
write(ROOT/'content/task_editorial.json',editorial)
write(ROOT/'content/knowledge_units.json',{'version':1,'units':list(old_units.values())})
final_tasks={e['id']:e for m in catalog['modules'] for t in m['topics'] for e in t['exercises']}
structural_groups=defaultdict(list)
def signature(task):
    if task.get('exercise_mode','python')!='python':
        return task.get('exercise_mode')+':'+task['solution_code']
    tree=ast.parse(task['solution_code'])
    columns=set().union(*(set(value) for key,value in task['dataset'].items() if key not in {'files','variables','series'} and isinstance(value,dict)))
    semantic={'sum','mean','count','nunique','stable','date','number','boolean','many_to_one','left','inner'}
    for node in ast.walk(tree):
        if isinstance(node,ast.Name):node.id='VARIABLE'
        elif isinstance(node,ast.Attribute) and node.attr in columns:node.attr='COLUMN'
        elif isinstance(node,ast.Constant) and node.value not in semantic:node.value='COLUMN' if node.value in columns else 'CONSTANT'
    return ast.dump(tree,include_attributes=False)
for task in final_tasks.values():structural_groups[signature(task)].append(task['id'])
candidate_groups=[ids for ids in structural_groups.values() if len(ids)>1 and any(final_tasks[eid].get('source_title') for eid in ids)]
for record in mapping:
    task=final_tasks[record['task_id']]
    record['learning_objective']=task['learning_objective']
    record['output_schema']=task['output_contract']
    record['normalized_solution_structure']=signature(task)
    record['comparison_candidates']=next((ids for ids in candidate_groups if task['id'] in ids),[])
    if record['disposition']=='add':
        record['reason']=task['learning_objective']+' Prepared canonical inputs, declared output schema and normalized operation structure are recorded for comparison; no renamed-variable variants are retained.'
dedup_reviews=[{'task_ids':ids,'decision':'retained distinct statistical objective or documented edge case','evidence':'Mean rating ignores two missing reviews; mean complete revenue has no missing-review decision. Sum versus count changes a money metric into an order-volume metric. transform sum versus mean is an explicit aggregation-parameter step. Filtering/sorting foundation variants predate this import and preserve their existing progress IDs.'} for ids in candidate_groups]
write(ROOT/'reports/market-source-disposition.json',{'source_version':'2026-10-07','sources':{name:hashlib.sha256(raw.encode('utf-8')).hexdigest() for name,raw in files.items()},'canonical_shape':[30,18],'discount':'absolute rubles per order','cancelled_revenue':'positive source values preserved; financial paid views filter status','objectives':mapping,'groupby_lesson':'All 12 original objectives preserved: source section6 including explicit points11 and12.','deduplication':{'consolidated_provisional_tasks':[{'removed_provisional_id':row[0],'retained_id':row[1],'evidence':row[5]} for row in consolidations],'reviewed_candidates':dedup_reviews},'original_task_ids_preserved':200,'market_distinct_tasks':len({record['task_id'] for record in mapping}),'foundation_tasks_extended':len({record['task_id'] for record in mapping if not record['task_id'].startswith('market-')})})
write_course_manifest({'objectives':mapping})
contract=['# KODA Market exercise modes','', 'All requests retain {exercise_id, code}. SQL code is native SELECT/WITH SQL. Excel/Power BI code is serialized JSON built from response_spec controls; it is not Python. Every mode runs inside the existing task execution subprocess. Free practice remains browser Pyodide only.', '', 'response_spec = {fields:[{key,label,type,options?}],initial:object}. Dot keys address nested object fields or numeric array indices. Supported types: text, number, select, checkbox, multiselect. The initial operation is fixed; fields contain the editable settings. Result shape stays {ok,result,stdout,execution_ms}; report result.kind is scalar with calculated data; SQL kind is dataframe. Validation compares calculations and semantic output against independently executed references. Key order and supported equivalent formulas are accepted.', '', 'Supported formulas: Excel =SUM(orders[revenue]), =COUNT/COUNTA(orders[order_id]), =AVERAGE(orders[revenue]), =SUM(...)/COUNT/COUNTA(...), =[@quantity]*[@price]-[@discount]. BI SUM(orders[revenue]), COUNTROWS(orders), COUNT(orders[order_id]), AVERAGE(orders[revenue]), DIVIDE(SUM(orders[revenue]),COUNTROWS(orders)). Case and whitespace are ignored. No expression evaluation or arbitrary extensions.', '', 'These simulators do not create .xlsx/.pbix files, run desktop Office, or claim full native feature coverage. Charts are calculated report specifications rendered by the frontend; interactions recalculate the selected city/channel aggregates. Written conclusions are structured metric/evidence claims.','']
for m in catalog['modules']:
 for t in m['topics']:
  for e in t['exercises']:
   if e.get('response_spec'):
    contract.extend(['## '+e['id'],e['instructions'],'```json',json.dumps(e['response_spec'],ensure_ascii=False,indent=2),'```',''])
(ROOT/'docs/new-modes-contract.md').write_text('\n'.join(contract),encoding='utf-8')
print(f'Market source objectives integrated: {len(mapping)}; {len({m["task_id"] for m in mapping})} distinct tasks, including {len({m["task_id"] for m in mapping if not m["task_id"].startswith("market-")})} extended foundation IDs.')
