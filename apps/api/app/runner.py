import ast, atexit, json, os, queue, subprocess, sys, tempfile, threading, time
from pathlib import Path

BLOCKED={'os','sys','subprocess','socket','pathlib','shutil','requests','urllib','http','ctypes','multiprocessing'}
def validate(code):
    try: tree=ast.parse(code)
    except SyntaxError as e: return f'Синтаксическая ошибка в строке {e.lineno}: {e.msg}'
    for n in ast.walk(tree):
        if isinstance(n,(ast.Import,ast.ImportFrom)):
            names=[a.name.split('.')[0] for a in n.names] if isinstance(n,ast.Import) else [(n.module or '').split('.')[0]]
            if any(x in BLOCKED for x in names): return 'Импорт этой библиотеки запрещён в учебном runner.'
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in {'open','exec','eval','compile','__import__','input'}: return f'Вызов {n.func.id} запрещён.'
    return None

HARNESS=r'''
import json, sys, traceback, io, contextlib, copy
import pandas as pd, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
payload=json.load(open(sys.argv[1],encoding="utf-8")); ns={"pd":pd,"np":np,"plt":plt,"sns":sns}; input_names=[]
for name,val in payload.get("dataset",{}).items():
 if name=="files":
  for fn,data in val.items(): open(fn,"w",encoding="utf-8").write(data)
 elif name=="variables": ns.update(val); input_names.extend(val)
 elif name=="series":
  for key,spec in val.items():
   ns[key]=pd.Series(spec.get("data",[]),index=spec.get("index"),name=spec.get("name"),dtype=spec.get("dtype")); input_names.append(key)
 else: ns[name]=pd.DataFrame(val) if isinstance(val,dict) else val; input_names.append(name)
originals={key:copy.deepcopy(ns[key]) for key in input_names}
buf=io.StringIO()
try:
 with contextlib.redirect_stdout(buf): exec(payload["code"],{"__builtins__":{"print":print,"len":len,"range":range,"sum":sum,"min":min,"max":max,"abs":abs,"round":round,"list":list,"dict":dict,"tuple":tuple,"set":set,"str":str,"int":int,"float":float,"bool":bool,"enumerate":enumerate,"zip":zip}},ns)
 r=ns.get(payload.get("result_variable","result"),None)
 plot=bool(plt.get_fignums())
 if isinstance(r,pd.DataFrame): value={"kind":"dataframe","columns":[str(x) for x in r.columns],"index":[str(x) for x in r.index],"data":json.loads(r.to_json(orient="values",date_format="iso")),"dtypes":[str(x) for x in r.dtypes]}
 elif isinstance(r,pd.Series): value={"kind":"series","name":str(r.name) if r.name is not None else None,"index":[str(x) for x in r.index],"data":json.loads(r.to_json(orient="values",date_format="iso")),"dtype":str(r.dtype)}
 elif hasattr(r,"__class__") and ("Axes" in r.__class__.__name__ or plot):
  ax=r if hasattr(r,"get_title") else plt.gca()
  value={"kind":"plot","created":True,"title":ax.get_title(),"xlabel":ax.get_xlabel(),"ylabel":ax.get_ylabel(),"lines":[{"x":list(line.get_xdata()),"y":list(line.get_ydata()),"marker":line.get_marker(),"linestyle":line.get_linestyle(),"color":str(line.get_color()),"linewidth":line.get_linewidth(),"alpha":line.get_alpha(),"label":line.get_label()} for line in ax.lines],"patches":len(ax.patches)}
 elif isinstance(r,tuple): value={"kind":"scalar","data":list(r)}
 else: value={"kind":"scalar","data":r}
 def changed(a,b):
  if isinstance(a,(pd.DataFrame,pd.Series)): return not a.equals(b)
  try: return a!=b
  except Exception: return False
 mutated=[k for k,v in originals.items() if changed(ns.get(k),v)]
 print(json.dumps({"ok":True,"stdout":buf.getvalue(),"result":value,"mutated_inputs":mutated},ensure_ascii=True,default=str))
except Exception as e:
 print(json.dumps({"ok":False,"stdout":buf.getvalue(),"error_type":type(e).__name__,"error":str(e),"traceback":traceback.format_exc(limit=2)},ensure_ascii=True))
'''
def run(code,dataset,result_variable='result',timeout_ms=10000):
    err=validate(code)
    if err:return {'ok':False,'error_type':'SecurityError','error':err,'execution_ms':0}
    started=time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='koda_') as d:
        p=Path(d); (p/'run.py').write_text(HARNESS,encoding='utf-8'); (p/'input.json').write_text(json.dumps({'code':code,'dataset':dataset,'result_variable':result_variable},ensure_ascii=False),encoding='utf-8')
        try:
            env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'}
            cp=subprocess.run([sys.executable,'-I',str(p/'run.py'),str(p/'input.json')],cwd=p,capture_output=True,env=env,timeout=timeout_ms/1000)
            stdout=cp.stdout.decode('utf-8',errors='replace'); stderr=cp.stderr.decode('utf-8',errors='replace')
            lines=stdout.strip().splitlines(); data=json.loads(lines[-1]) if lines else {'ok':False,'error_type':'RunnerError','error':stderr or 'Нет результата'}
        except subprocess.TimeoutExpired: data={'ok':False,'error_type':'TimeoutError','error':f'Код выполнялся дольше {timeout_ms/1000:g} секунд.'}
        except Exception as e: data={'ok':False,'error_type':'RunnerError','error':str(e)}
    data['execution_ms']=round((time.perf_counter()-started)*1000); return data

