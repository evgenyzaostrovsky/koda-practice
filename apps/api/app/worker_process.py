"""Persistent isolated execution worker. Protocol: one JSON object per line."""
import base64, contextlib, copy, io, json, os, sys, tempfile, time, traceback

started=time.perf_counter()
import numpy as np
import pandas as pd
import importlib.util
from pathlib import Path
_mode_spec = importlib.util.spec_from_file_location('koda_exercise_modes', Path(__file__).with_name('exercise_modes.py'))
_mode_module = importlib.util.module_from_spec(_mode_spec)
_mode_spec.loader.exec_module(_mode_module)
execute_mode = _mode_module.execute_mode
IMPORT_MS=round((time.perf_counter()-started)*1000)

def safe_import(name,globals=None,locals=None,fromlist=(),level=0):
    if name.split('.')[0] not in {'pandas','numpy','matplotlib','seaborn'}:
        raise ImportError(f'Импорт {name} запрещён в учебном runner.')
    return __import__(name,globals,locals,fromlist,level)

SAFE_BUILTINS={"print":print,"len":len,"range":range,"sum":sum,"min":min,"max":max,"abs":abs,"round":round,
 "list":list,"dict":dict,"tuple":tuple,"set":set,"str":str,"int":int,"float":float,"bool":bool,"enumerate":enumerate,"zip":zip,"__import__":safe_import}

def clean(value):
    if isinstance(value,np.ndarray):return [clean(x) for x in value.tolist()]
    if isinstance(value,np.generic):value=value.item()
    if isinstance(value,float) and (np.isnan(value) or np.isinf(value)):return None
    if isinstance(value,(list,tuple)):return [clean(x) for x in value]
    if isinstance(value,dict):return {str(k):clean(v) for k,v in value.items()}
    return value

def serialize(value,plot=False,plt=None):
    if isinstance(value,dict) and 'chart' in value and plt is not None:
        chart = serialize(value['chart'],True,plt)
        chart['insight'] = {key:clean(item) for key,item in value.items() if key!='chart'}
        return chart
    if isinstance(value,pd.DataFrame):
        return {"kind":"dataframe","columns":[str(x) for x in value.columns],"index":[str(x) for x in value.index],
          "data":json.loads(value.to_json(orient="values",date_format="iso")),"dtypes":[str(x) for x in value.dtypes],"shape":list(value.shape)}
    if isinstance(value,pd.Series):
        return {"kind":"series","name":str(value.name) if value.name is not None else None,"index":[str(x) for x in value.index],
          "data":json.loads(value.to_json(orient="values",date_format="iso")),"dtype":str(value.dtype),"shape":[len(value)]}
    if plot and plt is not None:
        ax=value if hasattr(value,"get_title") else plt.gca()
        png = io.BytesIO()
        width,height = ax.figure.get_size_inches()
        dpi = min(85,1200/max(width,1),800/max(height,1))
        ax.figure.savefig(png,format='png',dpi=dpi)
        image = base64.b64encode(png.getvalue()).decode('ascii') if png.tell() <= 2_000_000 else None
        return {"kind":"plot","created":True,"image":'data:image/png;base64,'+image if image else None,"title":ax.get_title(),"xlabel":ax.get_xlabel(),"ylabel":ax.get_ylabel(),
          "lines":[{"x":clean(line.get_xdata()),"y":clean(line.get_ydata())} for line in ax.lines],"patches":len(ax.patches),
          "bar_values":[{"x":clean(patch.get_x()),"y":clean(patch.get_y()),"width":clean(patch.get_width()),"height":clean(patch.get_height())} for patch in ax.patches if all(hasattr(patch,method) for method in ('get_x','get_y','get_width','get_height'))]}
    return {"kind":"scalar","data":clean(value)}

