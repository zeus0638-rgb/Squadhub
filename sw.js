/* SquadHub service worker.
   Upload this file to the same place as index.html (the root of the Squadhub repo).
   It does three small things: lets the app show phone notifications on Android, brings the app back to the
   front when a notification is tapped, and is ready to show server-sent push messages if those are added later.
   It does not cache anything, so changes to index.html still reach everyone the next time they open the app. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){ if('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){ d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'SquadHub', {body: d.body || '', tag: d.tag, vibrate:[250,120,250], requireInteraction:true, icon:'icon-192.png', data:d}));
});
