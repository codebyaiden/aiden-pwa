import { useMemo, useRef, useState, type FormEvent } from 'react';
import { formatCOP } from '../savings/calculations';
import { parseMoneyInput } from '../savings/validation';
import { addDays, financialReminders, localDateLabel, occurrencesForRange, dueMessage } from '../personal/dates';
import { financeHistory, financeTotals, FINANCE_CATEGORIES } from '../personal/finance';
import { validFinanceEntry } from '../personal/validation';
import type { FinanceEntry, FinanceKind, Occurrence, PersonalSnapshot } from '../personal/types';
import { Modal } from './Shared';

const labelKind = (kind:FinanceKind) => kind==='expense'?'Gasto':'Ingreso';
export function FinanceView({data,today,onAdd,onEdit,onOpenOccurrence}:{
  data:PersonalSnapshot;today:string;onAdd:(kind:FinanceKind)=>void;onEdit:(entry:FinanceEntry)=>void;onOpenOccurrence:(occurrence:Occurrence)=>void;
}){
  const [month,setMonth]=useState(today.slice(0,7));
  const {spent,received,net}=useMemo(()=>financeTotals(data.financeEntries,month),[data.financeEntries,month]);
  const entries=useMemo(()=>financeHistory(data.financeEntries,month),[data.financeEntries,month]);
  const reminders=financialReminders(data.events,data.eventOccurrenceStates,today)
    .filter(o=>o.event.category==='expense' && !data.financeEntries.some(e=>e.occurrenceKey===o.key))
    .slice(0,5);
  return <div className="finance-view">
    <div className="money-figures"><div><span>Gastado</span><strong>{formatCOP(spent)}</strong></div><div><span>Recibido</span><strong>{formatCOP(received)}</strong></div></div>
    <p className="finance-net">Diferencia del mes: <strong>{net<0?'−':'+'}{formatCOP(Math.abs(net))}</strong></p>
    <p className="field-hint">Solo registros confirmados. No es tu saldo bancario ni el dinero de la alcancía.</p>
    <div className="finance-actions"><button className="button-primary" type="button" onClick={()=>onAdd('expense')}>+ Registrar gasto</button><button className="button-secondary" type="button" onClick={()=>onAdd('income')}>Registrar ingreso</button></div>
    {reminders.length>0&&<section className="finance-section"><div className="section-title-row"><h2>Pagos pendientes</h2><span className="field-hint">Calendario</span></div>
      {reminders.map(o=><button type="button" className="finance-row" key={o.key} onClick={()=>onOpenOccurrence(o)}>
        <span className="finance-row-main"><strong>{o.event.title}</strong><small>{dueMessage(o.startDate,today)} · {localDateLabel(o.startDate,{day:'numeric',month:'short'})}</small></span>
        {o.event.amountCOP!==undefined&&<span className="finance-row-value">{formatCOP(o.event.amountCOP)} <small>previsto</small></span>}
      </button>)}
    </section>}
    <section className="finance-section"><div className="section-title-row"><h2>Movimientos reales</h2><label className="month-picker-label">Mes<input aria-label="Mes del historial financiero" type="month" className="finance-month" value={month} onChange={e=>setMonth(e.target.value)} /></label></div>
      {entries.length===0?<p className="empty-state compact-empty">Sin gastos ni ingresos registrados en este mes.</p>:
        entries.map(entry=><button className="finance-row" type="button" key={entry.id} onClick={()=>onEdit(entry)}>
          <span className="finance-row-main"><strong>{entry.title}</strong><small>{localDateLabel(entry.localDate,{day:'numeric',month:'short'})} · {labelKind(entry.kind)}{entry.occurrenceKey?' · Vinculado':''}</small></span>
          <span className="finance-row-value">{entry.kind==='expense'?'−':'+'} {formatCOP(entry.amountCOP)}</span>
        </button>)}
    </section>
    <section className="finance-section finance-recurring"><div className="section-title-row"><h2>Pagos e ingresos habituales</h2></div>
      <p className="field-hint">Configúralos en Calendario como eventos recurrentes. La cantidad prevista nunca se descuenta automáticamente.</p>
    </section>
  </div>;
}
export function FinanceDialog({data,today,entry,occurrence,kind:initialKind,onClose,onSave,onDelete}:{
  data:PersonalSnapshot;today:string;entry?:FinanceEntry;occurrence?:Occurrence;kind:FinanceKind;
  onClose:()=>void;onSave:(entry:FinanceEntry,mode:'add'|'edit')=>Promise<void>;onDelete:(entry:FinanceEntry)=>Promise<void>;
}){
  const id=useRef(entry?.id??crypto.randomUUID());
  const created=useRef(entry?.createdAt??new Date().toISOString());
  const [kind,setKind]=useState<FinanceKind>(entry?.kind??occurrence?.event.category as FinanceKind??initialKind);
  const [title,setTitle]=useState(entry?.title??occurrence?.event.title??'');
  const [amount,setAmount]=useState(String(entry?.amountCOP??occurrence?.event.amountCOP??''));
  const [date,setDate]=useState(entry?.localDate??today);
  const [category,setCategory]=useState<FinanceEntry['category']>(entry?.category??(occurrence?'servicios':'general'));
  const [note,setNote]=useState(entry?.note??'');
  const [link,setLink]=useState(entry?.occurrenceKey??occurrence?.key??'');
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const locked=useRef(false);
  const options=useMemo(()=>occurrencesForRange(data.events.filter(e=>e.category===kind&&e.recurrence!=='none'),addDays(date,-31),addDays(date,7))
    .filter(o=>!data.financeEntries.some(x=>x.occurrenceKey===o.key&&x.id!==entry?.id))
    .slice(0,100),[data.events,data.financeEntries,kind,date,entry?.id]);
  const parsed=parseMoneyInput(amount);
  const next:FinanceEntry={id:id.current,kind,title:title.trim(),amountCOP:parsed??0,localDate:date,category,
    createdAt:created.current,updatedAt:new Date().toISOString(),...(note.trim()?{note:note.trim()}:{}),...(link?{occurrenceKey:link}:{})};
  const mark=()=>{setDirty(true);setError('');};
  async function submit(e:FormEvent){
    e.preventDefault();if(locked.current)return;
    if(!validFinanceEntry(next)||date>today){setError('Revisa el importe, el concepto y la fecha. No puedes registrar dinero futuro como realizado.');return;}
    locked.current=true;setBusy(true);setError('');
    try{await onSave(next,entry?'edit':'add');}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar. Inténtalo de nuevo.');}finally{locked.current=false;setBusy(false);}
  }
  async function remove(){
    if(!entry||locked.current||!window.confirm('¿Eliminar este registro real? Si está vinculado, su vencimiento volverá a pendiente.'))return;
    locked.current=true;setBusy(true);setError('');
    try{await onDelete(entry);}catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar.');}finally{locked.current=false;setBusy(false);}
  }
  return <Modal title={entry?'Editar movimiento real':kind==='expense'?'Registrar gasto':'Registrar ingreso'} dirty={dirty} busy={busy} onClose={onClose}>
    <form className="form-stack" onSubmit={e=>void submit(e)}>
      {!entry&&!occurrence&&<div className="field"><label htmlFor="finance-kind">Tipo</label><select className="text-field" id="finance-kind" value={kind} onChange={e=>{setKind(e.target.value as FinanceKind);setLink('');mark();}}><option value="expense">Gasto realizado</option><option value="income">Ingreso recibido</option></select></div>}
      <div className="field"><label htmlFor="finance-title">Concepto</label><input id="finance-title" className="text-field" maxLength={120} value={title} onChange={e=>{setTitle(e.target.value);mark();}} required /></div>
      <div className="form-pair"><div className="field"><label htmlFor="finance-amount">Cantidad (COP)</label><input id="finance-amount" className="text-field" inputMode="numeric" value={amount} onChange={e=>{setAmount(e.target.value);mark();}} required /></div><div className="field"><label htmlFor="finance-date">Fecha real</label><input id="finance-date" type="date" className="text-field" max={today} value={date} onChange={e=>{setDate(e.target.value);if(link&&!occurrence)setLink('');mark();}} required /></div></div>
      <div className="field"><label htmlFor="finance-category">Categoría</label><select id="finance-category" className="text-field" value={category} onChange={e=>{setCategory(e.target.value as FinanceEntry['category']);mark();}}>{FINANCE_CATEGORIES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
      {entry?.occurrenceKey&&<p className="field-hint">Vinculado al vencimiento del calendario. Para cambiarlo, elimina y registra otro movimiento.</p>}
      {!entry&&!occurrence&&options.length>0&&<div className="field"><label htmlFor="finance-link">Relacionar con vencimiento (opcional)</label><select id="finance-link" className="text-field" value={link} onChange={e=>{const key=e.target.value;setLink(key);const o=options.find(o=>o.key===key);if(o){setTitle(o.event.title);if(o.event.amountCOP)setAmount(String(o.event.amountCOP));}mark();}}><option value="">Sin vínculo</option>{options.map(o=><option key={o.key} value={o.key}>{o.event.title} · {localDateLabel(o.startDate,{day:'numeric',month:'short'})}</option>)}</select></div>}
      {occurrence&&<p className="field-hint">El importe es real y puede ser distinto al previsto. Confirmarlo marcará este vencimiento como {kind==='expense'?'pagado':'recibido'}.</p>}
      <details><summary>Nota (opcional)</summary><textarea className="text-field" rows={2} maxLength={500} value={note} onChange={e=>{setNote(e.target.value);mark();}}/></details>
      {error&&<p className="field-error" role="alert">{error}</p>}
      <button className="button-primary" type="submit" disabled={busy||!validFinanceEntry(next)||date>today}>{busy?'Guardando…':entry?'Guardar cambios':kind==='expense'?'Guardar gasto real':'Guardar ingreso real'}</button>
      {entry&&<button className="button-danger-outline" type="button" disabled={busy} onClick={()=>void remove()}>Eliminar registro</button>}
    </form>
  </Modal>;
}
