import { isCalendarDate } from '../savings/calculations';
import type { CalendarEvent, Occurrence } from './types';

// Calendar arithmetic always uses UTC *components*, not the device's timezone.
export function dateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
export function dateISO(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}
export function addDays(date: string, days: number): string {
  const next = dateUTC(date); next.setUTCDate(next.getUTCDate() + days); return dateISO(next);
}
export function dayDifference(from: string, to: string): number {
  return Math.round((dateUTC(to).getTime() - dateUTC(from).getTime()) / 86400000);
}
export function daysInMonth(year: number, month: number): number { return new Date(Date.UTC(year,month,0)).getUTCDate(); }
export function monthOffset(date: string, n: number, anchorDay = Number(date.slice(8))): string {
  const [y, m] = date.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return dateISO(new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),Math.min(anchorDay, daysInMonth(base.getUTCFullYear(),base.getUTCMonth()+1)),12)));
}
export function yearOffset(date: string, n: number): string {
  const [y,m,d] = date.split('-').map(Number);
  return `${y+n}-${String(m).padStart(2,'0')}-${String(Math.min(d,daysInMonth(y+n,m))).padStart(2,'0')}`;
}
export function monthCells(month: string): string[] {
  const first = `${month}-01`;
  const dow = (dateUTC(first).getUTCDay()+6)%7;
  const count = Math.ceil((dow + daysInMonth(Number(month.slice(0,4)),Number(month.slice(5,7))))/7)*7;
  return Array.from({length:count}, (_,i)=>addDays(first,i-dow));
}
export function occurrencesForRange(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from>to) return [];
  const result: Occurrence[]=[];
  for(const event of events){
    if (event.startDate>to) continue;
    const duration=dayDifference(event.startDate,event.endDate);
    const earliest=addDays(from,-duration);
    const add=(startDate:string)=>{
      const endDate=addDays(startDate,duration);
      if(startDate <= to && endDate>=from && (!event.recurrenceUntil || startDate<=event.recurrenceUntil))
        result.push({event,startDate,endDate,key:`${event.id}@${startDate}`});
    };
    if(event.recurrence==='none'){add(event.startDate);continue;}
    if(event.recurrence==='weekly'){
      const jump=Math.max(0,Math.floor(dayDifference(event.startDate,earliest)/7));
      let start=addDays(event.startDate,jump*7);
      for(let i=0;i<Math.ceil(dayDifference(from,to)/7)+3 && start<=to;i++,start=addDays(start,7)) add(start);
    } else if(event.recurrence==='monthly'){
      const fromMonth=(Number(earliest.slice(0,4))-Number(event.startDate.slice(0,4)))*12+Number(earliest.slice(5,7))-Number(event.startDate.slice(5,7));
      let startOffset=Math.max(0,fromMonth-1);
      for(let i=0;i<Math.ceil(dayDifference(from,to)/28)+4;i++){
        const start=monthOffset(event.startDate,startOffset+i);
        if(start>to)break;
        if(start>=event.startDate)add(start);
      }
    } else {
      let startOffset=Math.max(0,Number(earliest.slice(0,4))-Number(event.startDate.slice(0,4))-1);
      for(let i=0;i<Math.ceil(dayDifference(from,to)/365)+4;i++){
        const start=yearOffset(event.startDate,startOffset+i);
        if(start>to)break;
        if(start>=event.startDate)add(start);
      }
    }
  }
  return result.sort((a,b)=>a.startDate.localeCompare(b.startDate)|| (a.event.startTime||'').localeCompare(b.event.startTime||'') || Number(b.event.important)-Number(a.event.important)||a.event.id.localeCompare(b.event.id));
}
export function occurrencesOnDay(events: CalendarEvent[], day:string) {return occurrencesForRange(events,day,day);}
export function dueMessage(date:string,today:string):string{
  const diff=dayDifference(today,date);
  if(diff<0)return 'Vencido'; if(diff===0)return 'Hoy';if(diff===1)return 'Mañana';if(diff===3)return 'En 3 días';
  return diff===2 ? 'En 2 días' : `En ${diff} días`;
}
export function financialReminders(events:CalendarEvent[],states:{occurrenceKey:string;status:string}[],today:string){
  const from=addDays(today,-30),to=addDays(today,3);
  const resolved=new Set(states.map(x=>x.occurrenceKey));
  return occurrencesForRange(events.filter(e=>e.category==='expense'||e.category==='income'),from,to)
    .filter(o=>!resolved.has(o.key) && (o.startDate<=today || [1,3].includes(dayDifference(today,o.startDate))))
    .sort((a,b)=>a.startDate.localeCompare(b.startDate));
}
export function localDateLabel(day:string,opts:Intl.DateTimeFormatOptions={weekday:'long',day:'numeric',month:'long'}):string{
  return new Intl.DateTimeFormat('es-CO',{timeZone:'UTC',...opts}).format(dateUTC(day));
}
export function resolveCountdown(countdown:{sourceEventId?:string;targetDate?:string;targetTime?:string},events:CalendarEvent[]){
  if(countdown.sourceEventId){const event=events.find(e=>e.id===countdown.sourceEventId);return event ? {date:event.startDate,time:event.startTime} : null;}
  return countdown.targetDate ? {date:countdown.targetDate,time:countdown.targetTime} : null;
}
export function countdownText(date:string,time:string|undefined,today:string,now:Date=new Date()):string{
  const diff=dayDifference(today,date);
  if(!time) return diff<0?'Finalizado':diff===0?'Hoy':diff===1?'Mañana':`${diff} días`;
  const timestamp=Date.parse(`${date}T${time}:00-05:00`);
  const remaining=Math.max(0, Math.floor((timestamp-now.getTime())/1000));
  if(!remaining)return 'Finalizado';
  const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
  return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
}
