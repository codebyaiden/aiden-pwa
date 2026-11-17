import { useEffect,useMemo,useState } from 'react';
import { balance,formatCOP,monthTotals,projection,formatMonth } from '../savings/calculations';
import { addDays, countdownText, dayDifference, financialReminders, localDateLabel, monthCells, occurrencesForRange, occurrencesOnDay, resolveCountdown } from '../personal/dates';
import type { CalendarEvent,Countdown,EventOccurrenceState,Occurrence,PersonalSnapshot,Task } from '../personal/types';
import { AnimatedMoney,Icon } from './Shared';
import { StreakIndicator } from './SavingsInsights';

type Filter='all'|'personal'|'expense'|'income'|'important';
function categoryName(cat:CalendarEvent['category']){return cat==='expense'?'Pago':cat==='income'?'Ingreso':'Personal';}
function statusLabel(o:Occurrence,states:EventOccurrenceState[],today:string){
  const s=states.find(x=>x.occurrenceKey===o.key);
  return s?s.status==='paid'?'Pagado':s.status==='received'?'Recibido':'Omitido':o.event.category==='expense'?(o.startDate<today?'Vencido':'Pendiente'):o.event.category==='income'?'Por recibir':'';
}
export function EventRow({o,states,today,onOpen}:{o:Occurrence;states:EventOccurrenceState[];today:string;onOpen:(o:Occurrence)=>void}){
  const status=statusLabel(o,states,today);
  return <button className="agenda-row" type="button" onClick={()=>onOpen(o)}>
    <span className="agenda-meta">{o.event.startTime??'Todo el día'} <span aria-hidden="true">·</span> {categoryName(o.event.category)}{o.event.important?' · ★':''}</span>
    <span className="agenda-main"><strong>{o.event.title}</strong>{o.event.amountCOP&&<span className="money-value">{formatCOP(o.event.amountCOP)}</span>}</span>
    <span className="agenda-sub">{o.endDate!==o.startDate?`${o.startDate} a ${o.endDate}`:''}{status?`${o.endDate!==o.startDate?' · ':''}${status}`:''}</span>
  </button>;
}
export function CalendarView({data,today,month,onMonth,selected,onSelect,filter,onFilter,onOpenEvent,onOpenTask,onAddEvent,onTaskToggle,onOpenCountdown,onAddCountdown}: {
 data:PersonalSnapshot;today:string;month:string;onMonth:(m:string)=>void;selected:string;onSelect:(d:string)=>void;filter:Filter;onFilter:(f:Filter)=>void;
 onOpenEvent:(o:Occurrence)=>void;onOpenTask:(t:Task)=>void;onAddEvent:(date:string)=>void;onTaskToggle:(t:Task)=>void;onOpenCountdown:(c:Countdown)=>void;onAddCountdown:()=>void;
}){
  const cells=useMemo(()=>monthCells(month),[month]);
  const from=cells[0],to=cells[cells.length-1];
  const visibleEvents=useMemo(()=>data.events.filter(e=>filter==='all'||filter==='important'&&e.important||e.category===filter),[data.events,filter]);
  const occurrences=useMemo(()=>occurrencesForRange(visibleEvents,from,to),[visibleEvents,from,to]);
  const tasks=data.tasks.filter(t=>t.dueDate&&filter==='all');
  const selectedOccurrences=occurrences.filter(o=>o.startDate<=selected&&o.endDate>=selected);
  const selectedTasks=tasks.filter(t=>t.dueDate===selected);
  const changeMonth=(offset:number)=>{
    const [year,m]=month.split('-').map(Number);const shifted=new Date(Date.UTC(year,m-1+offset,1,12));const next=`${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth()+1).padStart(2,'0')}`;
    onMonth(next);onSelect(`${next}-01`);
  };
  const startYear=Math.min(1900,Number(month.slice(0,4))-10);
  const years=Array.from({length:Math.max(2030,Number(month.slice(0,4))+10)-startYear+1},(_,i)=>startYear+i);
  return <div className="view-panel calendar-view" key="calendar">
    <div className="calendar-heading"><div><h1>Calendario</h1><p className="field-hint">{localDateLabel(selected)}</p></div><button className="text-action" onClick={()=>{onMonth(today.slice(0,7));onSelect(today);}}>Hoy</button></div>
    <section className="calendar-section" aria-label="Calendario mensual">
      <div className="calendar-month-controls">
        <button type="button" className="icon-button" aria-label="Mes anterior" onClick={()=>changeMonth(-1)}><Icon name="left"/></button>
        <div className="month-pickers"><select aria-label="Mes" className="month-select" value={Number(month.slice(5,7))} onChange={e=>{const next=`${month.slice(0,4)}-${String(e.target.value).padStart(2,'0')}`;onMonth(next);onSelect(`${next}-01`);}}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Intl.DateTimeFormat('es-CO',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1)))}</option>)}</select>
          <select aria-label="Año" className="month-select" value={month.slice(0,4)} onChange={e=>{const next=`${e.target.value}-${month.slice(5,7)}`;onMonth(next);onSelect(`${next}-01`);}}>{years.map(y=><option key={y}>{y}</option>)}</select></div>
        <button type="button" className="icon-button" aria-label="Mes siguiente" onClick={()=>changeMonth(1)}><Icon name="right"/></button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{['lun','mar','mié','jue','vie','sáb','dom'].map(x=><span key={x}>{x}</span>)}</div>
      <div className="calendar-grid" key={month} role="group" aria-label={formatMonth(month)}>
        {cells.map((day,i)=>{
          const todays=occurrences.filter(o=>o.startDate<=day&&o.endDate>=day);
          const dayTasks=tasks.filter(t=>t.dueDate===day);
          const week=Math.floor(i/7);
          const weekBanded=occurrences.filter(o=>o.endDate>o.startDate&&cells.slice(week*7,week*7+7).some(d=>d>=o.startDate&&d<=o.endDate));
          const band=weekBanded[0];const onBand=band&&day>=band.startDate&&day<=band.endDate;
          const bandPrev=onBand&&i%7!==0&&cells[i-1]>=band.startDate&&cells[i-1]<=band.endDate;
          const bandNext=onBand&&i%7!==6&&cells[i+1]>=band.startDate&&cells[i+1]<=band.endDate;
          const overflow=todays.length>3?` +${todays.length-3}`:'';
          return <button type="button" key={day} className={`calendar-day ${day.slice(0,7)!==month?'outside':''} ${day===today?'today':''} ${day===selected?'selected':''}`}
            aria-label={`${localDateLabel(day)}, ${todays.length} eventos${dayTasks.length?`, ${dayTasks.length} tareas`:''}`} aria-pressed={day===selected} onClick={()=>onSelect(day)}>
            <span className="day-number">{Number(day.slice(-2))}</span>
            <span className="calendar-markers" aria-hidden="true">{todays.length>0&&<span className="event-dots">{'●'.repeat(Math.min(3,todays.length))}{overflow}</span>}{dayTasks.length>0&&<span className="task-tick">▪</span>}</span>
            {onBand&&<span aria-hidden="true" className={`range-band ${!bandPrev?'range-start':''} ${!bandNext?'range-end':''}`} />}
          </button>;
        })}
      </div>
    </section>
    <div className="filter-strip" role="group" aria-label="Filtrar eventos">{([['all','Todos'],['personal','Personal'],['expense','Pagos'],['income','Ingresos'],['important','Importantes']] as const).map(([f,label])=><button type="button" key={f} className={`filter-pill ${filter===f?'active':''}`} aria-pressed={filter===f} onClick={()=>onFilter(f)}>{label}</button>)}</div>
    <section className="agenda-section" aria-label="Agenda seleccionada"><div className="section-title-row"><h2>{localDateLabel(selected,{weekday:'long',day:'numeric',month:'long'})}</h2><button type="button" className="text-action" onClick={()=>onAddEvent(selected)}>Añadir evento</button></div>
      {selectedOccurrences.length+selectedTasks.length===0?<p className="empty-state">Nada para este día.</p>:<div className="agenda-list">
        {selectedOccurrences.map(o=><EventRow key={o.key} o={o} states={data.eventOccurrenceStates} today={today} onOpen={onOpenEvent}/>)}
        {selectedTasks.map(t=><div className="task-agenda-row" key={t.id}><label className="inline-check"><input type="checkbox" checked={!!t.completedAt} onChange={()=>onTaskToggle(t)} aria-label={`Completar ${t.title}`}/></label><button type="button" className={`agenda-row ${t.completedAt?'task-done':''}`} onClick={()=>onOpenTask(t)}><span className="agenda-meta">Tarea</span><strong>{t.title}</strong></button></div>)}
      </div>}
    </section>
    {data.countdowns.length>0&&<section className="calendar-countdowns"><div className="section-title-row"><h2>Countdowns</h2><button className="text-action" onClick={onAddCountdown}>Añadir</button></div>
      {data.countdowns.map(c=>{const target=resolveCountdown(c,data.events);return <button className="countdown-list-row" type="button" key={c.id} onClick={()=>onOpenCountdown(c)}><span><strong>{c.title}</strong><small>{target?localDateLabel(target.date,{day:'numeric',month:'short',year:'numeric'}):'Evento no disponible'}</small></span>{c.pinned&&<span className="field-hint">Fijado</span>}</button>;})}
    </section>}
  </div>;
}
export function TasksView({tasks,today,onOpen,onAdd,onToggle}:{tasks:Task[];today:string;onOpen:(t:Task)=>void;onAdd:()=>void;onToggle:(t:Task)=>void}){
  const pending=tasks.filter(t=>!t.completedAt).sort((a,b)=>(a.dueDate??'9999-12-31').localeCompare(b.dueDate??'9999-12-31')||a.createdAt.localeCompare(b.createdAt));
  const done=tasks.filter(t=>t.completedAt).sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??''));
  const sections=[['Vencidas',pending.filter(t=>t.dueDate&&t.dueDate<today)],['Hoy',pending.filter(t=>t.dueDate===today)],['Próximas',pending.filter(t=>t.dueDate&&t.dueDate>today)],['Sin fecha',pending.filter(t=>!t.dueDate)]] as const;
  const rows=(items:Task[])=>items.map(t=><div className="task-row" key={t.id}><label className="task-checkbox"><input type="checkbox" checked={!!t.completedAt} aria-label={`${t.completedAt?'Desmarcar':'Completar'} ${t.title}`} onChange={()=>onToggle(t)}/></label><button type="button" onClick={()=>onOpen(t)} className={`task-row-body ${t.completedAt?'task-done':''}`}><strong>{t.title}</strong>{t.dueDate&&<small>{localDateLabel(t.dueDate,{day:'numeric',month:'short'})}</small>}</button></div>);
  return <div className="view-panel tasks-view"><div className="section-title-row"><h1>Tareas</h1><button className="text-action" onClick={onAdd}>Añadir tarea</button></div>
    {pending.length===0&&<p className="empty-state">Todo al día.</p>}
    {sections.map(([name,items])=>items.length>0&&<section className="task-group" key={name}><h2>{name}</h2>{rows(items)}</section>)}
    {done.length>0&&<details className="task-group done-group"><summary>Completadas ({done.length})</summary>{rows(done)}</details>}
  </div>;
}
export function HomeView({data,today,streakCelebrate,onSavings,onAddEvent,onOpenEvent,onOpenTask,onTaskToggle,onCalendar,onTasks,onCountdown,onAddCountdown}:{
 data:PersonalSnapshot;today:string;streakCelebrate:boolean;onSavings:()=>void;onAddEvent:()=>void;onOpenEvent:(o:Occurrence)=>void;onOpenTask:(t:Task)=>void;onTaskToggle:(t:Task)=>void;onCalendar:()=>void;onTasks:()=>void;onCountdown:(c:Countdown)=>void;onAddCountdown:()=>void;
}){
  const [now,setNow]=useState(()=>new Date());const pinned=data.countdowns.find(c=>c.pinned);
  const target=pinned?resolveCountdown(pinned,data.events):null;
  useEffect(()=>{if(!target?.time)return;
    const tick=()=>{if(document.visibilityState==='visible')setNow(new Date());};
    const id=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);
    return ()=>{clearInterval(id);document.removeEventListener('visibilitychange',tick);};
  },[target?.date,target?.time]);
  const end=addDays(today,6);
  const events=occurrencesForRange(data.events,today,end).filter(o=>!data.eventOccurrenceStates.some(s=>s.occurrenceKey===o.key))
    .filter(o=>o.endDate>=today).filter((o,i,arr)=>arr.findIndex(x=>x.key===o.key)===i);
  const reminders=financialReminders(data.events,data.eventOccurrenceStates,today).filter(o=>o.startDate<today);
  const visible=[...reminders,...events].filter((o,i,arr)=>arr.findIndex(x=>x.key===o.key)===i).sort((a,b)=>a.startDate.localeCompare(b.startDate)||Number(b.event.important)-Number(a.event.important)).slice(0,5);
  const tasks=data.tasks.filter(t=>!t.completedAt).sort((a,b)=>(a.dueDate??'9999-12-31').localeCompare(b.dueDate??'9999-12-31')).slice(0,3);
  return <div className="view-panel home-view">
    <button className="home-savings-hit" type="button" onClick={onSavings} aria-label="Abrir ahorros"><div className="home-savings-top"><span>En mi alcancía</span><span className="home-savings-arrow">↗</span></div><div className="home-balance"><AnimatedMoney value={balance(data.movements)} /></div><div className="home-savings-stats"><span>Aportado este mes <strong>{formatCOP(monthTotals(data.movements,today.slice(0,7)).deposited)}</strong></span><span>Julio de 2029 <strong>{projection(data.movements,data.settings,today)===null?'Sin plan':formatCOP(projection(data.movements,data.settings,today)!)}</strong></span></div></button>
    <StreakIndicator movements={data.movements} today={today} celebrate={streakCelebrate} compact />
    {pinned&&target&&<section className="home-countdown"><div className="section-title-row"><h2>Countdown fijado</h2><button className="text-action" onClick={()=>onCountdown(pinned)}>Editar</button></div><p className="countdown-name">{pinned.title}</p><p className="countdown-time" aria-live="off">{countdownText(target.date,target.time,today,now)}</p><p className="field-hint">{localDateLabel(target.date,{day:'numeric',month:'long',year:'numeric'})}{target.time?` · ${target.time}`:''}</p></section>}
    <section className="home-agenda"><div className="section-title-row"><h2>Próximos</h2><button className="text-action" onClick={onCalendar}>Ver calendario</button></div>
      {visible.length===0?<div className="empty-inline"><p>Sin planes próximos.</p><button className="text-action" onClick={onAddEvent}>Añadir evento</button></div>:visible.map(o=><div key={o.key} className="home-upcoming"><span className="home-upcoming-date">{o.startDate<today?'Vencido':localDateLabel(o.startDate,{day:'numeric',month:'short'})}</span><button className="home-upcoming-info" onClick={()=>onOpenEvent(o)}><strong>{o.event.title}</strong><small>{categoryName(o.event.category)}{o.event.amountCOP?` · ${formatCOP(o.event.amountCOP)}`:''}{o.startDate>today&&o.event.category==='expense'&&[1,3].includes(dayDifference(today,o.startDate))?` · ${dayDifference(today,o.startDate)===1?'Mañana':'En 3 días'}`:''}</small></button></div>)}
    </section>
    <section className="home-tasks"><div className="section-title-row"><h2>Tareas</h2><button className="text-action" onClick={onTasks}>Ver todas</button></div>
      {tasks.length===0?<p className="empty-state">Todo al día.</p>:tasks.map(t=><div className="task-row" key={t.id}><label className="task-checkbox"><input aria-label={`Completar ${t.title}`} type="checkbox" checked={false} onChange={()=>onTaskToggle(t)}/></label><button className="task-row-body" onClick={()=>onOpenTask(t)}><strong>{t.title}</strong>{t.dueDate&&<small>{localDateLabel(t.dueDate,{day:'numeric',month:'short'})}</small>}</button></div>)}
    </section>
    {data.countdowns.length>0&&!pinned&&<button type="button" className="quiet-link" onClick={()=>onCountdown(data.countdowns[0])}>Gestionar countdowns</button>}
    {data.countdowns.length===0&&<button type="button" className="quiet-link" onClick={onAddCountdown}>Crear countdown</button>}
  </div>;
}
export type {Filter};
