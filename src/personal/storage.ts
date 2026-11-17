import { bogotaToday } from '../savings/calculations';
import { loadSnapshot, request, transaction } from '../savings/storage';
import { validateLedger, validateSettings } from '../savings/validation';
import { occurrencesForRange } from './dates';
import { validateFinanceEntries, validatePersonalCollections, validCountdown, validEvent, validFinanceEntry, validState, validTask } from './validation';
import type { BackupV4, CalendarEvent, Countdown, EventOccurrenceState, PersonalSnapshot, Task, FinanceEntry } from './types';

const stores = ['movements','settings','events','eventOccurrenceStates','tasks','countdowns','financeEntries'];
export async function loadPersonalSnapshot():Promise<PersonalSnapshot>{
  // Read every collection in one readonly transaction so the backup/dashboard is coherent.
  return transaction('readonly',stores,async tx=>{
    const [movements,settings,events,eventOccurrenceStates,tasks,countdowns,financeEntries] = await Promise.all([
      request<PersonalSnapshot['movements']>(tx.objectStore('movements').getAll()),
      request<PersonalSnapshot['settings']|undefined>(tx.objectStore('settings').get('current')),
      request<CalendarEvent[]>(tx.objectStore('events').getAll()),
      request<EventOccurrenceState[]>(tx.objectStore('eventOccurrenceStates').getAll()),
      request<Task[]>(tx.objectStore('tasks').getAll()),
      request<Countdown[]>(tx.objectStore('countdowns').getAll()),
      request<FinanceEntry[]>(tx.objectStore('financeEntries').getAll())
    ]);
    validateLedger(movements,bogotaToday());
    // Existing settings may be absent on a fresh install; preserve the exact v2 defaults.
    const savings = settings ? settings : (awaitSettingsDefault());
    if(!validateSettings(savings))throw new Error('La configuración guardada no es válida.');
    const personal={movements,settings:savings,events,eventOccurrenceStates,tasks,countdowns,financeEntries};
    validatePersonalCollections(personal);
    validateFinanceEntries(financeEntries,bogotaToday());
    return personal;
  });
}
function awaitSettingsDefault(){return {monthlyPlanCOP:null,finalGoalCOP:null,targetEndMonth:'2029-07',schemaVersion:2} as const;}
export async function saveEvent(next:CalendarEvent,mode:'add'|'edit'){
  if(!validEvent(next))throw new Error('Revisa los datos del evento.');
  await transaction('readwrite',['events','eventOccurrenceStates','countdowns','financeEntries'],async tx=>{
    const es=tx.objectStore('events'),ss=tx.objectStore('eventOccurrenceStates');
    const old=await request<CalendarEvent|undefined>(es.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('Este evento ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('Este evento cambió. Vuelve a abrirlo.');
    const structural=old&&(old.startDate!==next.startDate||old.endDate!==next.endDate||old.recurrence!==next.recurrence||old.recurrenceUntil!==next.recurrenceUntil||old.category!==next.category);
    if(structural){
      const states=await request<EventOccurrenceState[]>(ss.getAll());
      for(const s of states)if(s.eventId===next.id)ss.delete(s.occurrenceKey);
      const fs=tx.objectStore('financeEntries');
      const entries=await request<FinanceEntry[]>(fs.getAll());
      for(const entry of entries)if(entry.occurrenceKey?.startsWith(next.id+'@')){
        const {occurrenceKey:_link,...rest}=entry;void _link;
        fs.put({...rest,updatedAt:new Date().toISOString()});
      }
    }
    if(old?.category==='personal'&&next.category!=='personal'){
      const cs=tx.objectStore('countdowns');const linked=await request<Countdown[]>(cs.getAll());
      for(const c of linked)if(c.sourceEventId===next.id){
        const {sourceEventId:_linked,...manual}=c;void _linked;
        cs.put({...manual,targetDate:old.startDate,...(old.startTime?{targetTime:old.startTime}:{}),updatedAt:new Date().toISOString()});
      }
    }
    if(mode==='add')es.add(next);else es.put(next);
  });
}
export async function removeEvent(id:string){
  await transaction('readwrite',['events','eventOccurrenceStates','countdowns','financeEntries'],async tx=>{
    const es=tx.objectStore('events'),ss=tx.objectStore('eventOccurrenceStates'),cs=tx.objectStore('countdowns');
    const removed=await request<CalendarEvent|undefined>(es.get(id));
    if(!removed)throw new Error('El evento ya no existe.');
    const states=await request<EventOccurrenceState[]>(ss.getAll());
    const countdowns=await request<Countdown[]>(cs.getAll());
    const fs=tx.objectStore('financeEntries');
    const entries=await request<FinanceEntry[]>(fs.getAll());
    for(const entry of entries)if(entry.occurrenceKey?.startsWith(id+'@')){
      const {occurrenceKey:_link,...rest}=entry;void _link;
      fs.put({...rest,updatedAt:new Date().toISOString()});
    }
    for(const s of states)if(s.eventId===id)ss.delete(s.occurrenceKey);
    // Preserve each countdown as a manual date instead of silently deleting it.
    for(const c of countdowns)if(c.sourceEventId===id){
      const {sourceEventId:_linked,...manual}=c;
      void _linked;
      cs.put({...manual,targetDate:removed.startDate,...(removed.startTime?{targetTime:removed.startTime}:{}),updatedAt:new Date().toISOString()});
    }
    es.delete(id);
  });
}
export async function saveOccurrenceState(next:EventOccurrenceState|null,eventId:string,startDate:string){
  if(next&&!validState(next))throw new Error('El estado del pago no es válido.');
  await transaction('readwrite',['events','eventOccurrenceStates','financeEntries'],async tx=>{
    const event=await request<CalendarEvent|undefined>(tx.objectStore('events').get(eventId));
    if(!event||event.category==='personal')throw new Error('El evento financiero ya no existe.');
    if(!occurrencesForRange([event],startDate,startDate).some(o=>o.startDate===startDate))throw new Error('Esta ocurrencia ya no existe.');
    if(next&&(next.eventId!==eventId||next.occurrenceStartDate!==startDate||(next.status==='paid'&&event.category!=='expense')||(next.status==='received'&&event.category!=='income')))throw new Error('Estado no compatible con este evento.');
    if(!next||next.status==='skipped'){
      const linked=await request<FinanceEntry|undefined>(tx.objectStore('financeEntries').index('byOccurrence').get(`${eventId}@${startDate}`));
      if(linked)throw new Error('Este vencimiento tiene un registro real. Elimínalo en Dinero para volverlo a pendiente.');
    }
    if(next)tx.objectStore('eventOccurrenceStates').put(next);
    else tx.objectStore('eventOccurrenceStates').delete(`${eventId}@${startDate}`);
  });
}
export async function saveTask(next:Task,mode:'add'|'edit'){
  if(!validTask(next))throw new Error('Revisa los datos de la tarea.');
  await transaction('readwrite',['tasks'],async tx=>{
    const store=tx.objectStore('tasks');const old=await request<Task|undefined>(store.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('La tarea ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('La tarea ya no existe.');
    if(mode==='add')store.add(next);else store.put(next);
  });
}
export async function removeTask(id:string){
  await transaction('readwrite',['tasks'],async tx=>{
    const store=tx.objectStore('tasks');if(!await request(store.get(id)))throw new Error('La tarea ya no existe.');store.delete(id);
  });
}
export async function saveCountdown(next:Countdown,mode:'add'|'edit'){
  if(!validCountdown(next))throw new Error('Revisa los datos del countdown.');
  await transaction('readwrite',['countdowns','events'],async tx=>{
    const store=tx.objectStore('countdowns');const old=await request<Countdown|undefined>(store.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('El countdown ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt))throw new Error('El countdown ya no existe.');
    if(next.sourceEventId){const event=await request<CalendarEvent|undefined>(tx.objectStore('events').get(next.sourceEventId));if(!event||event.category!=='personal')throw new Error('Selecciona un evento personal existente.');}
    if(next.pinned){const all=await request<Countdown[]>(store.getAll());for(const c of all)if(c.pinned&&c.id!==next.id)store.put({...c,pinned:false,updatedAt:new Date().toISOString()});}
    if(mode==='add')store.add(next);else store.put(next);
  });
}
export async function removeCountdown(id:string){
  await transaction('readwrite',['countdowns'],async tx=>{
    const store=tx.objectStore('countdowns');if(!await request(store.get(id)))throw new Error('El countdown ya no existe.');store.delete(id);
  });
}
export async function saveFinanceEntry(next:FinanceEntry,mode:'add'|'edit'){
  if(!validFinanceEntry(next)||next.localDate>bogotaToday())throw new Error('Revisa los datos del movimiento real.');
  await transaction('readwrite',['financeEntries','events','eventOccurrenceStates'],async tx=>{
    const store=tx.objectStore('financeEntries');
    const old=await request<FinanceEntry|undefined>(store.get(next.id));
    if(mode==='add'&&old){if(JSON.stringify(old)===JSON.stringify(next))return;throw new Error('Este registro ya existe.');}
    if(mode==='edit'&&(!old||old.createdAt!==next.createdAt||old.kind!==next.kind))throw new Error('Este registro cambió. Vuelve a abrirlo.');
    if(old?.occurrenceKey!==undefined&&old.occurrenceKey!==next.occurrenceKey)throw new Error('No se puede modificar el vínculo. Borra el registro y vuelve a crearlo.');
    if(next.occurrenceKey){
      const [eventId,start]=next.occurrenceKey.split('@');
      const event=await request<CalendarEvent|undefined>(tx.objectStore('events').get(eventId));
      if(!event||event.category!==next.kind||!occurrencesForRange([event],start,start).some(o=>o.startDate===start))
        throw new Error('El vencimiento seleccionado ya no existe.');
      const existing=await request<FinanceEntry|undefined>(store.index('byOccurrence').get(next.occurrenceKey));
      if(existing&&existing.id!==next.id)throw new Error('Este vencimiento ya tiene un registro real. Edítalo desde Dinero.');
      tx.objectStore('eventOccurrenceStates').put({occurrenceKey:next.occurrenceKey,eventId,occurrenceStartDate:start,
        status:next.kind==='expense'?'paid':'received',changedAt:new Date().toISOString()} satisfies EventOccurrenceState);
    }
    if(mode==='add')store.add(next);else store.put(next);
  });
}
export async function removeFinanceEntry(id:string){
  await transaction('readwrite',['financeEntries','eventOccurrenceStates'],async tx=>{
    const store=tx.objectStore('financeEntries');
    const old=await request<FinanceEntry|undefined>(store.get(id));
    if(!old)throw new Error('El registro ya no existe.');
    if(old.occurrenceKey)tx.objectStore('eventOccurrenceStates').delete(old.occurrenceKey);
    store.delete(id);
  });
}
export async function restoreFullBackup(backup:BackupV4,preserveFinance=false){
  validateLedger(backup.movements,bogotaToday());
  if(!validateSettings(backup.settings))throw new Error('La configuración del respaldo no es válida.');
  validatePersonalCollections(backup);
  validateFinanceEntries(backup.financeEntries,bogotaToday());
  await transaction('readwrite',stores,async tx=>{
    // A v3 backup predates real finance. Preserve existing entries, unlinking them
    // because restored calendar rules may differ from the current ones.
    let retained:FinanceEntry[]=[];
    if(preserveFinance){
      retained=await request<FinanceEntry[]>(tx.objectStore('financeEntries').getAll());
      retained=retained.map(entry=>{
        if(!entry.occurrenceKey)return entry;
        const {occurrenceKey:_link,...rest}=entry;void _link;
        return {...rest,updatedAt:new Date().toISOString()};
      });
      validateFinanceEntries(retained,bogotaToday());
    }
    for(const name of stores)tx.objectStore(name).clear();
    for(const m of backup.movements)tx.objectStore('movements').add(m);
    tx.objectStore('settings').put(backup.settings,'current');
    for(const e of backup.events)tx.objectStore('events').add(e);
    for(const s of backup.eventOccurrenceStates)tx.objectStore('eventOccurrenceStates').add(s);
    for(const t of backup.tasks)tx.objectStore('tasks').add(t);
    for(const c of backup.countdowns)tx.objectStore('countdowns').add(c);
    for(const entry of preserveFinance?retained:backup.financeEntries)tx.objectStore('financeEntries').add(entry);
  });
}
// Keep the v1.1 storage functions directly usable without touching personal stores.
export {loadSnapshot};
