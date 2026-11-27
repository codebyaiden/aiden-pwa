import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RoutineView } from './routine/RoutineView';
import {startRoutineSync,requestSync} from './routine/sync';
import { RoutineReminder } from './routine/RoutineReminder';
import { bogotaToday, formatCOP, savingsStreak } from './savings/calculations';
import type { Movement, MovementType } from './savings/types';
import { removeMovement, restoreSnapshot, saveFinalGoal, saveMonthlyPlan, saveMovement } from './savings/storage';
import type { CalendarEvent,Countdown,EventOccurrenceState,Occurrence,PersonalSnapshot,Task,FinanceEntry,FinanceKind } from './personal/types';
import type { ParsedBackup } from './personal/backup';
import { loadPersonalSnapshot,removeCountdown,removeEvent,removeTask,removeFinanceEntry,restoreFullBackup,saveCountdown,saveEvent,saveFinanceEntry,saveOccurrenceState,saveTask } from './personal/storage';
import { AddMovementDialog } from './components/AddMovementDialog';
import { PlanDialog } from './components/PlanDialog';
import { GoalDialog } from './components/GoalDialog';
import { SavingsDetail } from './components/SavingsDetail';
import { SettingsDialog } from './components/SettingsDialog';
import { Icon, Modal } from './components/Shared';
import { CountdownDialog, EventDialog, QuickAdd, TaskDialog } from './components/PersonalDialogs';
import { FinanceView, FinanceDialog } from './components/FinanceView';
import { CalendarView, HomeView, TasksView, type Filter } from './components/PersonalViews';

type Tab='home'|'calendar'|'savings'|'tasks'|'routine';
const tabFromHash=(hash:string):Tab=>hash==='#rutina'?'routine':hash==='#alcancia'||hash==='#ahorros'||hash==='#dinero'||hash==='#gastos'?'savings':hash==='#calendario'?'calendar':hash==='#tareas'?'tasks':'home';
const tabHash=(tab:Tab)=>tab==='routine'?'#rutina':tab==='savings'?'#alcancia':tab==='calendar'?'#calendario':tab==='tasks'?'#tareas':'#inicio';
type Overlay=
 |{kind:'movement';type:MovementType;movement?:Movement}|{kind:'detail';movement:Movement}
 |{kind:'plan'|'goal'|'settings'|'quick'}
 |{kind:'event';event?:CalendarEvent;occurrence?:Occurrence;date:string}
 |{kind:'task';task?:Task;date?:string}
 |{kind:'countdown';countdown?:Countdown}
 |{kind:'finance';direction:FinanceKind;entry?:FinanceEntry;occurrence?:Occurrence};
const nowISO=()=>new Date().toISOString();
function TabIcon({tab}:{tab:Tab}){
  const shapes:Record<Tab,ReactNode>={
    home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m3 0h2"/></>,
    savings:<><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M15 15h3"/></>,
    routine:<><path d="M12 3v18M3 12h18"/></>,
    tasks:<><path d="m4 7 2 2 3-4m3 2h8M4 16l2 2 3-4m3 2h8"/></>
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[tab]}</svg>;
}

