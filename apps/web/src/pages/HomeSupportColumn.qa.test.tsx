import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { HomeSupportColumn } from './HomeSupportColumn';
const state=vi.hoisted(()=>({auth:'A' as string|null,scope:'A',snapshots:{} as Record<string,unknown>,error:false}));
const manifest={version:'qa',achievement_count:2,family_count:1,families:[{slug:'01_solved_tasks',name:'Задачи',achievements:[{id:'first_task',name:'Первое открытие',condition:'Одна задача'},{id:'warmup',name:'Уверенный шаг',condition:'Десять задач'}]}]};
vi.mock('../auth',()=>({useAuth:()=>({user:state.auth?{id:state.auth}:null})}));
vi.mock('../achievements/engine',()=>({loadSnapshot:vi.fn(()=>state.snapshots[state.scope]),evaluate:vi.fn(()=>{throw Error('Read-only sidebar must not evaluate');}),emitAchievementEvent:vi.fn()}));
vi.mock('../achievements/manifest',()=>({getCachedAchievementManifest:()=>null,loadAchievementManifest:vi.fn(async()=>{if(state.error)throw Error('offline');return manifest;})}));
vi.mock('../achievements/AchievementArt',()=>({AchievementArt:({id}:{id:string})=><svg aria-hidden="true" data-award={id}/> }));
import { evaluate,emitAchievementEvent } from '../achievements/engine';
const snap=(id?:string)=>({events:[],unlocked:id?{[id]:{unlockedAt:'2026-10-08T12:00:00Z',sourceEventId:'qa',xp:10}}:{},activeCosmetics:{},backfillVersion:2,timezone:'UTC'});
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const ui=()=> <QueryClientProvider client={client}><MemoryRouter><HomeSupportColumn continuation={null}/></MemoryRouter></QueryClientProvider>;return {view:render(ui()),ui};}
beforeEach(()=>{state.auth='A';state.scope='A';state.error=false;state.snapshots={A:snap(),B:snap('warmup')};localStorage.clear();vi.clearAllMocks();});
afterEach(cleanup);
it('shows an honest empty state and reads evidence without evaluating or writing storage',async()=>{
 const write=vi.spyOn(Storage.prototype,'setItem');const before=JSON.stringify(state.snapshots);open();await screen.findByText('Полученные достижения появятся здесь.');expect(evaluate).not.toHaveBeenCalled();expect(emitAchievementEvent).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(JSON.stringify(state.snapshots)).toBe(before);write.mockRestore();
});
it('refreshes a real award after the learning event without creating a reward',async()=>{
 open();await screen.findByText('Полученные достижения появятся здесь.');state.snapshots.A=snap('first_task');act(()=>window.dispatchEvent(new Event('koda-achievements-updated')));await screen.findByText('Первое открытие');expect(screen.getByText('Одна задача')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Вся коллекция →'})).toHaveAttribute('href','/achievements');expect(evaluate).not.toHaveBeenCalled();expect(emitAchievementEvent).not.toHaveBeenCalled();
});
it('clears old-owner data during account change and renders only the new scope',async()=>{
 state.snapshots.A=snap('first_task');const {view,ui}=open();await screen.findByText('Первое открытие');state.auth='B';view.rerender(ui());expect(screen.queryByText('Первое открытие')).not.toBeInTheDocument();state.scope='B';act(()=>window.dispatchEvent(new CustomEvent('koda-study-account-changed',{detail:'B'})));await screen.findByText('Уверенный шаг');expect(screen.queryByText('Первое открытие')).not.toBeInTheDocument();
 act(()=>window.dispatchEvent(new CustomEvent('koda-study-account-changed',{detail:'A'})));await waitFor(()=>expect(screen.queryByText('Уверенный шаг')).not.toBeInTheDocument());expect(evaluate).not.toHaveBeenCalled();
});
it('exposes manifest failure and retries without inventing an award',async()=>{
 state.error=true;open();await screen.findByText('Не удалось загрузить коллекцию.');expect(screen.queryByText('Первое открытие')).not.toBeInTheDocument();state.error=false;fireEvent.click(screen.getByRole('button',{name:'Повторить'}));await screen.findByText('Полученные достижения появятся здесь.');
});
