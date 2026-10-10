from datetime import datetime, timedelta, timezone
import json
from fastapi import HTTPException
from ..db import connect, now
from ..content import MODULES, EXERCISES
from ..auth_backend import record_attempt, rest
from ..content_revision import cloud_task_id, public_cloud_task_id


def _attempt_item(row, cloud=False, detail=False):
    feedback=row.get('feedback')
    if isinstance(feedback,str):
        try: feedback=json.loads(feedback)
        except (ValueError,TypeError): feedback=None
    if not isinstance(feedback,dict): feedback=None
    # Older cloud feedback was the explanation itself, without an envelope.
    if feedback and 'version' not in feedback:
        feedback={'version':0,'mode':EXERCISES[row['task_id'] if cloud else row['exercise_id']].get('exercise_mode','python'),
                  'error':feedback.get('what'),'error_type':feedback.get('python_error'),
                  'line':feedback.get('line'),'explanation':feedback}
    passed=bool(row.get('passed')) if cloud else row.get('status')=='passed'
    error_type=None if passed else (feedback or {}).get('error_type') or row.get('error_type')
    item={'id':str(row['id']),'task_id':row['task_id'] if cloud else row['exercise_id'],
          'passed':passed,'result_type':row.get('result_type') or ('passed' if passed else error_type or 'error'),
          'error_type':error_type,'created_at':row['created_at'],'execution_ms':row.get('execution_ms'),
          'feedback':feedback}
    if detail:item['code']=row.get('code','')
    return item


def attempt_history(account, offset=0, limit=30):
    if account:
        # Filter revisions before applying the public offset. Supabase's default
        # row cap must not silently truncate history or let archives consume pages.
        active=[]; storage_offset=0; needed=offset+limit+1
        while len(active)<needed:
            rows=rest(account,'solution_attempts',params={
                'user_id':f"eq.{account['id']}",'select':'id,task_id,passed,result_type,feedback,execution_ms,created_at',
                'order':'created_at.desc,id.desc','offset':storage_offset,'limit':200}) or []
            for row in rows:
                task_id=public_cloud_task_id(row['task_id'])
                if task_id in EXERCISES:active.append({**row,'task_id':task_id})
            storage_offset+=len(rows)
            if len(rows)<200:break
        selected=active[offset:needed]
    else:
        ids=list(EXERCISES)
        if not ids:return {'items':[],'has_more':False,'next_offset':None}
        with connect() as c:
            selected=[dict(row) for row in c.execute(
                f"SELECT id,exercise_id,status,error_type,execution_ms,created_at,feedback FROM attempts WHERE exercise_id IN ({','.join('?' for _ in ids)}) ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",(*ids,limit+1,offset))]
    more=len(selected)>limit
    return {'items':[_attempt_item(row,bool(account)) for row in selected[:limit]],
            'has_more':more,'next_offset':offset+limit if more else None}


def attempt_detail(account, attempt_id):
    if account:
        # Validate before including an untrusted identifier in a PostgREST filter.
        from uuid import UUID
        try:UUID(attempt_id)
        except (ValueError,TypeError):raise HTTPException(404,'Попытка не найдена')
        rows=rest(account,'solution_attempts',params={'user_id':f"eq.{account['id']}",
            'id':f'eq.{attempt_id}','select':'id,task_id,passed,result_type,feedback,execution_ms,created_at,code','limit':1}) or []
        row=rows[0] if rows else None
        if row:
            task_id=public_cloud_task_id(row['task_id'])
            row={**row,'task_id':task_id} if task_id in EXERCISES else None
    else:
        if not attempt_id.isdecimal():raise HTTPException(404,'Попытка не найдена')
        with connect() as c:
            found=c.execute('SELECT * FROM attempts WHERE id=?',(attempt_id,)).fetchone()
        row=dict(found) if found and found['exercise_id'] in EXERCISES else None
    if row is None:raise HTTPException(404,'Попытка не найдена')
    return _attempt_item(row,bool(account),True)


