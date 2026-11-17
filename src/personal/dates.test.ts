import {describe,expect,it} from 'vitest';
import {addDays,countdownText,dayDifference,financialReminders,monthCells,monthOffset,occurrencesForRange,occurrencesOnDay,resolveCountdown,yearOffset} from './dates';
import type { CalendarEvent } from './types';
const id='11111111-1111-4111-8111-111111111111';
const stamp='2026-11-17T05:00:00.000Z';
function event(p:Partial<CalendarEvent>={}):CalendarEvent{return {id,title:'Evento',category:'personal',startDate:'2026-12-07',endDate:'2026-12-08',important:false,recurrence:'none',createdAt:stamp,updatedAt:stamp,...p};}
describe('fechas del calendario y rango',()=>{
 it('semana lunes-domingo, noviembre 2026 y diciembre 2030',()=>{
  const nov=monthCells('2026-11');expect(nov[0]).toBe('2026-10-26');expect(nov[6]).toBe('2026-11-01');expect(nov.length%7).toBe(0);
  const dec=monthCells('2030-12');expect(dec.includes('2030-12-31')).toBe(true);expect(dec.length%7).toBe(0);
 });
 it('febrero bisiesto y cambio de año sin convertir a hora local',()=>{
  expect(monthCells('2028-02').includes('2028-02-29')).toBe(true);
  expect(monthCells('2027-02').includes('2027-02-29')).toBe(false);
  expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(dayDifference('2026-12-31','2027-01-01')).toBe(1);
 });
 it('dos días aparecen en ambos, semana, cruce de mes y año',()=>{
  const v=event(); expect(occurrencesOnDay([v],'2026-12-07')).toHaveLength(1);expect(occurrencesOnDay([v],'2026-12-08')).toHaveLength(1);
  const cross=event({startDate:'2026-12-31',endDate:'2027-01-03'});
  expect(occurrencesOnDay([cross],'2027-01-01')[0].endDate).toBe('2027-01-03');
  expect(occurrencesOnDay([cross],'2027-01-04')).toHaveLength(0);
 });
});
describe('recurrencias sin duplicar en IndexedDB',()=>{
 it('semanal repite cada siete días',()=>{const x=event({startDate:'2026-11-10',endDate:'2026-11-10',recurrence:'weekly'});
  expect(occurrencesForRange([x],'2026-11-17','2026-12-01').map(o=>o.startDate)).toEqual(['2026-11-17','2026-11-24','2026-12-01']);});
 it('31 enero, febrero bisiesto y marzo sin drift',()=>{expect(monthOffset('2028-01-31',1)).toBe('2028-02-29');expect(monthOffset('2028-01-31',2)).toBe('2028-03-31');
  const x=event({startDate:'2028-01-31',endDate:'2028-02-01',recurrence:'monthly'});
  expect(occurrencesForRange([x],'2028-02-28','2028-03-02').map(o=>[o.startDate,o.endDate])).toEqual([['2028-02-29','2028-03-01']]);});
 it('29 febrero se ajusta a 28 en años normales',()=>{
  expect(yearOffset('2028-02-29',1)).toBe('2029-02-28');expect(yearOffset('2028-02-29',4)).toBe('2032-02-29');
 });
 it('recurrencia hasta fin de serie no crea más; genera solo ventana',()=>{
  const x=event({startDate:'2026-11-17',endDate:'2026-11-17',recurrence:'monthly',recurrenceUntil:'2027-01-17'});
  expect(occurrencesForRange([x],'2026-11-01','2027-12-31')).toHaveLength(3);
  expect(occurrencesForRange([x],'2030-12-01','2030-12-31')).toHaveLength(0);
 });
});
describe('avisos financieros y countdowns',()=>{
 it('3 días, 1 día, hoy, vencido; confirmado desaparece',()=>{
  const x=event({category:'expense',startDate:'2026-11-20',endDate:'2026-11-20'});
  expect(financialReminders([x],[],'2026-11-17')).toHaveLength(1);
  expect(financialReminders([x],[],'2026-11-19')).toHaveLength(1);
  expect(financialReminders([x],[],'2026-11-20')).toHaveLength(1);
  expect(financialReminders([x],[],'2026-11-21')).toHaveLength(1);
  expect(financialReminders([x],[{occurrenceKey:`${id}@2026-11-20`,status:'paid'}],'2026-11-21')).toHaveLength(0);
 });
 it('countdown de fecha no inventa horas y el vinculado sigue el evento',()=>{
  expect(countdownText('2026-11-20',undefined,'2026-11-17')).toBe('3 días');
  expect(countdownText('2026-11-17',undefined,'2026-11-17')).toBe('Hoy');
  expect(countdownText('2026-11-16',undefined,'2026-11-17')).toBe('Finalizado');
  expect(countdownText('2026-11-17','10:00','2026-11-17',new Date('2026-11-17T15:00:01Z'))).toBe('Finalizado');
  const link=resolveCountdown({sourceEventId:id},[event({startDate:'2026-12-10'})]);expect(link?.date).toBe('2026-12-10');
 });
});
