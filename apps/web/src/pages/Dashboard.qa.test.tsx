import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter,useLocation } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { api } from '../api';
const state=vi.hoisted(()=>({last:null as string|null,owner:null as string|null}));
const modules=[{slug:'knowledge-only',title:'Материал без задач',solved:0,total:0,mastery:0},{slug:'start',title:'Начало работы',solved:0,total:1,mastery:0}];
const progress={solved:0,solved_ids:[],total:1,attempts:0,xp:0,modules,activity:[],recent_errors:[],first_try_accuracy:0,independent_rate:0,hints_used:0,due:0};
const exercise={id:'start-001',title:'Первая задача',module:'start',topic:'start',mode:'python',description:'Учебная задача'};
vi.mock('../auth',()=>({useAuth:()=>({user:state.owner?{id:state.owner}:null})}));
vi.mock('../StudySessionControl',()=>({useMeasuredStudyTotals:()=>({totalSeconds:0,todaySeconds:0,weekSeconds:0})}));
vi.mock('../task-storage',()=>({loadLastTask:()=>state.last,loadTaskState:()=>undefined}));
vi.mock('../api',()=>({api:vi.fn((path:string)=>Promise.resolve(path==='/progress'?progress:path==='/modules'?[{id:1,slug:'start',title:'Начало работы',description:'',order:1,topics:[{slug:'start',title:'Первая тема',exercises:[exercise]}]}]:[]))}));
function Location(){return <output aria-label="Текущий маршрут">{useLocation().pathname}</output>}
const open=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Dashboard/><Location/></MemoryRouter></QueryClientProvider>);
beforeEach(()=>{localStorage.clear();state.last=null;state.owner=null;vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({version:'qa',families:[],achievement_count:0,family_count:0})}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('continues a saved task only when it exists in the current task bank',async()=>{state.last='start-001';open();await screen.findByText('Начало работы');fireEvent.click(screen.getByRole('button',{name:'Продолжить практику →'}));expect(screen.getByLabelText('Текущий маршрут')).toHaveTextContent('/practice/start-001');});
it('routes a stale saved ID to a real available task',async()=>{state.last='retired-unknown-999';open();await screen.findByRole('button',{name:'Продолжить практику →'});fireEvent.click(screen.getByRole('button',{name:'Продолжить практику →'}));expect(screen.getByLabelText('Текущий маршрут')).toHaveTextContent('/practice/start-001');});
it('does not count a module with zero tasks as mastered',async()=>{open();await screen.findByText('Начало работы');const label=screen.getByText('темы освоены');expect(label.parentElement?.querySelector('strong')).toHaveTextContent(/^0 из /);});
it('does not display a late progress response from the previous account',async()=>{
 state.owner='A';let finishA:(value:unknown)=>void=()=>{};
 vi.mocked(api).mockImplementation((path:string)=>{if(path==='/progress'&&state.owner==='A')return new Promise(resolve=>{finishA=resolve;}) as ReturnType<typeof api>;return Promise.resolve(path==='/progress'?progress:[]) as ReturnType<typeof api>;});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),ui=()=> <QueryClientProvider client={client}><MemoryRouter><Dashboard/></MemoryRouter></QueryClientProvider>,view=render(ui());
 await waitFor(()=>expect(client.isFetching({queryKey:['progress','A']})).toBe(1));state.owner='B';view.rerender(ui());await waitFor(()=>expect(client.getQueryData(['progress','B'])).toEqual(progress));
 await act(async()=>{finishA({...progress,solved:77});await Promise.resolve();});
 await waitFor(()=>expect((client.getQueryData(['progress','A']) as typeof progress).solved).toBe(77));expect(screen.getByText('задачи решены').parentElement?.querySelector('strong')).toHaveTextContent(/^0$/);
});
