type Json=Record<string,any>;
let catalogPromise:Promise<Json>|null=null;
const catalog=()=>catalogPromise??=fetch('/catalog.json').then(r=>r.json());
const progressKey='koda:sites-progress-v2';
const readProgress=()=>{try{return JSON.parse(localStorage.getItem(progressKey)||'{"solved":[],"attempts":0,"hints":{}}')}catch{return{solved:[],attempts:0,hints:{}}}};
const writeProgress=(value:Json)=>localStorage.setItem(progressKey,JSON.stringify(value));
const allTopics=(data:Json)=>data.modules.flatMap((module:Json)=>module.topics);
const allExercises=(data:Json)=>allTopics(data).flatMap((topic:Json)=>topic.exercises);
const publicExercise=(exercise:Json)=>Object.fromEntries(Object.entries(exercise).filter(([key])=>key!=='solution_code'));
const publicModule=(module:Json)=>({...module,topics:module.topics.map((topic:Json)=>({...topic,exercises:topic.exercises.map(publicExercise)}))});
export async function localApi<T>(path:string,init?:RequestInit):Promise<T>{
 const data=await catalog(),topics=allTopics(data),exercises=allExercises(data),state=readProgress(),body=init?.body?JSON.parse(String(init.body)):{};
 if(path==='/modules')return data.modules.map(publicModule) as T;
 if(path==='/progress'){const solved=new Set<string>(state.solved||[]),modules=data.modules.map((module:Json)=>{const ids=module.topics.flatMap((topic:Json)=>topic.exercises.map((exercise:Json)=>exercise.id)),done=ids.filter((id:string)=>solved.has(id)).length;return{slug:module.slug,title:module.title,solved:done,total:ids.length,mastery:Math.round(done/ids.length*100),status:done===ids.length?'mastered':done?'learning':'not_started'}});return{solved:solved.size,total:exercises.length,attempts:state.attempts||0,first_try_accuracy:0,independent_rate:0,hints_used:Object.values(state.hints||{}).flat().length,xp:exercises.filter((e:Json)=>solved.has(e.id)).reduce((n:number,e:Json)=>n+e.xp,0),due:0,modules,activity:[],recent_errors:[]} as T}
 const topicMatch=path.match(/^\/topics\/([^/]+)$/);if(topicMatch){const topic=topics.find((item:Json)=>item.slug===topicMatch[1]);if(!topic)throw new Error('Тема не найдена');return{...topic,exercises:topic.exercises.map(publicExercise)} as T}
 const exerciseMatch=path.match(/^\/exercises\/([^/]+)$/);if(exerciseMatch){const exercise=exercises.find((item:Json)=>item.id===exerciseMatch[1]);if(!exercise)throw new Error('Задача не найдена');return publicExercise(exercise) as T}
 const hintMatch=path.match(/^\/exercises\/([^/]+)\/hints\/(\d)$/);if(hintMatch){const exercise=exercises.find((item:Json)=>item.id===hintMatch[1]),level=Number(hintMatch[2]);state.hints[exercise.id]=Array.from(new Set([...(state.hints[exercise.id]||[]),level]));writeProgress(state);return{level,content:exercise.hints[level-1]} as T}
 const solutionMatch=path.match(/^\/exercises\/([^/]+)\/solution$/);if(solutionMatch){const exercise=exercises.find((item:Json)=>item.id===solutionMatch[1]);return{solution:exercise.solution_code} as T}
 if(path==='/executions/run'||path==='/attempts/submit'){const exercise=exercises.find((item:Json)=>item.id===body.exercise_id);if(!exercise)throw new Error('Задача не найдена');const normalize=(code:string)=>code.replace(/\s+/g,' ').trim().replace(/'/g,'"'),passed=normalize(body.code)===normalize(exercise.solution_code);state.attempts=(state.attempts||0)+1;if(path==='/attempts/submit'&&passed)state.solved=Array.from(new Set([...(state.solved||[]),exercise.id]));writeProgress(state);if(path==='/executions/run')return{ok:true,execution_ms:0,result:{kind:'scalar',data:'Код подготовлен. Нажмите «Проверить».'}} as T;return(passed?{ok:true,passed:true,tests_passed:1,tests_total:1,attempt_number:state.attempts,hints_used:(state.hints[exercise.id]||[]).length,xp_earned:exercise.xp,execution_ms:0,approach:exercise.explanation}:{ok:true,passed:false,tests_passed:0,tests_total:1,execution_ms:0,explanation:{what:'Ответ не совпал с эталонным решением.',expected:'Основной метод темы',actual:'Другое выражение',difference:'Проверьте метод, параметры и result.',check:'Сверьтесь с условием.',nudge:exercise.hints[0]}}) as T}
 throw new Error('Неизвестный API-маршрут');
}