class PersistentWorker:
    def __init__(self):
        self.process=None; self.lock=threading.Lock(); self.import_ms=0
    def start(self):
        if self.process and self.process.poll() is None:return
        script=Path(__file__).with_name('worker_process.py')
        self.process=subprocess.Popen([sys.executable,'-I',str(script)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,
          stderr=subprocess.DEVNULL,text=True,encoding='utf-8',errors='replace',bufsize=1,
          env={**os.environ,'PYTHONUNBUFFERED':'1','PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1','MPLCONFIGDIR':'/tmp/matplotlib'})
        ready=self._readline(30)
        if not ready or not ready.get('ready'):raise RuntimeError('Runner worker failed to start')
        self.import_ms=ready.get('import_ms',0)
    def _readline(self,timeout):
        output=queue.Queue(maxsize=1)
        threading.Thread(target=lambda:output.put(self.process.stdout.readline()),daemon=True).start()
        try:line=output.get(timeout=timeout)
        except queue.Empty:return None
        try:return json.loads(line)
        except Exception:return None
    def execute(self,payload,timeout_ms):
        with self.lock:
            started=time.perf_counter()
            try:
                self.start(); worker_start=round((time.perf_counter()-started)*1000)
                self.process.stdin.write(json.dumps(payload,ensure_ascii=True)+'\n');self.process.stdin.flush()
                data=self._readline(timeout_ms/1000)
                if data is None:
                    self.stop();return {'ok':False,'error_type':'TimeoutError','error':f'Код выполнялся дольше {timeout_ms/1000:g} секунд.'}
                data.setdefault('timings',{}).update(worker_start=worker_start,worker_import=self.import_ms)
                return data
            except Exception:
                self.stop();return {'ok':False,'error_type':'InternalError','error':'Не удалось выполнить код. Runner автоматически перезапущен.'}
    def stop(self):
        if self.process and self.process.poll() is None:self.process.kill()
        self.process=None

WORKER=PersistentWorker();atexit.register(WORKER.stop)
def warmup():
    started=time.perf_counter();WORKER.start();return {'ready':True,'import_ms':WORKER.import_ms,'warmup_ms':round((time.perf_counter()-started)*1000)}

def run(code,dataset,result_variable='result',timeout_ms=10000):
    started=time.perf_counter()
    if len(code)>50_000:return {'ok':False,'error_type':'SecurityError','error':'Код превышает допустимый размер.','execution_ms':0}
    try:ast.parse(code)
    except SyntaxError as exc:
        lines=code.splitlines();line=lines[exc.lineno-1] if exc.lineno and exc.lineno<=len(lines) else ''
        return {'ok':False,'error_type':'SyntaxError','error':exc.msg,'line':exc.lineno,'offset':exc.offset,'code_line':line,
          'execution_ms':round((time.perf_counter()-started)*1000),'timings':{'validation':0}}
    err=validate(code)
    if err:return {'ok':False,'error_type':'SecurityError','error':err,'execution_ms':round((time.perf_counter()-started)*1000)}
    needs_plot=any(token in code for token in ('plt.','sns.','.plot(','hist(','scatter('))
    data=WORKER.execute({'code':code,'dataset':dataset,'result_variable':result_variable,'needs_plot':needs_plot},timeout_ms)
    data['execution_ms']=round((time.perf_counter()-started)*1000)
    return data

def explain(result):
    typ=result.get('error_type','WrongAnswer'); msg=result.get('error','Результат отличается от ожидаемого.')
    advice={'SyntaxError':'Проверьте скобки, кавычки и двоеточия рядом с указанной строкой.','KeyError':'Такого столбца нет. Сверьте регистр и написание с таблицей данных.','NameError':'Имя не определено. Используйте переменные из условия и сохраните ответ в result.','TypeError':'Операция получила неподходящий тип данных. Проверьте dtypes и аргументы метода.','TimeoutError':'Вероятен бесконечный цикл или слишком тяжёлая операция. Упростите вычисление.','WrongAnswer':'Сравните форму, порядок столбцов, индекс и значения результата.'}.get(typ,'Проверьте синтаксис метода и входные данные.')
    return {'title':typ,'what':msg,'where':'Runner или скрытая проверка результата','difference':result.get('difference','Ожидаемый результат не получен.'),'check':advice,'nudge':'Начните с просмотра названий столбцов и типа объекта.'}

def compare_results(actual, expected):
    a,e=actual.get('result'),expected.get('result')
    if not a: return False,{'expected':'Корректная переменная result','actual':'Переменная result не создана','difference':'После выполнения кода result отсутствует.'}
    if a.get('kind')!=e.get('kind'):
        return False,{'expected':e.get('kind'),'actual':a.get('kind'),'difference':f"Ожидался тип {e.get('kind')}, получен {a.get('kind')}."}
    if a.get('kind')=='dataframe':
        er,ec=len(e.get('data',[])),len(e.get('columns',[])); ar,ac=len(a.get('data',[])),len(a.get('columns',[]))
        if (ar,ac)!=(er,ec): return False,{'expected':f'DataFrame {er} × {ec}','actual':f'DataFrame {ar} × {ac}','difference':f'Ожидался DataFrame размером {er} × {ec}, получен DataFrame размером {ar} × {ac}.'}
        if a.get('columns')!=e.get('columns'): return False,{'expected':', '.join(e['columns']),'actual':', '.join(a['columns']),'difference':f"Столбцы не совпадают. Ожидались: {', '.join(e['columns'])}. Получены: {', '.join(a['columns'])}."}
        if a.get('index')!=e.get('index'): return False,{'expected':str(e['index']),'actual':str(a['index']),'difference':'Индекс или порядок строк не совпадает.'}
        for i,(ra,re) in enumerate(zip(a['data'],e['data'])):
            for j,(va,ve) in enumerate(zip(ra,re)):
                if va!=ve: return False,{'expected':str(ve),'actual':str(va),'difference':f"Значение в строке {i}, столбце {e['columns'][j]}: ожидалось {ve}, получено {va}."}
    elif a.get('kind')=='series':
        if len(a.get('data',[]))!=len(e.get('data',[])): return False,{'expected':f"Series длиной {len(e.get('data',[]))}",'actual':f"Series длиной {len(a.get('data',[]))}",'difference':'Длина Series не совпадает.'}
        if a.get('index')!=e.get('index'): return False,{'expected':str(e['index']),'actual':str(a['index']),'difference':'Индекс Series не совпадает.'}
        for i,(va,ve) in enumerate(zip(a['data'],e['data'])):
            if va!=ve:return False,{'expected':str(ve),'actual':str(va),'difference':f'Значение Series в позиции {i}: ожидалось {ve}, получено {va}.'}
    elif a!=e: return False,{'expected':str(e.get('data')),'actual':str(a.get('data')),'difference':'Значение result не совпадает с ожидаемым.'}
    return True,{}

def explain(result):
    raw=result.get('error_type','WrongAnswer')
    kind={'SyntaxError':'syntax_error','TimeoutError':'timeout','MissingResult':'missing_result','WrongMethod':'wrong_method',
      'InternalError':'internal_error','RunnerError':'internal_error','WrongAnswer':'wrong_value'}.get(raw,'runtime_error' if not result.get('ok') else 'wrong_value')
    difference=result.get('difference') or ''
    if kind=='wrong_value':
        if 'размером' in difference or 'Длина' in difference:kind='wrong_shape'
        elif 'Столбц' in difference:kind='wrong_columns'
        elif 'Индекс' in difference or 'индекс' in difference:kind='wrong_index'
        elif 'тип' in difference:kind='wrong_type'
    titles={'syntax_error':'Синтаксическая ошибка','runtime_error':f'Ошибка Python: {raw}','timeout':'Превышено время выполнения',
      'missing_result':'Не создана переменная result','wrong_method':'Использован другой метод','wrong_value':'Результат отличается',
      'wrong_shape':'Неверный размер результата','wrong_columns':'Не совпадают столбцы','wrong_index':'Не совпадает индекс',
      'wrong_type':'Неверный тип результата','internal_error':'Runner временно недоступен'}
    line=result.get('line'); code_line=result.get('code_line')
    where=f'Строка {line}: {code_line}' if line else None
    what=result.get('error') or 'Полученный результат не совпадает с ожидаемым.'
    if kind=='missing_result': check='Сохраните итог вычисления в переменную result.'
    elif kind=='timeout': check='Проверьте бесконечный цикл или слишком тяжёлую операцию.'
    elif raw=='NameError': check=f"Проверьте имя переменной. Доступны: {', '.join(result.get('available_variables',[])[:12])}."
    elif raw=='FileNotFoundError': check=f"Проверьте имя CSV-файла. Доступны: {', '.join(result.get('available_files',[])[:12]) or 'файлы не предоставлены'}."
    elif kind=='syntax_error':
        pointer=' '*(max(1,result.get('offset') or 1)-1)+'^'
        check=f"{code_line or ''}\n{pointer}".strip()
    elif kind=='wrong_method': check='Исправьте способ вычисления, сохранив результат в result.'
    else: check=result.get('difference') or 'Сравните тип, форму, индекс и значения результата.'
    return {'kind':kind,'title':titles[kind],'what':what,'where':where,'python_error':raw if kind in ('syntax_error','runtime_error') else None,
      'line':line,'code_line':code_line,'difference':result.get('difference'),'check':check,
      'nudge':'Исправьте указанное место и запустите проверку снова.'}
