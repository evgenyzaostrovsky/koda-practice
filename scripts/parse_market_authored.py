"""Parse the complete Founder-authored v2 bank without rewriting learner copy."""
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'.codex/task-snapshots/market-final-v2/sources'
TARGET=ROOT/'content/datasets/koda-market/authored-v2'
REVISION='market-authored-v2'

IDS=[
 'groupby-001','market-groupby-001','market-groupby-002','groupby-005','market-groupby-003','market-groupby-004','market-groupby-005','market-groupby-006','market-groupby-007','market-groupby-008','market-groupby-report-001','market-groupby-report-002',
 'reading-009','attributes-001','inspection-001','inspection-009','market-overview-002',
 'columns-010','filtering-001','filtering-008','filtering-005','filtering-004',
 'market-sorting-001','sorting-002','sorting-005','market-sorting-002','market-recent-orders-001',
 'market-features-001','change-columns-008','market-features-002','change-columns-006','market-delivery-flag-001',
 'market-transform-001','market-transform-002','market-transform-003','market-transform-004','market-transform-005',
 'market-missing-counts-001','market-quality-002','recipes-003','market-quality-003','market-quality-004',
 'market-duplicates-001','market-duplicates-002','market-repeat-products-001','market-duplicates-003','market-duplicates-005',
 'pivot-006','market-reshape-002','market-reshape-001','market-reshape-004','market-reshape-003',
 'market-time-001','market-time-002','market-time-003','market-time-004','market-time-005',
 'merge-009','market-product-enrichment-001','market-joins-002','market-joins-003','market-joins-004',
 'market-strings-001','market-strings-002','market-channel-code-001','market-strings-004','market-strings-005',
 'market-mapping-001','market-mapping-002','market-mapping-003','market-mapping-004','market-discount-percent-001',
 'market-charts-001','pandas-plots-003','market-channel-charts-001','pandas-plots-006','market-charts-003',
 'market-cases-006','market-cases-002','market-cases-003','market-category-profit-001','market-cases-005',
 *[f'market-sql-{n:03}' for n in range(1,11)],
 *[f'market-excel-{n:03}' for n in range(1,11)],
 *[f'market-power-bi-{n:03}' for n in range(1,11)],
 'market-final-report-001','market-final-report-002','market-final-report-003',
]
assert len(IDS)==115 and len(set(IDS))==115

