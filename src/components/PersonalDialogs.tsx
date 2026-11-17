import { useRef, useState, type FormEvent } from 'react';
import { bogotaToday,formatCOP } from '../savings/calculations';
import { parseMoneyInput } from '../savings/validation';
import { localDateLabel } from '../personal/dates';
import { validCountdown,validEvent,validTask } from '../personal/validation';
import type { CalendarEvent,Countdown,EventOccurrenceState,Occurrence,Task } from '../personal/types';
import { Modal } from './Shared';

const errorText=(e:unknown)=>e instanceof Error?e.message:'No se pudo guardar. Inténtalo otra vez.';
const nowISO=()=>new Date().toISOString();
export function QuickAdd({onClose,onChoose}:{onClose:()=>void;onChoose:(which:'money'|'event'|'task'|'countdown')=>void}){
  return <Modal title="Añadir" onClose={onClose}><div className="quick-menu">
    {([['money','Añadir dinero','Aporte a la alcancía'],['event','Evento','Cita, pago o ingreso'],['task','Tarea','Algo por hacer'],['countdown','Countdown','Una fecha importante']] as const).map(([key,label,detail])=><button type="button" key={key} onClick={()=>onChoose(key)} className="quick-menu-item"><span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">＋</span></button>)}
  </div></Modal>;
}
export function EventDialog({event,occurrence,initialDate,onSave,onDelete,onState,onClose,currentState}: {
 event?:CalendarEvent;occurrence?:Occurrence;initialDate:string;currentState?:EventOccurrenceState;
 onSave:(e:CalendarEvent,mode:'add'|'edit')=>Promise<void>;onDelete:(e:CalendarEvent)=>Promise<void>;
 onState:(e:EventOccurrenceState|null,eventId:string,startDate:string)=>Promise<void>;onClose:()=>void;
}){
  const stableId=useRef(event?.id??crypto.randomUUID());const createdAt=useRef(event?.createdAt??nowISO());
  const [title,setTitle]=useState(event?.title??'');const [category,setCategory]=useState<CalendarEvent['category']>(event?.category??'personal');
  const [start,setStart]=useState(event?.startDate??initialDate);const [end,setEnd]=useState(event?.endDate??initialDate);
  const [startTime,setStartTime]=useState(event?.startTime??'');const [endTime,setEndTime]=useState(event?.endTime??'');
  const [amount,setAmount]=useState(event?.amountCOP?.toString()??'');const [notes,setNotes]=useState(event?.notes??'');
  const [important,setImportant]=useState(event?.important??false);const [recurrence,setRecurrence]=useState<CalendarEvent['recurrence']>(event?.recurrence??'none');
  const [until,setUntil]=useState(event?.recurrenceUntil??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [editing,setEditing]=useState(!event);const [dirty,setDirty]=useState(false);
  const change=()=>{setDirty(true);setError('');};
  const money=amount.trim()?parseMoneyInput(amount):undefined;
  const next:CalendarEvent={id:stableId.current,createdAt:createdAt.current,updatedAt:nowISO(),title:title.trim(),category,startDate:start,endDate:end,important,recurrence,
    ...(startTime?{startTime}:{}),...(endTime?{endTime}:{}),...(category!=='personal'&&money?{amountCOP:money}:{}),...(notes.trim()?{notes:notes.trim()}:{}),...(recurrence!=='none'&&until?{recurrenceUntil:until}:{})};
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;
    if(category!=='personal'&&amount.trim()&&!money){setError('El importe debe ser COP entero positivo, máximo $999.999.999.');return;}
    if(!validEvent(next)){setError('Comprueba título, fechas, horas y recurrencia.');return;}
    const structural=event&&(event.startDate!==next.startDate||event.endDate!==next.endDate||event.recurrence!==next.recurrence||event.recurrenceUntil!==next.recurrenceUntil||event.category!==next.category);
    if(structural&&!window.confirm('Cambiar la serie eliminará las confirmaciones de pagos/ingresos de sus ocurrencias. ¿Continuar?'))return;
    setBusy(true);setError('');try{await onSave(next,event?'edit':'add');}catch(err){setError(errorText(err));}finally{setBusy(false);}
  }
  async function remove(){if(!event||busy)return;
    if(!window.confirm('¿Eliminar la serie completa? Se borrarán sus estados confirmados y los countdowns vinculados. No se puede deshacer.'))return;
    setBusy(true);setError('');try{await onDelete(event);}catch(err){setError(errorText(err));}finally{setBusy(false);}
  }
  async function mark(status:'paid'|'received'|'skipped'|null){if(!event||!occurrence||busy)return;
    setBusy(true);setError('');try{await onState(status?{eventId:event.id,occurrenceStartDate:occurrence.startDate,occurrenceKey:occurrence.key,status,changedAt:nowISO()}:null,event.id,occurrence.startDate);}catch(err){setError(errorText(err));}finally{setBusy(false);}
  }
  return <Modal title={event?(editing?'Editar serie':'Evento'):'Añadir evento'} dirty={dirty&&editing} busy={busy} onClose={onClose} wide>
    {event&&!editing?<div className="form-stack">
      <h3 className="detail-modal-title">{event.title}</h3><p className="field-hint">{localDateLabel(occurrence?.startDate??event.startDate)}{(occurrence?.endDate??event.endDate)!==(occurrence?.startDate??event.startDate)?` a ${localDateLabel(occurrence?.endDate??event.endDate)}`:''}{event.startTime?` · ${event.startTime}`:''}</p>
      <p>{event.category==='expense'?'Pago':event.category==='income'?'Ingreso':'Personal'}{event.amountCOP?` · ${formatCOP(event.amountCOP)}`:''}{event.recurrence!=='none'?` · Serie ${event.recurrence==='weekly'?'semanal':event.recurrence==='monthly'?'mensual':'anual'}`:''}</p>
      {event.notes&&<p className="field-hint">{event.notes}</p>}
      {event.category!=='personal'&&occurrence&&<div className="status-actions"><p className="field-hint">{currentState?`Estado: ${currentState.status==='paid'?'Pagado':currentState.status==='received'?'Recibido':'Omitido'}`:event.category==='expense'?'Pago pendiente':'Por recibir'}</p>
        <button className="button-primary" type="button" disabled={busy||currentState?.status===(event.category==='expense'?'paid':'received')} onClick={()=>void mark(event.category==='expense'?'paid':'received')}>{event.category==='expense'?'Marcar pagado':'Marcar recibido'}</button>
        {currentState&&<button className="button-secondary" type="button" disabled={busy} onClick={()=>void mark(null)}>Volver a pendiente</button>}
        {!currentState&&<button className="text-action" type="button" disabled={busy} onClick={()=>void mark('skipped')}>Omitir esta ocurrencia</button>}
      </div>}
      <button type="button" className="button-secondary" onClick={()=>setEditing(true)}>Editar serie</button>
      <button type="button" className="button-danger-outline" onClick={()=>void remove()} disabled={busy}>Eliminar serie</button>
      {error&&<p role="alert" className="field-error">{error}</p>}
    </div>:<form className="form-stack" onSubmit={e=>void submit(e)}>
      <div className="field"><label htmlFor="event-title">Título</label><input className="text-field" id="event-title" maxLength={100} required value={title} onChange={e=>{setTitle(e.target.value);change();}}/></div>
      <div className="field"><label htmlFor="event-category">Tipo</label><select id="event-category" className="text-field" value={category} onChange={e=>{setCategory(e.target.value as CalendarEvent['category']);change();}}><option value="personal">Personal</option><option value="expense">Pago</option><option value="income">Ingreso</option></select></div>
      <div className="form-pair"><div className="field"><label htmlFor="event-start">Desde</label><input className="text-field" type="date" id="event-start" min="1900-01-01" max="9999-12-31" required value={start} onChange={e=>{setStart(e.target.value);change();}}/></div><div className="field"><label htmlFor="event-end">Hasta (incl.)</label><input className="text-field" type="date" id="event-end" min={start} required value={end} onChange={e=>{setEnd(e.target.value);change();}}/></div></div>
      <div className="form-pair"><div className="field"><label htmlFor="event-time">Hora (opcional)</label><input className="text-field" type="time" id="event-time" value={startTime} onChange={e=>{setStartTime(e.target.value);change();}}/></div><div className="field"><label htmlFor="event-endtime">Fin (opcional)</label><input className="text-field" type="time" id="event-endtime" value={endTime} onChange={e=>{setEndTime(e.target.value);change();}}/></div></div>
      {category!=='personal'&&<div className="field"><label htmlFor="event-amount">Importe COP (opcional)</label><input className="text-field" id="event-amount" inputMode="numeric" value={amount} placeholder="20000" onChange={e=>{setAmount(e.target.value);change();}}/></div>}
      <div className="field"><label htmlFor="event-repeat">Repetir</label><select className="text-field" id="event-repeat" value={recurrence} onChange={e=>{setRecurrence(e.target.value as CalendarEvent['recurrence']);change();}}><option value="none">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select></div>
      {recurrence!=='none'&&<div className="field"><label htmlFor="event-until">Repetir hasta (opcional)</label><input type="date" id="event-until" className="text-field" min={start} value={until} onChange={e=>{setUntil(e.target.value);change();}}/><p className="field-hint">En meses cortos, el día 31 pasa al último día. El 29 de febrero pasa al 28.</p></div>}
      <label className="inline-check"><input type="checkbox" checked={important} onChange={e=>{setImportant(e.target.checked);change();}}/> Importante</label>
      <details><summary>Nota (opcional)</summary><textarea className="text-field" maxLength={500} rows={3} value={notes} onChange={e=>{setNotes(e.target.value);change();}}/></details>
      {error&&<p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="button-primary" disabled={busy||!validEvent(next)||(category!=='personal'&&!!amount.trim()&&!money)}>{busy?'Guardando…':event?'Guardar serie':'Guardar evento'}</button>
      {event&&<button type="button" className="text-action" onClick={()=>{setEditing(false);setDirty(false);}} disabled={busy}>Volver al detalle</button>}
    </form>}
  </Modal>;
}
export function TaskDialog({task,initialDate,onSave,onDelete,onClose}:{task?:Task;initialDate?:string;onSave:(t:Task,mode:'add'|'edit')=>Promise<void>;onDelete:(t:Task)=>Promise<void>;onClose:()=>void}){
  const id=useRef(task?.id??crypto.randomUUID()),created=useRef(task?.createdAt??nowISO());
  const [title,setTitle]=useState(task?.title??'');const [due,setDue]=useState(task?.dueDate??initialDate??'');
  const [note,setNote]=useState(task?.note??'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [dirty,setDirty]=useState(false);
  const next:Task={id:id.current,title:title.trim(),createdAt:created.current,updatedAt:nowISO(),...(due?{dueDate:due}:{}),...(note.trim()?{note:note.trim()}:{}),...(task?.completedAt?{completedAt:task.completedAt}:{})};
  async function submit(e:FormEvent){e.preventDefault();if(busy||!validTask(next))return;setBusy(true);setError('');try{await onSave(next,task?'edit':'add');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  async function remove(){if(!task||busy||!window.confirm('¿Eliminar esta tarea?'))return;setBusy(true);try{await onDelete(task);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <Modal title={task?'Editar tarea':'Añadir tarea'} dirty={dirty} busy={busy} onClose={onClose}><form className="form-stack" onSubmit={e=>void submit(e)}>
    <div className="field"><label htmlFor="task-title">Título</label><input className="text-field" id="task-title" required maxLength={100} value={title} onChange={e=>{setTitle(e.target.value);setDirty(true);}}/></div>
    <div className="field"><label htmlFor="task-date">Fecha (opcional)</label><input className="text-field" type="date" id="task-date" value={due} onChange={e=>{setDue(e.target.value);setDirty(true);}}/></div>
    <div className="field"><label htmlFor="task-note">Nota (opcional)</label><textarea id="task-note" className="text-field" maxLength={500} rows={3} value={note} onChange={e=>{setNote(e.target.value);setDirty(true);}}/></div>
    {error&&<p className="field-error" role="alert">{error}</p>}
    <button className="button-primary" type="submit" disabled={busy||!validTask(next)}>{busy?'Guardando…':task?'Guardar tarea':'Añadir tarea'}</button>
    {task&&<button className="button-danger-outline" type="button" disabled={busy} onClick={()=>void remove()}>Eliminar tarea</button>}
  </form></Modal>;
}
export function CountdownDialog({countdown,events,onSave,onDelete,onClose}:{countdown?:Countdown;events:CalendarEvent[];onSave:(c:Countdown,mode:'add'|'edit')=>Promise<void>;onDelete:(c:Countdown)=>Promise<void>;onClose:()=>void}){
  const id=useRef(countdown?.id??crypto.randomUUID()),created=useRef(countdown?.createdAt??nowISO());
  const [title,setTitle]=useState(countdown?.title??'');const [date,setDate]=useState(countdown?.targetDate??bogotaToday());const [time,setTime]=useState(countdown?.targetTime??'');
  const [source,setSource]=useState(countdown?.sourceEventId??'');const [pinned,setPinned]=useState(countdown?.pinned??false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [dirty,setDirty]=useState(false);
  const next:Countdown={id:id.current,title:title.trim(),pinned,createdAt:created.current,updatedAt:nowISO(),...(source?{sourceEventId:source}:{targetDate:date,...(time?{targetTime:time}:{})})};
  async function submit(e:FormEvent){e.preventDefault();if(!validCountdown(next)||busy)return;setBusy(true);setError('');try{await onSave(next,countdown?'edit':'add');}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  async function remove(){if(!countdown||busy||!window.confirm('¿Eliminar este countdown?'))return;setBusy(true);try{await onDelete(countdown);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <Modal title={countdown?'Editar countdown':'Añadir countdown'} dirty={dirty} busy={busy} onClose={onClose}><form className="form-stack" onSubmit={e=>void submit(e)}>
    <div className="field"><label htmlFor="count-title">Título</label><input className="text-field" id="count-title" maxLength={100} required value={title} onChange={e=>{setTitle(e.target.value);setDirty(true);}}/></div>
    {events.some(e=>e.category==='personal')&&<div className="field"><label htmlFor="count-source">Vincular a un evento (opcional)</label><select className="text-field" id="count-source" value={source} onChange={e=>{setSource(e.target.value);setDirty(true);}}><option value="">Fecha manual</option>{events.filter(e=>e.category==='personal').map(e=><option key={e.id} value={e.id}>{e.title} · {e.startDate}</option>)}</select></div>}
    {!source&&<><div className="field"><label htmlFor="count-date">Fecha</label><input id="count-date" className="text-field" type="date" required value={date} onChange={e=>{setDate(e.target.value);setDirty(true);}}/></div><div className="field"><label htmlFor="count-time">Hora (opcional)</label><input id="count-time" className="text-field" type="time" value={time} onChange={e=>{setTime(e.target.value);setDirty(true);}}/></div></>}
    <label className="inline-check"><input type="checkbox" checked={pinned} onChange={e=>{setPinned(e.target.checked);setDirty(true);}}/> Fijar en Inicio (solo uno)</label>
    {error&&<p className="field-error" role="alert">{error}</p>}<button className="button-primary" disabled={busy||!validCountdown(next)}>{busy?'Guardando…':'Guardar countdown'}</button>
    {countdown&&<button className="button-danger-outline" type="button" disabled={busy} onClick={()=>void remove()}>Eliminar countdown</button>}
  </form></Modal>;
}
