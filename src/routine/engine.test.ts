import {describe,it,expect} from 'vitest';
import {initial,dateAt,at,tick,mark,remaining,reminder,acknowledge,activeContext,ensureRun,elapsedDays} from './engine';
const date='2026-11-26';const start=at(date,720);const begun=()=>({...initial(),started:date});
describe('routine scheduling',()=>{
 it('waits for wake evidence and generates a stable random daily window',()=>{const s=tick(begun(),start,()=>.5);expect(s.runs[date+':morning']).toBeUndefined();const w=tick({...s,wake:{date,at:start}},start,()=>.5);expect(w.runs[date+':morning'].due).toBe(start+300000);expect(tick(w,start+1000,()=>.1)).toBe(w);});
 it('keeps partial completion and supports undo',()=>{let s=ensureRun(begun(),initial().routines[0],start);const k=date+':morning';s=mark(s,k,'up','done',start);s=mark(s,k,'wash','done',start);expect(remaining(s.routines[0],s.runs[k],s)[0].id).toBe('teeth');s=mark(s,k,'wash','undo',start);expect(remaining(s.routines[0],s.runs[k],s)[0].id).toBe('wash');});
 it('does not send reminders while asleep and expires stale context',()=>{let s=tick(begun(),start,()=>0);const when=at(date,900);s={...s,context:{activity:'sleeping',source:'test',at:when,expires:when+60000}};expect(reminder(s,when)).toBeNull();expect(activeContext(s,when+60001)).toBe('unknown');});
 it('limits retry count and uses intervals 5,10,15',()=>{let s=tick(begun(),start,()=>0);const k=date+':movement',n=at(date,900);for(const [i,minutes] of [5,10,15].entries()){s=acknowledge(s,k,n,'test');expect(s.runs[k].retries).toBe(i+1);expect(s.runs[k].next).toBe(n+minutes*60000)}s=acknowledge(s,k,n,'test');expect(s.runs[k].next).toBeNull();});
 it('keeps old runs but does not remind for yesterday',()=>{const s=tick(begun(),start,()=>0);expect(reminder(s,at('2026-11-27',900))).toBeNull();expect(elapsedDays(date,'2026-11-28')).toBe(3);expect(dateAt(start)).toBe(date);});
});