def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def parse():
    TARGET.mkdir(parents=True,exist_ok=True)
    source_dir=SOURCE if SOURCE.exists() else TARGET
    names=['KODA_Practice_Codex_master_prompt.md','KODA_Market_groupby_lesson.md',*[f'KODA_Market_completed_tasks_{n:02}.md' for n in range(1,8)],'UPLOAD_TO_CODEX_README.md',*[f'koda_market_{name}.csv' for name in ('orders','customers','products','managers')]]
    source_hashes={}
    rows=[]
    for name in names:
        raw=(source_dir/name).read_bytes()
        (TARGET/name).write_bytes(raw)
        source_hashes[name]=hashlib.sha256(raw).hexdigest()
        if not (name.startswith('KODA_Market_completed_tasks') or name=='KODA_Market_groupby_lesson.md'):continue
        text=raw.decode('utf-8-sig')
        headings=list(re.finditer(r'^### (\d+)\. (.+)$',text,re.MULTILINE))
        for position,heading in enumerate(headings):
            number=int(heading.group(1))
            block=text[heading.end():headings[position+1].start() if position+1<len(headings) else len(text)]
            block=re.split(r'^## ',block,maxsplit=1,flags=re.MULTILINE)[0].strip()
            marks=list(re.finditer(r'\*\*(Ситуация\.|Задание\.|Ожидаемый результат\.|Подсказки[:.]|Проверка\.|Разбор\.|После решения\.)\*\*',block))
            fields={mark.group(1).rstrip('.:'):block[mark.end():marks[i+1].start() if i+1<len(marks) else len(block)].strip() for i,mark in enumerate(marks)}
            if number<=12:fields['Ситуация']=block[:marks[0].start()].strip()
            hints=fields['Подсказки']
            if re.search(r'^1\. ',hints,re.MULTILINE):
                parsed_hints=[part.strip() for part in re.split(r'^\d\. ',hints,flags=re.MULTILINE)[1:]]
            else:parsed_hints=[part.strip() for part in re.split(r'\b[123]\) ',hints)[1:]]
            if len(parsed_hints)!=3:raise ValueError((number,parsed_hints))
            prior_sections=re.findall(r'^## (.+)$',text[:heading.start()],re.MULTILINE)
            section='GroupBy и агрегации' if number<=12 else prior_sections[-1]
            rows.append({'source_number':number,'task_id':IDS[number-1],'title':heading.group(2).strip(),'situation':fields['Ситуация'],'question':fields['Задание'],
              'source_expected_result':fields.get('Ожидаемый результат',''),'hints':parsed_hints,'source_validation':fields['Проверка'],'analysis':fields['Разбор'],
              'reflection':fields.get('После решения',''),'source_section':section,'exercise_mode':'python' if number<=82 else 'sql' if number<=92 else 'excel' if number<=102 else 'power-bi',
              'source_file':name,'source_sha256':source_hashes[name],'source_revision':REVISION,'source_block':block})
    rows.sort(key=lambda row:row['source_number'])
    assert [row['source_number'] for row in rows]==list(range(1,116))
    assert all(row['situation'] and row['question'] and row['analysis'] and row['source_validation'] for row in rows)
    payload={'revision':REVISION,'source_hashes':source_hashes,'tasks':rows}
    write(ROOT/'content/market_authored_v2.json',payload)
    catalog=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
    old={task['id']:task for module in catalog['modules'] for topic in module['topics'] for task in topic['exercises']}
    previous_market={task['id'] for task in old.values() if task.get('source_title') or task['id'].startswith('market-')}
    if (ROOT/'content/market_revision.json').exists():
        previous=json.loads((ROOT/'content/market_revision.json').read_text(encoding='utf-8'))
        if previous.get('revision')==REVISION: previous_market.update(previous['affected_task_ids'])
    mapping=[{key:row[key] for key in ('source_number','task_id','source_file','source_sha256','source_section','exercise_mode','source_revision')} | {'disposition':'extend' if row['task_id'] in old else 'add','prior_title':old.get(row['task_id'],{}).get('title')} for row in rows]
    report_path=ROOT/'reports/market-authored-v2-map.json'
    if report_path.exists():
        prior={r['source_number']:r for r in json.loads(report_path.read_text(encoding='utf-8')).get('mapping',[])}
        for record in mapping:
            previous_record=prior.get(record['source_number'],{})
            if previous_record.get('task_id')==record['task_id']:
                for key in ('disposition','prior_title'): record[key]=previous_record[key]
    retired=sorted(task_id for task_id in previous_market-set(IDS) if task_id.startswith('market-'))
    migration={'revision':REVISION,'affected_task_ids':sorted(previous_market|set(IDS)),'notice':'Курс KODA Market обновлён по авторскому банку. Старый прогресс этого курса сохранён в архиве; новые задачи можно пройти заново. Ранее полученные награды остаются в истории.','retired_task_ids':retired,'source_mapping':mapping,'retirement_migration':{task_id:None for task_id in retired}}
    migration['restored_task_ids']=sorted(previous_market-set(IDS)-set(retired))
    migration['restored_reason']='Existing foundation identities previously linked to Market remain in the foundation bank; their prior Market progress is archived with the course revision.'
    migration['active_task_ids']=sorted(old)
    write(ROOT/'content/market_revision.json',migration)
    write(ROOT/'apps/web/public/market_revision.json',migration)
    write(ROOT/'apps/web/src/content-revision-manifest.json',{key:migration[key] for key in ('revision','affected_task_ids','retired_task_ids','active_task_ids')})
    write(ROOT/'reports/market-authored-v2-map.json',{'revision':REVISION,'count':115,'mapping':mapping,'retired_task_ids':retired,'restored_task_ids':migration['restored_task_ids'],'restored_reason':migration['restored_reason'],'retirement_migration':migration['retirement_migration'],'preserved_title_collision':{'task_ids':['filtering-006','filtering-008'],'evidence':'Both IDs belong to the original 200 foundation tasks. Existing006 uses query with Moscow/Kazan; existing008 uses isin with Moscow/Tula and already contains canonical Market orders. Source20 maps to closest existing008 without adding an identity. Exact authored title Два города retained; title collision does not add a renamed-variable task.'}})
    print(f'Parsed {len(rows)} exact authored steps; {len(retired)} obsolete Market IDs explicitly retired; {len(migration["affected_task_ids"])} scoped reset IDs.')
    return payload

if __name__=='__main__':parse()
