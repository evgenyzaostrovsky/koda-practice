import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const win = process.platform === 'win32';
const py = existsSync('.venv') ? (win ? '.venv\\Scripts\\python.exe' : '.venv/bin/python') : (win ? 'python' : 'python3');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{stdio:'inherit',shell:win});if(r.status)process.exit(r.status)};
if(!existsSync('.venv')) run(win?'python':'python3',['-m','venv','.venv']);
run(py,['-m','pip','install','-r','apps/api/requirements.txt']);
run('npm',['install']); run('npm',['install','--prefix','apps/web']);
console.log('\nKODA Practice готов. Запустите: npm run dev');
