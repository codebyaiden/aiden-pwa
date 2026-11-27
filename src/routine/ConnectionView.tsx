import {useEffect,useState,type FormEvent} from 'react';
import {accessToken,api,storeToken,syncRoutine} from './sync';

type Status={vapid:string;push:boolean};
type Delivery={id:string;at:number;status:string;attempts:number};
const deliveryLabels:Record<string,string>={accepted:'Aceptado por el proveedor',failed:'Falló',expired:'Suscripción vencida',retry:'Reintento pendiente',sending:'Enviando'};

export function ConnectionView(){
  const [token,setToken]=useState(''),[connected,setConnected]=useState(()=>!!accessToken());
  const [push,setPush]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const [vapid,setVapid]=useState('');
  const [history,setHistory]=useState<Delivery[]>([]);
  useEffect(()=>{
    if(!connected)return;
    let active=true;
    async function refresh(){
      try{
        const [settings,entries]=await Promise.all([api<Status>('status'),api<Delivery[]>('history')]);
        const registration=await navigator.serviceWorker?.getRegistration();
        const sub=await registration?.pushManager?.getSubscription();
        if(active){setPush(settings.push&&!!sub);setVapid(settings.vapid);setHistory(entries);}
      }catch{if(active)setStatus('Sin conexión con Rutina.');}
    }
    void refresh();
    const interval=window.setInterval(refresh,30000);
    return()=>{active=false;clearInterval(interval);};
  },[connected]);
  async function act(fn:()=>Promise<void>){
    setBusy(true);setStatus('');
    try{await fn();}catch(error){setStatus(error instanceof Error?error.message:'No se pudo completar.');}
    finally{setBusy(false);}
  }
  function connect(e:FormEvent){
    e.preventDefault();
    void act(async()=>{
      const secret=token.trim();
      const settings=await api<Status>('status',{},secret);
      setVapid(settings.vapid);
      storeToken(secret);
      setConnected(true);setToken('');
      await syncRoutine();
      setStatus('Rutina conectada.');
    });
  }
  function enable(){
    void act(async()=>{
      if(!('Notification' in window)||!('PushManager' in window)||!navigator.serviceWorker)throw new Error('En iPhone, abre aiden. desde la pantalla de inicio.');
      if(await Notification.requestPermission()!=='granted')throw new Error('Permite las notificaciones en los ajustes del dispositivo.');
      const registration=await navigator.serviceWorker.getRegistration();
      if(!registration?.active)throw new Error('Vuelve a abrir aiden. cuando termine de instalarse.');
      const existing=await registration.pushManager.getSubscription();
      const sub=existing??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapid});
      await api('subscription',{method:'POST',body:JSON.stringify(sub)});
      setPush(true);
      await syncRoutine();
      setStatus('Avisos activados en este dispositivo.');
    });
  }
  function disconnect(revoke:boolean){
    void act(async()=>{
      if(revoke||push){
        await api('subscription',{method:'DELETE'});
        const registration=await navigator.serviceWorker?.getRegistration();
        const sub=await registration?.pushManager?.getSubscription();
        await sub?.unsubscribe();
        setPush(false);
      }
      if(!revoke){storeToken('');setConnected(false);setHistory([]);}
      else await syncRoutine();
    });
  }
  return <details className="routine-disclosure"><summary>Conexión y notificaciones <span>›</span></summary>
    {!connected?<form className="routine-form" onSubmit={connect}>
      <label>Clave de Rutina<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required/></label>
      <button className="routine-primary" disabled={busy}>Conectar</button>
    </form>:<div className="routine-form">
      <p className="routine-muted">Rutina puede sincronizarse con el servidor. El calendario y las finanzas permanecen en este dispositivo.</p>
      <button className="routine-primary" disabled={busy||!vapid} onClick={push?()=>disconnect(true):enable}>{push?'Desactivar avisos push':'Activar avisos push'}</button>
      {push&&<button disabled={busy} onClick={()=>void act(async()=>{
        const response=await api<{status:string}>('test',{method:'POST'});
        setStatus(deliveryLabels[response.status]??'Estado desconocido');
      })}>Enviar aviso de prueba</button>}
      <button disabled={busy} onClick={()=>disconnect(false)}>Desconectar este dispositivo</button>
      {!!history.length&&<details className="routine-disclosure"><summary>Entregas recientes</summary>
        {history.slice(0,15).map(item=><div key={item.id} className="routine-info-row">
          <span>{deliveryLabels[item.status]??item.status}<small>{new Date(item.at).toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'})}</small></span>
          <small>{item.attempts} {item.attempts===1?'intento':'intentos'}</small>
        </div>)}
      </details>}
    </div>}
    {status&&<p className="routine-muted" role="status">{status}</p>}
  </details>;
}