def execute(code,dataset,result_variable,needs_plot=False,setup_code="",exercise_mode="python",validation_spec=None):
    t0=time.perf_counter(); plt=None; sns=None
    existing_plot = sys.modules.get('matplotlib.pyplot')
    if existing_plot is not None: existing_plot.close('all')
    if exercise_mode != 'python':
        try:
            value = execute_mode(code, dataset, exercise_mode)
            response = {'ok':True,'stdout':'','result':serialize(value),'mutated_inputs':[]}
            contract = validation_spec or {}
            if contract.get('interactive'):
                spec = json.loads(code)
                baseline = {**spec, 'filters': {}, 'selection': None, 'interaction_events': []}
                response['validation_result'] = serialize(execute_mode(json.dumps(baseline), dataset, exercise_mode))
            if contract.get('required_interactions'):
                evidence, missing = _mode_module.interaction_evidence(code, dataset, contract['required_interactions'])
                response['interaction_evidence'] = evidence
                if contract.get('reference_code'):
                    reference = json.loads(contract['reference_code'])
                    reference['interaction_events'] = json.loads(code).get('interaction_events', [])
                    expected_evidence, _ = _mode_module.interaction_evidence(json.dumps(reference), dataset, contract['required_interactions'])
                    if evidence != expected_evidence: missing.append('показатели и диаграммы должны пересчитываться по выбранным данным')
                response['validation_missing'] = missing
            return response
        except Exception as exc:
            return {'ok':False,'error_type':type(exc).__name__,'error':str(exc)}
    if needs_plot:
        import matplotlib; matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
    import_ms=round((time.perf_counter()-t0)*1000)
    ns={"pd":pd,"np":np}; input_names=[]
    if needs_plot: ns.update(plt=plt,sns=sns)
    with tempfile.TemporaryDirectory(prefix="koda_job_") as work:
        old=os.getcwd(); os.chdir(work)
        try:
            prep=time.perf_counter()
            for name,val in dataset.items():
                if name=="files":
                    for filename,data in val.items():
                        safe=os.path.basename(filename); open(safe,"w",encoding="utf-8").write(data)
                elif name=="variables": ns.update(copy.deepcopy(val)); input_names.extend(val)
                elif name=="series":
                    for key,spec in val.items():
                        ns[key]=pd.Series(spec.get("data",[]),index=spec.get("index"),name=spec.get("name"),dtype=spec.get("dtype")); input_names.append(key)
                else: ns[name]=pd.DataFrame(copy.deepcopy(val)) if isinstance(val,dict) else copy.deepcopy(val); input_names.append(name)
            if setup_code:
                exec(setup_code,{"__builtins__":{"__import__":__import__}},ns)
                input_names.extend(key for key,value in ns.items() if isinstance(value,(pd.DataFrame,pd.Series)) and key not in input_names)
            originals={key:copy.deepcopy(ns[key]) for key in input_names}; prep_ms=round((time.perf_counter()-prep)*1000)
            buf=io.StringIO(); run_at=time.perf_counter()
            ns['__builtins__'] = SAFE_BUILTINS
            with contextlib.redirect_stdout(buf): exec(code,ns,ns)
            code_ms=round((time.perf_counter()-run_at)*1000)
            if result_variable not in ns:
                return {"ok":False,"error_type":"MissingResult","error":"Переменная result не создана.","stdout":buf.getvalue(),
                  "available_variables":sorted(k for k in ns if not k.startswith("_")),"timings":{"imports":import_ms,"data":prep_ms,"code":code_ms}}
            value=ns[result_variable]; plt = plt or sys.modules.get('matplotlib.pyplot')
            plot=bool(plt and plt.get_fignums()); ser_at=time.perf_counter(); result=serialize(value,plot,plt)
            contract = validation_spec or {}; validation_result = None
            if contract.get('row_selection'):
                validation_result = _mode_module.selected_rows_evidence(value, dataset, contract['row_selection'])
            if contract.get('evidence_topics'):
                validation_result = _mode_module.topics_evidence(value, dataset, contract['evidence_topics'])
            def changed(a,b):
                if isinstance(a,(pd.DataFrame,pd.Series)): return not a.equals(b)
                try:return a!=b
                except Exception:return False
            mutated=[k for k,v in originals.items() if changed(ns.get(k),v)]
            response = {"ok":True,"stdout":buf.getvalue(),"result":result,"mutated_inputs":mutated,
              "timings":{"imports":import_ms,"data":prep_ms,"code":code_ms,"serialization":round((time.perf_counter()-ser_at)*1000)}}
            if validation_result is not None: response['validation_result'] = validation_result
            return response
        except Exception as exc:
            tb=traceback.extract_tb(exc.__traceback__); user_frame=next((x for x in reversed(tb) if x.filename=="<string>"),None)
            return {"ok":False,"error_type":type(exc).__name__,"error":str(exc),"line":user_frame.lineno if user_frame else None,
              "code_line":user_frame.line if user_frame else None,"available_variables":sorted(k for k in ns if not k.startswith("_")),
              "available_files":sorted(os.listdir(work)),"timings":{"imports":import_ms}}
        finally:
            loaded_plot = plt or sys.modules.get('matplotlib.pyplot')
            if loaded_plot is not None: loaded_plot.close("all")
            os.chdir(old)

def execute_request(request):
    arguments = (request['code'], request.get('dataset', {}), request.get('result_variable', 'result'),
                 request.get('needs_plot', False), request.get('setup_code', ''), request.get('exercise_mode', 'python'))
    contract = request.get('validation_spec') or {}
    response = execute(*arguments, contract)
    variants = contract.get('variants', [])
    if variants and response.get('ok'):
        if not isinstance(variants, list) or len(variants) > 5: raise ValueError('Допустимо до пяти проверочных примеров.')
        response['variant_results'] = []
        for variant in variants:
            dataset = _mode_module.variant_dataset(arguments[1], variant)
            checked = execute(arguments[0], dataset, *arguments[2:], {key:value for key,value in contract.items() if key != 'variants'})
            response['variant_results'].append({'name': variant.get('name', 'Проверочный пример'), 'result': checked})
    return response


print(json.dumps({"ready":True,"import_ms":IMPORT_MS}),flush=True)
for line in sys.stdin:
    try:
        request=json.loads(line); response=execute_request(request)
    except Exception as exc: response={"ok":False,"error_type":"InternalError","error":"Внутренняя ошибка runner."}
    print(json.dumps(response,ensure_ascii=True,default=str),flush=True)
