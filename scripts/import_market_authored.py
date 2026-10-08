"""Idempotent import of the complete authored bank; no learner prose generation."""
import copy
import ast
import json
import sys
from pathlib import Path
import pandas as pd
from market_authored_references import REFERENCES
from parse_market_authored import parse

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.runner import run

def load(name): return json.loads((ROOT/'content'/name).read_text(encoding='utf-8'))
def write(path,value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def without_images(value):
    if isinstance(value,dict): return {k:without_images(v) for k,v in value.items() if k!='image'}
    if isinstance(value,list): return [without_images(v) for v in value]
    return value

def integrate():
    authored=parse()
    native=load('market_native_v2.json')
    catalog,theory,editorial,knowledge=(load(n) for n in ('catalog.json','theory_bank.json','task_editorial.json','knowledge_units.json'))
    topics={t['slug']:t for m in catalog['modules'] for t in m['topics']}
    tasks={e['id']:e for t in topics.values() for e in t['exercises']}
    units={u['slug']:u for u in knowledge['units']}
    for slug,unit in units.items():
        if slug not in topics:
            topic={'id':int(unit['topicId']),'slug':slug,'title':unit['title'],'summary':unit['description'],'theory':unit['article']['lead'],'syntax':'','example':'','mistakes':[],'methods':unit['methods'],'exercises':[],'knowledge_only':True}
            catalog['modules'].append({'id':topic['id'],'slug':slug,'title':unit['title'],'description':unit['description'],'order':topic['id'],'bank_version':2,'topics':[topic]}); topics[slug]=topic
    teaching={}
    for name in ('market_teaching_a.json','market_teaching_b.json','market_teaching_v2.json'):
        if (ROOT/'content'/name).exists(): teaching.update(load(name))
    files={name:(ROOT/f'content/datasets/koda-market/authored-v2/koda_market_{name}.csv').read_text(encoding='utf-8-sig') for name in ('orders','customers','products','managers')}
    frames={name:pd.read_csv(ROOT/f'content/datasets/koda-market/authored-v2/koda_market_{name}.csv') for name in files}
    arrays={name:{col:[None if pd.isna(v) else v for v in frame[col].tolist()] for col in frame} for name,frame in frames.items()}
    revision=load('market_revision.json')
    for t in topics.values(): t['exercises']=[e for e in t['exercises'] if e['id'] not in revision['retired_task_ids']]
    for eid in revision['retired_task_ids']:
        old=tasks.get(eid)
        if old: theory['articles'].pop(old['theory_article_id'],None)
        editorial['tasks'].pop(eid,None)
    new_slugs={'market-delivery-flag-001':'market-features','market-recent-orders-001':'market-sorting','market-missing-counts-001':'market-quality','market-repeat-products-001':'market-duplicates','market-product-enrichment-001':'market-joins','market-channel-code-001':'market-strings','market-discount-percent-001':'market-mapping','market-channel-charts-001':'market-charts','market-cases-006':'market-cases','market-category-profit-001':'market-cases',**{f'market-final-report-{i:03}':'market-final-report' for i in range(1,4)}}
    if 'market-final-report' not in topics:
        number=max(t['id'] for t in topics.values())+1
        slug='market-final-report'
        template=copy.deepcopy(topics['market-power-bi']); template.update(id=number,slug=slug,title='Итоговый отчёт аналитика',summary='Отчёт, проверка модели и записка руководителю',exercises=[])
        module=copy.deepcopy(next(m for m in catalog['modules'] if m['slug']=='market-power-bi')); module.update(id=number,slug=slug,title=template['title'],order=number,topics=[template])
        catalog['modules'].append(module); topics[slug]=template
        unit=copy.deepcopy(units['market-power-bi']); unit.update(id='ku-'+slug,slug=slug,title=template['title'],topicId=str(number),taskIds=[])
        units[slug]=unit
    for source in authored['tasks']:
        n,eid,mode=source['source_number'],source['task_id'],source['exercise_mode']
        old=tasks.get(eid)
        slug=next((slug for slug,t in topics.items() if old and any(e['id']==eid for e in t['exercises'])),None) or new_slugs[eid]
        task=old if old else copy.deepcopy(tasks['market-power-bi-001'] if n>=93 else tasks['market-groupby-001'])
        task.update(id=eid,topic_id=topics[slug]['id'],knowledge_unit_id='ku-'+slug,theory_article_id=old['theory_article_id'] if old else 'theory-'+eid,exercise_mode=mode,source_title='KODA Market — авторский курс',source_number=n,source_revision=authored['revision'],source_file=source['source_file'],source_sha256=source['source_sha256'],title=source['title'],situation=source['situation'],question=source['question'],instructions=source['question'],source_expected_result=source['source_expected_result'],source_validation=source['source_validation'],analysis=source['analysis'],reflection=source['reflection'],hints=[{'level':i,'text':hint} for i,hint in enumerate(source['hints'],1)],completion_summary=source['analysis'],explanation=source['analysis'],learning_objective=source['question'],required_tokens=[],required_calls=[],required_methods=[],result_variable='result',expected_type='auto')
        for key in ('response_spec','preview_dataset','validation_spec'): task.pop(key,None)
        if n<=92:
            solution=REFERENCES[n]
            needed=['orders']+[name for name in ('customers','products','managers') if name in solution or mode=='sql']
            task['dataset']={'files':{f'koda_market_{name}.csv':files[name] for name in needed},**{name:copy.deepcopy(arrays[name]) for name in needed}}
            task['setup_code']='import pandas as pd\n'+'\n'.join(f"{name} = pd.read_csv('koda_market_{name}.csv'"+(", parse_dates=['order_date'])" if name=='orders' else ')') for name in needed)
            task['starter_code']=task['setup_code']+'\n\nresult = None' if mode=='python' else 'SELECT\n'
            task['solution_code']=solution
            if n==13:
                task['dataset']={'files':{'koda_market_orders.csv':files['orders']},'variables':{'csv_path':'koda_market_orders.csv'}}
                task['preview_dataset']={'orders':copy.deepcopy(arrays['orders'])}
                task['setup_code']="import pandas as pd\ncsv_path = 'koda_market_orders.csv'"
                task['starter_code']=task['setup_code']+'\n\nresult = None'
            if n in (3,12): task['required_calls']=['agg']
            if n==13: task['required_calls']=['read_csv']
            if 33<=n<=37: task['required_calls']=['transform']
            task['required_tokens']=task['required_calls'][:]
            task['validation_spec']={'ignore_series_name':True,'numeric_tolerance':1e-8}
            if n==30: task['validation_spec']['categorical_columns']=['order_size']
            if n==71: task['validation_spec']['categorical_series']=True
            if n in (23,24,25): task['validation_spec']['tie_groups']=['revenue'] if n==23 else ['delivery_days'] if n==24 else ['city','revenue']
            if n==23: task['validation_spec']['row_selection']={'kind':'top_n','n':5,'sort_column':'revenue','identity_column':'order_id','source_table':'orders','descending':True}
            if n==26: task['validation_spec']['row_selection']={'kind':'minimum_per_group','group_by':'city','sort_column':'revenue','identity_column':'order_id','source_table':'orders'}
            if n in (43,44): task['validation_spec']['variants']=[{'name':'duplicate row','table':'orders','append_rows':[0]}]
            if n==60: task['validation_spec']['variants']=[{'name':'missing customer','table':'customers','remove_values':{'customer_id':['C001']}}]
            if n==66: task['validation_spec']['variants']=[{'name':'boundary whitespace','table':'orders','row_updates':[{'where':{'order_id':1001},'set':{'product':' Наушники '}}]}]
            if n in (7,8,26,52,61,67,80,83,84,85,86,87,90,91): task['validation_spec']['unordered_rows']=n not in (7,83,86)
            if n==82: task['validation_spec']['evidence_topics']=['Города','Каналы','Категории','Отмены','Доставка']
            task['answer_contract']='Сохраните ответ в result. '+source['source_expected_result']
        else:
            spec=native[str(n)]
            task.update(solution_code=json.dumps(spec['solution_spec'],ensure_ascii=False),response_spec=spec['response_spec'],answer_contract=spec['answer_contract'],documentation_urls=spec['documentation_urls'],validation_spec=spec.get('validation_spec',{}),dataset={'files':{f'koda_market_{name}.csv':files[name] for name in files},**copy.deepcopy(arrays)},setup_code='',starter_code=json.dumps(spec['response_spec']['initial'],ensure_ascii=False))
        result=run(task['solution_code'],task['dataset'],setup_code=task['setup_code'],exercise_mode=mode,validation_spec=task['validation_spec'])
        if not result.get('ok'): raise ValueError((n,eid,result))
        expected=without_images(result['result']); task['expected_result']=expected
        task['output_contract']={'kind':expected['kind'],'columns':expected.get('columns'),'index':expected.get('index'),'dtypes':expected.get('dtypes'),'precision':'Округление требуется только там, где оно явно указано в авторском условии или проверке.'}
        if n<=92:
            schema=''
            if expected['kind']=='dataframe': schema=' DataFrame; столбцы в порядке: '+', '.join(expected['columns'])+'.'
            elif expected['kind']=='series': schema=' Series с индексом '+('исходных строк.' if len(expected.get('data',[]))==30 else 'групп, указанных в условии.')
            elif expected['kind']=='plot': schema=' График с рассчитанными данными, заголовком и подписями осей.'
            task['answer_contract']+=schema
            if n in (28,29,30,31,32,33,36): task['answer_contract']+=' Верните копию всех исходных столбцов с добавленным столбцом '+expected['columns'][-1]+'.'
            if n in (34,72): task['answer_contract']+=' Проценты округлите до '+('двух' if n==34 else 'одного')+' десятичных знаков.'
            if n==30: task['answer_contract']+=' Метки: Небольшой, Средний, Крупный.'
            if n==71: task['answer_contract']+=' Метки: Бюджетный, Средний, Дорогой; результат Series по исходным строкам.'
            if task['validation_spec'].get('variants'): task['answer_contract']+=' Дополнительно код проверяется на отдельной копии данных с '+('повторяющейся строкой.' if n in (43,44) else 'отсутствующим клиентом в справочнике.' if n==60 else 'пробелами по краям названия товара.')
        if not old: topics[slug]['exercises'].append(task)
        tasks[eid]=task
        editorial['tasks'][eid]={k:task[k] for k in ('title','instructions','learning_objective','hints','completion_summary','explanation','setup_code','starter_code','solution_code')}
    for slug,unit in units.items():
        unit['taskIds']=[e['id'] for e in topics.get(slug,{}).get('exercises',[])]
        unit['relatedTaskIds']=unit['taskIds'][:]
        unit['theoryArticleIds']=[e['theory_article_id'] for e in topics.get(slug,{}).get('exercises',[])]
        if slug in teaching: unit.update(article=teaching[slug]['article'],cheatSheet=teaching[slug]['cheatSheet'])
        if slug.startswith('market-'):
            unit.update(sourceTitle='KODA Market — авторский курс',sourceVersion='market-authored-v2')
            unit['category']={'market-sql':'SQL','market-excel':'Excel','market-power-bi':'Power BI','market-final-report':'Power BI'}.get(slug,'pandas')
        if slug=='market-final-report' and slug not in teaching: raise ValueError('Authored final-report teaching required')
        for task in topics.get(slug,{}).get('exercises',[]):
            if task.get('source_revision')!=authored['revision']: continue
            entries=unit['cheatSheet']['entries']
            task['documentation_urls']=list(dict.fromkeys(e['documentationUrl'] for e in entries if e.get('documentationUrl')))
            task['concepts']=unit['concepts']; task['focus']=source_focus=task['title']
            theory['articles'][task['theory_article_id']]={'id':task['theory_article_id'],'title':unit['title'],'knowledge_unit_id':unit['id'],'introduction':unit['article']['lead'],'methods':[{'name':e['name'],'description':e['description'],'syntax':e['example'],'keyParameters':[],'parameterGuide':task['answer_contract'],'example':e['example'],'notes':[],'documentationUrl':e.get('documentationUrl'),'documentationLabel':e['name']} for e in entries]}
    for slug,topic in topics.items():
        if not topic['exercises']:
            topic['knowledge_only']=True
            topic['summary']='Статья и шпаргалка для самостоятельного чтения; практика этой темы сохранена в архиве.'
            units[slug]['knowledge_only']=True
            units[slug]['description']=topic['summary']
            for module in catalog['modules']:
                if module['slug']==slug: module['description']=topic['summary']
    write(ROOT/'content/catalog.json',catalog); write(ROOT/'content/theory_bank.json',theory); write(ROOT/'content/task_editorial.json',editorial); write(ROOT/'content/knowledge_units.json',{'version':1,'units':list(units.values())})
    lessons=[]
    for row in authored['tasks']:
        if not lessons or lessons[-1]['title']!=row['source_section']:
            lessons.append({'id':'market-'+str(len(lessons)+1),'title':row['source_section'],'exercise_mode':row['exercise_mode'],'source_start':row['source_number'],'source_end':row['source_number'],'taskIds':[]})
        lessons[-1]['source_end']=row['source_number']; lessons[-1]['taskIds'].append(row['task_id'])
    write(ROOT/'apps/web/public/market-course.json',{'id':'koda-market','title':'KODA Market — авторский курс аналитика','revision':authored['revision'],'lessons':lessons})
    report=json.loads((ROOT/'reports/market-authored-v2-map.json').read_text(encoding='utf-8'))
    for row in report['mapping']:
        task=tasks[row['task_id']]
        row.update(learning_objective=task['learning_objective'],answer_contract=task['answer_contract'],output_schema=task['output_contract'],prepared_tables=[name for name in task['dataset'] if name not in ('files','variables')],required_calls=task['required_calls'])
        if task['exercise_mode']=='python':
            tree=ast.parse(task['solution_code'])
            for node in ast.walk(tree):
                if isinstance(node,ast.Name) and node.id not in ('pd','np','plt'): node.id='VARIABLE'
            row['normalized_solution_structure']=ast.dump(tree,include_attributes=False)
        else: row['solution_structure']=task['solution_code']
    report['archived_knowledge_units']=['ku-'+slug for slug,t in topics.items() if t.get('knowledge_only')]
    write(ROOT/'reports/market-authored-v2-map.json',report)
    contract=['# Authored v2 native exercise contracts','','Requests retain `{exercise_id, code}`. SQL accepts native read-only queries. Excel and Power BI use structured controls with bounded formulas, model rules, report settings and replayable interactions. JSON is internal transport. All modes run inside the isolated task worker; free practice stays in browser Pyodide.','','Task-specific variants run on separate modified copies and never change canonical CSVs. The visible answer contract explains those additional checks. These educational simulators do not create `.xlsx` or `.pbix` files or claim full desktop compatibility.','']
    for row in authored['tasks'][92:]:
        contract.extend(['## '+str(row['source_number'])+'. '+row['task_id'],row['title'],native[str(row['source_number'])]['answer_contract'],'```json',json.dumps(native[str(row['source_number'])],ensure_ascii=False,indent=2),'```',''])
    (ROOT/'docs/new-modes-contract.md').write_text('\n'.join(contract),encoding='utf-8')
    print(f'Imported 115 authored steps in {len(lessons)} lessons; preserved all foundation IDs.')

if __name__=='__main__': integrate()
