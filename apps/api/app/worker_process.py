"""Persistent isolated execution worker. Protocol: one JSON object per line."""
import contextlib, copy, io, json, os, sys, tempfile, time, traceback

started=time.perf_counter()
import numpy as np
import pandas as pd
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
    if isinstance(value,pd.DataFrame):
        return {"kind":"dataframe","columns":[str(x) for x in value.columns],"index":[str(x) for x in value.index],
          "data":json.loads(value.to_json(orient="values",date_format="iso")),"dtypes":[str(x) for x in value.dtypes],"shape":list(value.shape)}
    if isinstance(value,pd.Series):
        return {"kind":"series","name":str(value.name) if value.name is not None else None,"index":[str(x) for x in value.index],
          "data":json.loads(value.to_json(orient="values",date_format="iso")),"dtype":str(value.dtype),"shape":[len(value)]}
    if plot and plt is not None:
        ax=value if hasattr(value,"get_title") else plt.gca()
        return {"kind":"plot","created":True,"title":ax.get_title(),"xlabel":ax.get_xlabel(),"ylabel":ax.get_ylabel(),
          "lines":[{"x":clean(line.get_xdata()),"y":clean(line.get_ydata())} for line in ax.lines],"patches":len(ax.patches)}
    return {"kind":"scalar","data":clean(value)}

def execute(code,dataset,result_variable,needs_plot=False,setup_code=""):
    t0=time.perf_counter(); plt=None; sns=None
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
            originals={key:copy.deepcopy(ns[key]) for key in input_names}; prep_ms=round((time.perf_counter()-prep)*1000)
            buf=io.StringIO(); run_at=time.perf_counter()
            with contextlib.redirect_stdout(buf): exec(code,{"__builtins__":SAFE_BUILTINS},ns)
            code_ms=round((time.perf_counter()-run_at)*1000)
            if result_variable not in ns:
                return {"ok":False,"error_type":"MissingResult","error":"Переменная result не создана.","stdout":buf.getvalue(),
                  "available_variables":sorted(k for k in ns if not k.startswith("_")),"timings":{"imports":import_ms,"data":prep_ms,"code":code_ms}}
            value=ns[result_variable]; plot=bool(plt and plt.get_fignums()); ser_at=time.perf_counter(); result=serialize(value,plot,plt)
            def changed(a,b):
                if isinstance(a,(pd.DataFrame,pd.Series)): return not a.equals(b)
                try:return a!=b
                except Exception:return False
            mutated=[k for k,v in originals.items() if changed(ns.get(k),v)]
            return {"ok":True,"stdout":buf.getvalue(),"result":result,"mutated_inputs":mutated,
              "timings":{"imports":import_ms,"data":prep_ms,"code":code_ms,"serialization":round((time.perf_counter()-ser_at)*1000)}}
        except Exception as exc:
            tb=traceback.extract_tb(exc.__traceback__); user_frame=next((x for x in reversed(tb) if x.filename=="<string>"),None)
            return {"ok":False,"error_type":type(exc).__name__,"error":str(exc),"line":user_frame.lineno if user_frame else None,
              "code_line":user_frame.line if user_frame else None,"available_variables":sorted(k for k in ns if not k.startswith("_")),
              "available_files":sorted(os.listdir(work)),"timings":{"imports":import_ms}}
        finally:
            if plt is not None: plt.close("all")
            os.chdir(old)

print(json.dumps({"ready":True,"import_ms":IMPORT_MS}),flush=True)
for line in sys.stdin:
    try:
        request=json.loads(line); response=execute(request["code"],request.get("dataset",{}),request.get("result_variable","result"),request.get("needs_plot",False),request.get("setup_code",""))
    except Exception as exc: response={"ok":False,"error_type":"InternalError","error":"Внутренняя ошибка runner."}
    print(json.dumps(response,ensure_ascii=True,default=str),flush=True)