def persist_attempt(account, exercise_id, code, passed, actual, feedback, final_run_result=None):
    if account:
        args=(account,exercise_id,code,passed,actual.get('result', {}).get('kind', actual.get('error_type', 'error')),feedback,actual.get('execution_ms',0))
        return record_attempt(*args,final_run_result=final_run_result) if final_run_result is not None else record_attempt(*args)
    with connect() as c:
        num=c.execute('SELECT COUNT(*) FROM attempts WHERE exercise_id=?',(exercise_id,)).fetchone()[0]+1
        hints=c.execute('SELECT COUNT(*) FROM hints WHERE exercise_id=?',(exercise_id,)).fetchone()[0]
        c.execute('INSERT INTO attempts(exercise_id,code,status,tests_passed,tests_total,error_type,execution_ms,attempt_number,hints_used,created_at,feedback) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(exercise_id,code,'passed' if passed else 'failed',int(passed),1,None if passed else actual.get('error_type'),actual.get('execution_ms'),num,hints,now(),json.dumps(feedback,ensure_ascii=False) if feedback is not None else None))
        day=datetime.now().date().isoformat(); c.execute('INSERT INTO activity(day,attempts,solved) VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1, solved=solved+excluded.solved',(day,1,int(passed)))
        if passed:
            delay=2 if hints else (7 if num==1 else 4); due=(datetime.now(timezone.utc)+timedelta(days=delay)).isoformat()
            c.execute('INSERT INTO reviews(exercise_id,interval_days,due_at) VALUES(?,?,?) ON CONFLICT(exercise_id) DO UPDATE SET interval_days=excluded.interval_days,due_at=excluded.due_at',(exercise_id,delay,due))
    return num, hints

def hints_opened(account, exercise_id):
    if account:
        exercise_id = cloud_task_id(exercise_id)
        rows = rest(account, 'task_progress', params={'user_id': f"eq.{account['id']}", 'task_id': f'eq.{exercise_id}', 'select': 'hints_opened'}) or []
        return rows[0].get('hints_opened', 0) if rows else 0
    with connect() as c:
        return c.execute('SELECT COUNT(*) FROM hints WHERE exercise_id=?', (exercise_id,)).fetchone()[0]


def open_hint(account, exercise_id, level):
    if not account:
        with connect() as c:
            c.execute('INSERT OR IGNORE INTO hints VALUES(?,?,?)', (exercise_id, level, now()))
        return
    opened = hints_opened(account, exercise_id)
    exercise_id = cloud_task_id(exercise_id)
    # Create only when absent; never replace another writer's progress.
    rest(account, 'task_progress?on_conflict=user_id,task_id', 'POST',
         {'user_id': account['id'], 'task_id': exercise_id},
         prefer='resolution=ignore-duplicates,missing=default,return=minimal')
    rest(account, 'task_progress', 'PATCH', {'hints_opened': max(opened, level)},
         params={'user_id': f"eq.{account['id']}", 'task_id': f'eq.{exercise_id}', 'hints_opened': f'lt.{level}'}, prefer='return=minimal')


def get_progress(account):
    if account:
        cloud=rest(account,'task_progress','GET',params={'user_id':f"eq.{account['id']}",'select':'*'}) or []
        attempts=[]; storage_offset=0
        while True:
            page=rest(account,'solution_attempts','GET',params={'user_id':f"eq.{account['id']}",
                'select':'id,task_id,passed,result_type,feedback,execution_ms,created_at',
                'order':'created_at.asc,id.asc','offset':storage_offset,'limit':200}) or []
            attempts.extend(page);storage_offset+=len(page)
            if len(page)<200:break
        # Old affected keys remain retained remotely, but are not active evidence.
        cloud = [{**row, 'task_id': task_id} for row in cloud
                 if (task_id := public_cloud_task_id(row['task_id'])) in EXERCISES]
        attempts = [{**row, 'task_id': task_id} for row in attempts
                    if (task_id := public_cloud_task_id(row['task_id'])) in EXERCISES]
        solved={x['task_id'] for x in cloud if x['status']=='completed'}; module_progress=[]
        first={};activity={};known_hints=[]
        for attempt in attempts:
            first.setdefault(attempt['task_id'],attempt)
            feedback=attempt.get('feedback')
            if isinstance(feedback,dict) and isinstance(feedback.get('hints_used'),int):
                known_hints.append(bool(attempt['passed']) and feedback['hints_used']==0)
            try:day=datetime.fromisoformat(attempt['created_at'].replace('Z','+00:00')).astimezone().date().isoformat()
            except (ValueError,TypeError):continue
            bucket=activity.setdefault(day,{'day':day,'attempts':0,'solved':0})
            bucket['attempts']+=1;bucket['solved']+=int(bool(attempt['passed']))
        first_accuracy=round(sum(bool(x['passed']) for x in first.values())/len(first)*100) if first else 0
        independent=round(sum(known_hints)/len(attempts)*100) if attempts and len(known_hints)==len(attempts) else None
        for m in MODULES:
            ids=[e['id'] for t in m['topics'] for e in t['exercises']];done=len(set(ids)&solved);mastery=round(done/len(ids)*100) if ids else 0
            module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'solved_ids':[i for i in ids if i in solved],'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
        return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),
                'first_try_accuracy':first_accuracy,'independent_rate':independent,
                'hints_used':sum(x.get('hints_opened',0) for x in cloud),'xp':sum(EXERCISES[i]['xp'] for i in solved),
                'due':0,'modules':module_progress,'activity':[activity[key] for key in sorted(activity,reverse=True)[:28]],
                'recent_errors':[{**_attempt_item(x,True),'exercise_id':x['task_id'],'status':'failed'}
                                 for x in reversed(attempts) if not x['passed']][:20]}
    with connect() as c:
        rows=c.execute('SELECT * FROM attempts ORDER BY id').fetchall()
        hints=sum(row['exercise_id'] in EXERCISES for row in c.execute('SELECT exercise_id FROM hints'))
        activity=[dict(x) for x in c.execute('SELECT * FROM activity ORDER BY day DESC LIMIT 28')]
        due_n=sum(row['exercise_id'] in EXERCISES for row in c.execute('SELECT exercise_id FROM reviews WHERE completed_at IS NULL AND due_at<=?',(now(),)))
    attempts=[dict(x) for x in rows if x['exercise_id'] in EXERCISES]; solved={x['exercise_id'] for x in attempts if x['status']=='passed'}; first={}
    for x in attempts:first.setdefault(x['exercise_id'],x)
    first_acc=sum(x['status']=='passed' for x in first.values())/len(first) if first else 0; independent=sum(x['status']=='passed' and not x['hints_used'] for x in attempts)/len(attempts) if attempts else 0
    module_progress=[]
    for m in MODULES:
        ids=[e['id'] for t in m['topics'] for e in t['exercises']]; done=len(set(ids)&solved); mastery=round(100*(.5*(sum(first.get(i,{}).get('status')=='passed' for i in ids)/len(ids))+.3*(sum(any(a['exercise_id']==i and a['status']=='passed' and not a['hints_used'] for a in attempts) for i in ids)/len(ids))+.2*(done/len(ids)))) if ids else 0
        module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'solved_ids':[i for i in ids if i in solved],'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
    return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':round(first_acc*100),'independent_rate':round(independent*100),'hints_used':hints,'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':due_n,'modules':module_progress,'activity':activity,'recent_errors':[{**_attempt_item(x),'exercise_id':x['exercise_id'],'status':'failed'} for x in reversed(attempts) if x['status']=='failed'][:20]}