export default function App(){
  useEffect(startRoutineSync,[]);
  useEffect(()=>{document.body.classList.add('routine-winter');document.body.style.setProperty('--routine-winter-gif',`url(${import.meta.env.BASE_URL}routine/winter.gif)`);document.body.style.setProperty('--routine-winter-still',`url(${import.meta.env.BASE_URL}routine/winter.webp)`);return()=>{document.body.classList.remove('routine-winter');document.body.style.removeProperty('--routine-winter-gif');document.body.style.removeProperty('--routine-winter-still');};},[]);
  const [snapshot,setSnapshot]=useState<PersonalSnapshot|null>(null);
  const [loadError,setLoadError]=useState('');const [today,setToday]=useState(bogotaToday);
  const [tab,setTab]=useState<Tab>(()=>tabFromHash(location.hash));
  const [moneyPane,setMoneyPane]=useState<'savings'|'finance'>('savings');
  const [calendarMonth,setCalendarMonth]=useState(()=>bogotaToday().slice(0,7));
  const [selectedDay,setSelectedDay]=useState(bogotaToday);
  const [calendarFilter,setCalendarFilter]=useState<Filter>('all');
  const [overlay,setOverlay]=useState<Overlay|null>(null);
  const [message,setMessage]=useState('');const [newId,setNewId]=useState<string|null>(null);
  const [streakCelebrate,setStreakCelebrate]=useState(false);
  const [removing,setRemoving]=useState(false);const [removeError,setRemoveError]=useState('');
  const {needRefresh:[needRefresh],updateServiceWorker}=useRegisterSW({onRegisteredSW(){}});
  useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),2900);return()=>clearTimeout(id);},[message]);
  useEffect(()=>{if(!streakCelebrate)return;const id=setTimeout(()=>setStreakCelebrate(false),750);return()=>clearTimeout(id);},[streakCelebrate]);
  const refresh=useCallback(async()=>{
    try{const fresh=await loadPersonalSnapshot();setSnapshot(fresh);setLoadError('');setToday(bogotaToday());}
    catch(e){setLoadError(e instanceof Error?e.message:'No se pudieron leer los datos guardados.');}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    const handler=()=>{setTab(tabFromHash(location.hash));if(location.hash==='#gastos')setMoneyPane('finance');};window.addEventListener('hashchange',handler);
    return()=>window.removeEventListener('hashchange',handler);
  },[]);
  useEffect(()=>{
    let channel:BroadcastChannel|null=null;
    try{channel=new BroadcastChannel('aiden-savings-updates');}catch{ /* unsupported */ }
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    const onChanged=()=>{void refresh();};
    channel?.addEventListener('message',onChanged);
    window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('aiden:storage-changed',onChanged);
    return()=>{channel?.close();window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('aiden:storage-changed',onChanged);};
  },[refresh]);
  useEffect(()=>{
    const visibility=()=>{document.documentElement.classList.toggle('tab-hidden',document.visibilityState!=='visible');};
    document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);
  },[]);
  const changed=()=>{try{const channel=new BroadcastChannel('aiden-savings-updates');channel.postMessage('changed');channel.close();}catch{/* optional */}};
  async function commitAndRefresh(work:()=>Promise<void>):Promise<PersonalSnapshot>{
    await work();changed();
    try{const next=await loadPersonalSnapshot();setSnapshot(next);setLoadError('');setToday(bogotaToday());return next;}
    catch{void refresh();throw new Error('Los datos se guardaron, pero no se pudieron volver a leer. Actualiza la vista antes de reintentar.');}
  }
  function navigate(to:Tab){if(tab===to)return;location.hash=tabHash(to);setTab(to);window.scrollTo({top:0,behavior:'instant'});}
  async function saveMovementRecord(next:Movement,mode:'add'|'edit'){
    const before=snapshot?savingsStreak(snapshot.movements,bogotaToday()).months:0;
    const fresh=await commitAndRefresh(()=>saveMovement(next,mode));
    if(next.type==='deposit'&&savingsStreak(fresh.movements,bogotaToday()).months>before)setStreakCelebrate(true);
    setOverlay(null);setNewId(next.id);setMessage(mode==='edit'?'Movimiento actualizado':next.type==='deposit'?'Aporte guardado':'Retiro registrado');
  }
  async function savePlan(value:number|null){await commitAndRefresh(()=>saveMonthlyPlan(value));setOverlay(null);setMessage('Plan guardado');}
  async function saveGoal(value:number|null){await commitAndRefresh(()=>saveFinalGoal(value));setOverlay(null);setMessage(value===null?'Meta eliminada':'Meta guardada');}
  async function restore(backup:ParsedBackup){
    await commitAndRefresh(()=>backup.kind==='full'?restoreFullBackup(backup.data,backup.preserveFinance,backup.routine):restoreSnapshot(backup.savings));
    requestSync();
    setNewId(null);setOverlay(null);setMessage(backup.kind==='full'?'Copia restaurada':'Ahorros restaurados; agenda conservada');
  }
  async function remove(m:Movement){if(removing)return;setRemoving(true);setRemoveError('');try{await commitAndRefresh(()=>removeMovement(m.id));setOverlay(null);setNewId(null);setMessage('Movimiento eliminado');}catch(e){setRemoveError(e instanceof Error?e.message:'No se pudo eliminar.');}finally{setRemoving(false);}}
  async function saveCalendarEvent(next:CalendarEvent,mode:'add'|'edit'){
    await commitAndRefresh(()=>saveEvent(next,mode));setOverlay(null);setMessage('Evento guardado');
  }
  async function deleteCalendarEvent(e:CalendarEvent){await commitAndRefresh(()=>removeEvent(e.id));setOverlay(null);setMessage('Serie eliminada');}
  async function saveCalendarState(next:EventOccurrenceState|null,id:string,start:string){
    await commitAndRefresh(()=>saveOccurrenceState(next,id,start));setOverlay(null);setMessage(next?'Estado guardado':'Pendiente otra vez');
  }
  async function saveRealFinance(next:FinanceEntry,mode:'add'|'edit'){
    await commitAndRefresh(()=>saveFinanceEntry(next,mode));setOverlay(null);setMessage(mode==='edit'?'Registro actualizado':next.kind==='expense'?'Gasto guardado':'Ingreso guardado');
  }
  async function deleteRealFinance(next:FinanceEntry){
    await commitAndRefresh(()=>removeFinanceEntry(next.id));setOverlay(null);setMessage('Registro eliminado');
  }
  function openRealFinance(o:Occurrence){
    const existing=snapshot?.financeEntries.find(e=>e.occurrenceKey===o.key);
    setOverlay({kind:'finance',direction:o.event.category==='expense'?'expense':'income',occurrence:o,entry:existing});
  }
  async function savePersonalTask(next:Task,mode:'add'|'edit'){await commitAndRefresh(()=>saveTask(next,mode));setOverlay(null);setMessage('Tarea guardada');}
  async function deletePersonalTask(t:Task){await commitAndRefresh(()=>removeTask(t.id));setOverlay(null);setMessage('Tarea eliminada');}
  async function toggleTask(t:Task){try{await commitAndRefresh(()=>saveTask({...t,completedAt:t.completedAt?undefined:nowISO(),updatedAt:nowISO()},'edit'));setMessage(t.completedAt?'Tarea pendiente':'Tarea completada');}catch(e){setMessage(e instanceof Error?e.message:'No se pudo actualizar la tarea.');}}
  async function savePersonalCountdown(next:Countdown,mode:'add'|'edit'){await commitAndRefresh(()=>saveCountdown(next,mode));setOverlay(null);setMessage('Countdown guardado');}
  async function deletePersonalCountdown(c:Countdown){await commitAndRefresh(()=>removeCountdown(c.id));setOverlay(null);setMessage('Countdown eliminado');}
  const label=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',weekday:'long',day:'numeric',month:'long'}).format(new Date(`${today}T12:00:00-05:00`));
  const selectedMovement=overlay?.kind==='detail'?snapshot?.movements.find(m=>m.id===overlay.movement.id):null;
  const selectedEvent=overlay?.kind==='event'?snapshot?.events.find(e=>e.id===overlay.event?.id):undefined;
  const selectedTask=overlay?.kind==='task'?snapshot?.tasks.find(t=>t.id===overlay.task?.id):undefined;
  const selectedCountdown=overlay?.kind==='countdown'?snapshot?.countdowns.find(c=>c.id===overlay.countdown?.id):undefined;
  return <div className="app-shell">
    <header className="app-header"><div><button type="button" className="wordmark" onClick={()=>navigate('home')} aria-label="Ir a Inicio">aiden<span>.</span></button><p className="header-date">{label}</p></div><button type="button" className="icon-button settings-button" aria-label="Ajustes y copias de seguridad" disabled={!snapshot} onClick={()=>setOverlay({kind:'settings'})}><Icon name="settings"/></button></header>
    {snapshot&&!loadError&&!overlay&&tab!=='routine'&&<RoutineReminder onOpen={()=>navigate('routine')}/>}<main id="main-content">{snapshot&&!loadError&&tab==='home'&&<button type="button" className="routine-entry" onClick={()=>navigate('routine')}><span><strong>Rutina</strong><small>Ver lo que sigue</small></span><span aria-hidden="true">›</span></button>}{loadError?<section role="alert" className="load-error"><h1>No pudimos leer tus datos</h1><p>{loadError}</p><p>No se ha borrado ningún registro.</p><button className="button-primary" onClick={()=>void refresh()}>Reintentar</button></section>
      :!snapshot?<p role="status" className="loading-label">Cargando datos locales…</p>
      :tab==='routine'?<RoutineView onBack={()=>navigate('home')}/>
      :tab==='home'?<HomeView data={snapshot} today={today} streakCelebrate={streakCelebrate} onSavings={()=>{setMoneyPane('savings');navigate('savings');}} onFinance={()=>{setMoneyPane('finance');navigate('savings');}} onCalendar={()=>navigate('calendar')} onTasks={()=>navigate('tasks')} onAddEvent={()=>setOverlay({kind:'event',date:today})} onOpenEvent={o=>setOverlay({kind:'event',event:o.event,occurrence:o,date:o.startDate})} onOpenTask={task=>setOverlay({kind:'task',task})} onTaskToggle={t=>void toggleTask(t)} onCountdown={countdown=>setOverlay({kind:'countdown',countdown})} onAddCountdown={()=>setOverlay({kind:'countdown'})}/>
      :tab==='calendar'?<CalendarView data={snapshot} today={today} month={calendarMonth} onMonth={setCalendarMonth} selected={selectedDay} onSelect={setSelectedDay} filter={calendarFilter} onFilter={setCalendarFilter} onAddEvent={date=>setOverlay({kind:'event',date})} onOpenEvent={o=>setOverlay({kind:'event',event:o.event,occurrence:o,date:o.startDate})} onOpenTask={task=>setOverlay({kind:'task',task})} onTaskToggle={t=>void toggleTask(t)} onOpenCountdown={countdown=>setOverlay({kind:'countdown',countdown})} onAddCountdown={()=>setOverlay({kind:'countdown'})}/>
      :tab==='savings'?<div className="view-panel money-hub"><div className="money-header"><h1>Dinero</h1><p className="field-hint">Alcancía y movimientos personales, por separado.</p></div><div className="money-switch" role="group" aria-label="Sección de Dinero">
        <button className={moneyPane==='savings'?'selected':''} aria-pressed={moneyPane==='savings'} onClick={()=>setMoneyPane('savings')} type="button">Alcancía</button>
        <button className={moneyPane==='finance'?'selected':''} aria-pressed={moneyPane==='finance'} onClick={()=>setMoneyPane('finance')} type="button">Gastos e ingresos</button>
      </div>{moneyPane==='savings'?<SavingsDetail data={snapshot} today={today} newlySavedId={newId} onBack={()=>navigate('home')} onAdd={()=>setOverlay({kind:'movement',type:'deposit'})} onWithdraw={()=>setOverlay({kind:'movement',type:'withdrawal'})} onPlan={()=>setOverlay({kind:'plan'})} onGoal={()=>setOverlay({kind:'goal'})} streakCelebrate={streakCelebrate} onSelect={movement=>{setRemoveError('');setOverlay({kind:'detail',movement});}}/>:
      <FinanceView data={snapshot} today={today} onAdd={direction=>setOverlay({kind:'finance',direction})} onEdit={entry=>setOverlay({kind:'finance',entry,direction:entry.kind})} onOpenOccurrence={openRealFinance}/>}</div>
      :<TasksView tasks={snapshot.tasks} today={today} onOpen={task=>setOverlay({kind:'task',task})} onAdd={()=>setOverlay({kind:'task'})} onToggle={t=>void toggleTask(t)}/>}
    </main>
    {snapshot&&!overlay&&<nav className={`bottom-nav nav-${tab==='routine'?'home':tab}`} aria-label="Navegación principal">{(['home','calendar'] as const).map(key=><button key={key} type="button" className={`bottom-tab ${tab===key||(tab==='routine'&&key==='home')?'current':''}`} aria-current={tab===key?'page':undefined} onClick={()=>navigate(key)}><TabIcon tab={key}/><span>{key==='home'?'Inicio':'Calendario'}</span></button>)}
      <button className="bottom-add" type="button" aria-label="Añadir" onClick={()=>setOverlay({kind:'quick'})}><Icon name="plus"/></button>
      {(['savings','tasks'] as const).map(key=><button key={key} type="button" className={`bottom-tab ${tab===key?'current':''}`} aria-current={tab===key?'page':undefined} onClick={()=>navigate(key)}><TabIcon tab={key}/><span>{key==='savings'?'Dinero':'Tareas'}</span></button>)}</nav>}
    {needRefresh&&!overlay&&<aside className="update-banner"><span>Hay una versión nueva.</span><button type="button" className="text-action" onClick={()=>void updateServiceWorker(true)}>Actualizar</button></aside>}
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>{message&&<div className="toast">{message}</div>}
    {snapshot&&overlay?.kind==='quick'&&<QuickAdd onClose={()=>setOverlay(null)} onChoose={which=>setOverlay(which==='money'?{kind:'movement',type:'deposit'}:which==='event'?{kind:'event',date:today}:which==='task'?{kind:'task'}:{kind:'countdown'})}/>}
    {snapshot&&overlay?.kind==='movement'&&<AddMovementDialog key={`${overlay.type}-${overlay.movement?.id??'new'}`} type={overlay.type} original={overlay.movement} onDismiss={()=>setOverlay(null)} onSave={saveMovementRecord}/>}
    {snapshot&&overlay?.kind==='goal'&&<GoalDialog current={snapshot.settings.finalGoalCOP} onClose={()=>setOverlay(null)} onSave={saveGoal}/>}
    {snapshot&&overlay?.kind==='plan'&&<PlanDialog current={snapshot.settings.monthlyPlanCOP} onClose={()=>setOverlay(null)} onSave={savePlan}/>}
    {snapshot&&overlay?.kind==='settings'&&<SettingsDialog data={snapshot} onClose={()=>setOverlay(null)} onRestore={restore}/>}
    {snapshot&&overlay?.kind==='event'&&<EventDialog key={overlay.event?.id??'new-event'} event={selectedEvent} occurrence={overlay.occurrence} initialDate={overlay.date} currentState={snapshot.eventOccurrenceStates.find(s=>s.occurrenceKey===overlay.occurrence?.key)} onSave={saveCalendarEvent} onDelete={deleteCalendarEvent} onState={saveCalendarState} onRecord={overlay.occurrence?()=>openRealFinance(overlay.occurrence!):undefined} onClose={()=>setOverlay(null)}/>}
    {snapshot&&overlay?.kind==='finance'&&<FinanceDialog key={overlay.entry?.id??overlay.occurrence?.key??overlay.direction} data={snapshot} today={today} entry={overlay.entry} occurrence={overlay.occurrence} kind={overlay.direction} onSave={saveRealFinance} onDelete={deleteRealFinance} onClose={()=>setOverlay(null)}/>}
    {snapshot&&overlay?.kind==='task'&&<TaskDialog key={overlay.task?.id??'new-task'} task={selectedTask} initialDate={overlay.date} onSave={savePersonalTask} onDelete={deletePersonalTask} onClose={()=>setOverlay(null)}/>}
    {snapshot&&overlay?.kind==='countdown'&&<CountdownDialog key={overlay.countdown?.id??'new-countdown'} countdown={selectedCountdown} events={snapshot.events} onSave={savePersonalCountdown} onDelete={deletePersonalCountdown} onClose={()=>setOverlay(null)}/>}
    {snapshot&&overlay?.kind==='detail'&&selectedMovement&&<Modal title="Detalle del movimiento" onClose={()=>setOverlay(null)} busy={removing}>
      <div className="movement-inspection"><span className="eyebrow">{selectedMovement.type==='deposit'?'Aporte':'Retiro'}</span><strong>{selectedMovement.type==='deposit'?'+':'−'} {formatCOP(selectedMovement.amountCOP)}</strong><p>{selectedMovement.localDate}</p>{selectedMovement.note&&<p className="detail-note">{selectedMovement.note}</p>}</div>
      {removeError&&<p className="field-error" role="alert">{removeError}</p>}
      <div className="inspection-actions"><button className="button-primary" onClick={()=>setOverlay({kind:'movement',type:selectedMovement.type,movement:selectedMovement})} disabled={removing}>Editar</button><button className="button-danger-outline" disabled={removing} onClick={()=>{if(window.confirm('¿Eliminar movimiento? Cambiará el saldo y no se puede deshacer.'))void remove(selectedMovement);}}>{removing?'Eliminando…':'Eliminar movimiento'}</button></div>
    </Modal>}
  </div>;
}
