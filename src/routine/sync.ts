import {transaction,request} from '../savings/storage';
import {initial,type State} from './engine';
import {mergeRoutine} from './merge';
import {validateRoutine} from './schema';

export const apiBase=import.meta.env.VITE_ROUTINE_API || 'https://109.205.176.230:8443';
const key='aiden-routine-access';
export function accessToken(){return localStorage.getItem(key)??'';}
export function storeToken(token:string){if(token)localStorage.setItem(key,token);else localStorage.removeItem(key);}
let lastPush=0;
export function pushAvailable(){return navigator.onLine&&Date.now()-lastPush<60000;}
export async function api<T>(path:string,options:RequestInit={},token=accessToken()):Promise<T>{
  if(!token)throw new Error('Conecta la rutina primero.');
  const response=await fetch(apiBase+'/v1/'+path,{
    ...options,cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})}
  });
  if(!response.ok)throw new Error(response.status===401?'La clave de acceso no es válida.':'No se pudo comunicar con Rutina.');
  return response.json();
}
let running:Promise<void>|undefined;
async function performSync(){
  const token=accessToken();
  if(!token||!navigator.onLine)return;
  const [local,base]=await transaction('readonly',['routine'],async tx=>{
    const store=tx.objectStore('routine');
    return Promise.all([request<State|undefined>(store.get('state')),request<State|undefined>(store.get('remote-base'))]);
  });
  const serialized=JSON.stringify(local), dirty=local&&serialized!==JSON.stringify(base);
  const remote=validateRoutine(await api('sync',dirty?{method:'POST',body:JSON.stringify({base:base??initial(),local})}:{},token));
  if(accessToken()!==token)return;
  const sub=remote.syncPush&&(await navigator.serviceWorker?.getRegistration())?
    await (await navigator.serviceWorker.getRegistration())?.pushManager?.getSubscription():null;
  lastPush=sub?Date.now():0;
  let updated=false;
  await transaction('readwrite',['routine'],async tx=>{
    const store=tx.objectStore('routine');
    const current=await request<State|undefined>(store.get('state'));
    const next=current&&JSON.stringify(current)!==serialized?mergeRoutine(local??initial(),current,remote):remote;
    if(JSON.stringify(current)!==JSON.stringify(next)){store.put(next,'state');updated=true;}
    store.put(remote,'remote-base');
  });
  if(updated)window.dispatchEvent(new Event('aiden:routine-synced'));
}
export function syncRoutine(){
  if(!running)running=performSync().catch(error=>{lastPush=0;throw error;}).finally(()=>{running=undefined;});
  return running;
}
export function requestSync(){void syncRoutine().catch(()=>{});}
export function startRoutineSync(){
  const poll=()=>{if(document.visibilityState==='visible')requestSync();};
  const timer=window.setInterval(poll,20000);
  document.addEventListener('visibilitychange',poll);
  window.addEventListener('online',poll);
  poll();
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',poll);window.removeEventListener('online',poll);};
}
