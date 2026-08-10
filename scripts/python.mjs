import{spawnSync}from'node:child_process';import{existsSync}from'node:fs';
const win=process.platform==='win32', local=win?'.venv\\Scripts\\python.exe':'.venv/bin/python', py=existsSync(local)?local:(win?'python':'python3');
const r=spawnSync(py,process.argv.slice(2),{stdio:'inherit',shell:false});process.exit(r.status??1);
