import {useState} from 'react';
import {retryIntervals,type State} from './engine';
import type {Change} from './PersonalizationView';

const clock=(min:number)=>[Math.floor(min/60),min%60].map(x=>String(x).padStart(2,'0')).join(':');
const minute=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};

export function ScheduleView({s,change}:{s:State;change:Change}){
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  return <details className="routine-disclosure">
    <summary>Horarios e intentos <span>›</span></summary>
    <form className="routine-form" onSubmit={async event=>{
      event.preventDefault();setError('');setSaved(false);
      const data=new FormData(event.currentTarget);
      const text=String(data.get('retry')).trim();
      const retryMinutes=text?text.split(',').map(value=>Number(value.trim())):[];
      const quiet={start:minute(String(data.get('quiet-start'))),end:minute(String(data.get('quiet-end')))};
      const routines=s.routines.map(r=>({...r,
        start:r.afterWake?r.start:minute(String(data.get(r.id+'-start'))),
        end:r.afterWake?r.end:minute(String(data.get(r.id+'-end'))),
        cutoff:minute(String(data.get(r.id+'-cutoff')))
      }));
      if(retryMinutes.length>8||retryMinutes.some(x=>!Number.isInteger(x)||x<1||x>180)||
        routines.some(r=>!Number.isInteger(r.cutoff)||!(r.start<=r.end&&r.end<=r.cutoff))){
        setError('Comprueba los horarios y los intervalos de 1 a 180 minutos.');return;
      }
      setSaved(await change(old=>({...old,quiet,retryMinutes,routines})));
    }}>
      <label>Silencio desde<input type="time" name="quiet-start" required defaultValue={clock(s.quiet?.start??0)}/></label>
      <label>Silencio hasta<input type="time" name="quiet-end" required defaultValue={clock(s.quiet?.end??0)}/></label>
      <small>Horas de Colombia. La misma hora desactiva el silencio.</small>
      <label>Reintentos en minutos<input name="retry" defaultValue={retryIntervals(s).join(', ')} placeholder="5, 10, 15"/></label>
      {s.routines.map(r=><fieldset key={r.id}>
        <legend>{r.title}</legend>
        {!r.afterWake&&<><label>Desde<input type="time" required name={r.id+'-start'} defaultValue={clock(r.start)}/></label>
        <label>Hasta<input type="time" required name={r.id+'-end'} defaultValue={clock(r.end)}/></label></>}
        <label>Límite<input type="time" required name={r.id+'-cutoff'} defaultValue={clock(r.cutoff)}/></label>
      </fieldset>)}
      <button className="routine-primary">Guardar horarios</button>
      {error&&<p role="alert">{error}</p>}
      {saved&&<p role="status">Horarios guardados.</p>}
    </form>
  </details>;
}
