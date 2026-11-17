import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { balance } from '../savings/calculations';
import { loadPersonalSnapshot, saveEvent, saveFinanceEntry, removeFinanceEntry, removeEvent, restoreFullBackup } from './storage';
import { saveMovement } from '../savings/storage';
import { createPersonalBackup, parsePersonalBackup } from './backup';
import { financeHistory, financeTotals } from './finance';
import type { CalendarEvent, FinanceEntry } from './types';

const stamp='2026-11-17T12:00:00.000Z';
const makeEntry=(patch:Partial<FinanceEntry>={}):FinanceEntry=>({
  id:crypto.randomUUID(),kind:'expense',title:'Prueba de compra',amountCOP:20000,
  localDate:'2026-11-17',category:'general',createdAt:stamp,updatedAt:stamp,...patch
});
const makeEvent=():CalendarEvent=>({
  id:crypto.randomUUID(),title:'Suscripción',category:'expense',
  startDate:'2026-11-17',endDate:'2026-11-17',recurrence:'monthly',
  important:false,amountCOP:23000,createdAt:stamp,updatedAt:stamp
});
beforeEach(async()=>{await new Promise<void>((res,rej)=>{
  const r=indexedDB.deleteDatabase('aiden-savings');r.onsuccess=()=>res();r.onerror=()=>rej(r.error);
});});
describe('finanzas personales v1.3',()=>{
  it('calcula gastos e ingresos reales por mes sin mezclar pagos previstos',()=>{
    const a=makeEntry(),b=makeEntry({id:crypto.randomUUID(),kind:'income',amountCOP:35000}),
      c=makeEntry({id:crypto.randomUUID(),localDate:'2026-10-01',amountCOP:4000});
    expect(financeTotals([a,b,c],'2026-11')).toEqual({spent:20000,received:35000,net:15000});
    expect(financeHistory([a,b,c],'2026-10')).toEqual([c]);
  });
  it('migra IndexedDB 3→4 sin tocar ahorros, agenda ni ajustes',async()=>{
    const movement={id:crypto.randomUUID(),type:'deposit',amountCOP:60000,localDate:'2026-11-12',createdAt:stamp,updatedAt:stamp};
    await new Promise<void>((res,rej)=>{
      const r=indexedDB.open('aiden-savings',3);
      r.onupgradeneeded=()=>{
        const db=r.result;
        db.createObjectStore('movements',{keyPath:'id'}).put(movement);
        db.createObjectStore('settings').put({schemaVersion:2,targetEndMonth:'2029-07',monthlyPlanCOP:150000,finalGoalCOP:8000000},'current');
        db.createObjectStore('events',{keyPath:'id'});
        db.createObjectStore('eventOccurrenceStates',{keyPath:'occurrenceKey'});
        db.createObjectStore('tasks',{keyPath:'id'});
        db.createObjectStore('countdowns',{keyPath:'id'});
      };
      r.onsuccess=()=>{r.result.close();res();};r.onerror=()=>rej(r.error);
    });
    const data=await loadPersonalSnapshot();
    expect(balance(data.movements)).toBe(60000);expect(data.movements[0].id).toBe(movement.id);
    expect(data.settings.monthlyPlanCOP).toBe(150000);expect(data.settings.finalGoalCOP).toBe(8000000);
    expect(data.financeEntries).toEqual([]);
  });
  it('un gasto realizado no altera el saldo de la alcancía',async()=>{
    await saveMovement({id:crypto.randomUUID(),type:'deposit',amountCOP:40000,localDate:'2026-11-01',createdAt:stamp,updatedAt:stamp},'add');
    await saveFinanceEntry(makeEntry(),'add');
    const data=await loadPersonalSnapshot();
    expect(balance(data.movements)).toBe(40000);
    expect(financeTotals(data.financeEntries,'2026-11').spent).toBe(20000);
  });
  it('confirma la ocurrencia y el gasto en un solo commit, sin duplicar',async()=>{
    const e=makeEvent();await saveEvent(e,'add');
    const linked=makeEntry({occurrenceKey:`${e.id}@2026-11-17`,amountCOP:26000});
    await saveFinanceEntry(linked,'add');
    const data=await loadPersonalSnapshot();
    expect(data.eventOccurrenceStates).toHaveLength(1);
    expect(data.eventOccurrenceStates[0].status).toBe('paid');
    await saveFinanceEntry(linked,'add');
    expect((await loadPersonalSnapshot()).financeEntries).toHaveLength(1);
    await expect(saveFinanceEntry(makeEntry({occurrenceKey:linked.occurrenceKey}),'add')).rejects.toThrow();
    expect((await loadPersonalSnapshot()).financeEntries).toHaveLength(1);
  });
  it('al borrar un gasto vinculado, su vencimiento vuelve a pendiente',async()=>{
    const e=makeEvent();await saveEvent(e,'add');
    const entry=makeEntry({occurrenceKey:`${e.id}@2026-11-17`});
    await saveFinanceEntry(entry,'add');await removeFinanceEntry(entry.id);
    const data=await loadPersonalSnapshot();
    expect(data.financeEntries).toEqual([]);expect(data.eventOccurrenceStates).toEqual([]);
  });
  it('eliminar una serie conserva el gasto real y quita solo su enlace',async()=>{
    const e=makeEvent();await saveEvent(e,'add');
    const entry=makeEntry({occurrenceKey:`${e.id}@2026-11-17`});
    await saveFinanceEntry(entry,'add');await removeEvent(e.id);
    const data=await loadPersonalSnapshot();
    expect(data.financeEntries[0].amountCOP).toBe(entry.amountCOP);
    expect(data.financeEntries[0].occurrenceKey).toBeUndefined();
    expect(data.events).toEqual([]);
  });
  it('v4 exporta/restaura todo, y un archivo alterado no borra datos',async()=>{
    const entry=makeEntry();await saveFinanceEntry(entry,'add');
    const data=await loadPersonalSnapshot();const backup=createPersonalBackup(data,new Date(stamp));
    expect(backup.version).toBe(4);
    const parsed=parsePersonalBackup(JSON.stringify(backup),'2026-11-17');
    expect(parsed.kind).toBe('full');
    expect(()=>parsePersonalBackup(JSON.stringify({...backup,financeEntries:[entry,entry]}),'2026-11-17')).toThrow();
    await restoreFullBackup(backup);
    expect((await loadPersonalSnapshot()).financeEntries).toEqual([entry]);
  });
  it('v3 se restaura sin borrar los registros reales actuales',async()=>{
    const entry=makeEntry();await saveFinanceEntry(entry,'add');
    const data=await loadPersonalSnapshot();const b=createPersonalBackup(data,new Date(stamp));
    const {financeEntries:_discard,...v4}=b;void _discard;
    const v3={...v4,version:3};
    const parsed=parsePersonalBackup(JSON.stringify(v3),'2026-11-17');
    expect(parsed.kind).toBe('full');
    if(parsed.kind==='full'){expect(parsed.preserveFinance).toBe(true);await restoreFullBackup(parsed.data,parsed.preserveFinance);}
    expect((await loadPersonalSnapshot()).financeEntries).toEqual([entry]);
  });
});
