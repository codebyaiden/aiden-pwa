self.addEventListener('push', event => {
  let payload={};
  try { payload=event.data?.json()??{}; } catch { /* use the fallback */ }
  event.waitUntil(self.registration.showNotification('aiden.', {
    body:typeof payload.body==='string'?payload.body:'Tienes una rutina pendiente.',
    icon:new URL('../icons/icon-192.png',self.registration.scope+'routine/').href,
    tag:typeof payload.tag==='string'?payload.tag:'aiden-routine'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination=new URL('#rutina',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const app=windows.find(client=>client.url.startsWith(self.registration.scope));
    if(app){
      try{await app.navigate(destination);await app.focus();return;}catch{/* open a window */}
    }
    await self.clients.openWindow(destination);
  })());
});
