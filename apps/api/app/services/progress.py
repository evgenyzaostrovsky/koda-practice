from datetime import datetime, timedelta, timezone
from ..db import connect, now
from ..content import MODULES, EXERCISES
from ..auth_backend import record_attempt, rest
from ..content_revision import cloud_task_id, public_cloud_task_id


def persist_attempt(account, exercise_id, code, passed, actual, feedback):
    if account:
        return record_attempt(account, exercise_id, code, passed, actual.get('result', {}).get('kind', actual.get('error_type', 'error')), feedback, actual.get('execution_ms', 0))
    with connect() as c:
        num=c.execute('SELECT COUNT(*) FROM attempts WHERE exercise_id=?',(exercise_id,)).fetchone()[0]+1
        hints=c.execute('SELECT COUNT(*) FROM hints WHERE exercise_id=?',(exercise_id,)).fetchone()[0]
        c.execute('INSERT INTO attempts(exercise_id,code,status,tests_passed,tests_total,error_type,execution_ms,attempt_number,hints_used,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',(exercise_id,code,'passed' if passed else 'failed',int(passed),1,None if passed else actual.get('error_type'),actual.get('execution_ms'),num,hints,now()))
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
        attempts=rest(account,'solution_attempts','GET',params={'user_id':f"eq.{account['id']}",'select':'task_id,passed,created_at','order':'created_at.asc'}) or []
        # Old affected keys remain retained remotely, but are not active evidence.
        cloud = [{**row, 'task_id': task_id} for row in cloud
                 if (task_id := public_cloud_task_id(row['task_id'])) in EXERCISES]
        attempts = [{**row, 'task_id': task_id} for row in attempts
                    if (task_id := public_cloud_task_id(row['task_id'])) in EXERCISES]
        solved={x['task_id'] for x in cloud if x['status']=='completed'}; module_progress=[]
        for m in MODULES:
            ids=[e['id'] for t in m['topics'] for e in t['exercises']];done=len(set(ids)&solved);mastery=round(done/len(ids)*100) if ids else 0
            module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'solved_ids':[i for i in ids if i in solved],'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
        return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':0,'independent_rate':0,'hints_used':sum(x.get('hints_opened',0) for x in cloud),'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':0,'modules':module_progress,'activity':[],'recent_errors':[]}
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
    return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':round(first_acc*100),'independent_rate':round(independent*100),'hints_used':hints,'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':due_n,'modules':module_progress,'activity':activity,'recent_errors':[x for x in reversed(attempts) if x['status']=='failed'][:20]}
