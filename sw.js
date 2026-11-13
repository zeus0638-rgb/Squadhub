/* SquadHub service worker.
   Upload this file to the same place as index.html (the root of the Squadhub repo).

   What it does:
   - shows phone notifications sent from the server (push), even when the app is closed or the phone is locked
   - if the app is already on screen, it hands the message to the app instead (the app shows its own card),
     so nothing buzzes twice
   - brings the app to the front when a notification is tapped
   - tells the app if the phone changes its own push address, so the server's copy is refreshed

   It does not cache anything, so changes to index.html still reach everyone the next time they open the app. */

self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(x){ d = {body: e.data ? e.data.text() : ''}; }
  var title = d.title || 'SquadHub';
  var options = {
    body: d.body || '',
    tag: d.tag || undefined,            // same tag = replaces the earlier notification instead of stacking
    renotify: false,
    requireInteraction: d.topic === 'sub_reminders',   // time-critical ones stay until you deal with them
    vibrate: [250, 120, 250, 120, 250],
    icon: 'icon-192.png',
    data: d
  };
  e.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
      var visible = list.filter(function(c){ return c.visibilityState === 'visible'; });
      if(visible.length){
        visible.forEach(function(c){ c.postMessage({type: 'push', payload: d}); });
        return;                          // the app is on screen and shows this itself
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
    for(var i = 0; i < list.length; i++){ if('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('pushsubscriptionchange', function(e){
  e.waitUntil(
    (e.oldSubscription && e.oldSubscription.options
      ? self.registration.pushManager.subscribe(e.oldSubscription.options)
      : Promise.resolve(null))
    .then(function(){ return self.clients.matchAll({type: 'window', includeUncontrolled: true}); })
    .then(function(list){ list.forEach(function(c){ c.postMessage({type: 'push-subscription-changed'}); }); })
    .catch(function(){})
  );
});
