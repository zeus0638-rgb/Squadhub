/* SquadHub service worker.
   Upload this file to the same place as index.html (the root of the Squadhub repo).

   What it does:
   - shows phone notifications sent from the server (push), even when the app is closed or the phone is locked
   - if the app is already on screen, it hands the message to the app instead (the app shows its own card),
     so nothing buzzes twice
   - brings the app to the front when a notification is tapped
   - tells the app if the phone changes its own push address, so the server's copy is refreshed

   It does not cache anything, so changes to index.html still reach everyone the next time they open the app. */

var SW_VERSION = '2026-11-25a';
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
    requireInteraction: d.topic === 'sub_reminders' || d.topic === 'period_end' || d.topic === 'match_end' || d.title === 'Full time',   // time-critical ones stay until you deal with them
    vibrate: [250, 120, 250, 120, 250],
    icon: 'icon-192.png',
    data: d
  };
  e.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function(list){
      // tell every open window the push arrived (the Notifications pop-up uses this to report on its test)
      list.forEach(function(c){ c.postMessage({type: 'push-received', id: d.id, topic: d.topic, at: Date.now(), version: SW_VERSION}); });
      var visible = list.filter(function(c){ return c.visibilityState === 'visible'; });
      // The coach app on screen shows these itself. The parent follow page only refreshes silently, so it still gets the real notification.
      var appOnScreen = visible.filter(function(c){ return c.url.indexOf('follow.html') < 0; });
      visible.forEach(function(c){ c.postMessage({type: 'push', payload: d}); });
      if(appOnScreen.length) return;
      return self.registration.showNotification(title, options).catch(function(err){
        list.forEach(function(c){ c.postMessage({type: 'push-show-failed', error: String(err && err.message || err)}); });
      });
    })
  );
});

// A phone that follows a team as a parent has its link's key saved here by follow.html.
function followToken(){
  return new Promise(function(res){
    try{
      var r = indexedDB.open('sqh-follow', 1);
      r.onupgradeneeded = function(){ r.result.createObjectStore('kv'); };
      r.onsuccess = function(){
        try{
          var g = r.result.transaction('kv').objectStore('kv').get('token');
          g.onsuccess = function(){ res(g.result || null); };
          g.onerror = function(){ res(null); };
        }catch(x){ res(null); }
      };
      r.onerror = function(){ res(null); };
    }catch(x){ res(null); }
  });
}

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var d = e.notification.data || {};
  e.waitUntil(Promise.all([followToken(), self.clients.matchAll({type: 'window', includeUncontrolled: true})]).then(function(r){
    var token = r[0], list = r[1], i;
    if(token){
      // a parent: open the read-only live page
      var u = new URL('follow.html?t=' + encodeURIComponent(token), self.registration.scope).href;
      for(i = 0; i < list.length; i++){
        if(list[i].url.indexOf('follow.html') >= 0){ list[i].postMessage({type: 'refresh'}); return list[i].focus(); }
      }
      return self.clients.openWindow(u);
    }
    // a coach: open the app on that match (the app shows the full view if they run it, the locked view if not)
    var info = {fixtureId: (d.data && d.data.fixtureId) || null, topic: d.topic || null};
    for(i = 0; i < list.length; i++){
      if(list[i].url.indexOf('follow.html') < 0){ list[i].postMessage({type: 'open', info: info}); return list[i].focus(); }
    }
    var q = info.fixtureId ? ('?open=' + encodeURIComponent(info.fixtureId)) : '';
    return self.clients.openWindow(new URL('./', self.registration.scope).href + q);
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

// The app asks "which version of you is running?" so it can tell whether a new sw.js has taken over.
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'ping' && e.source){ e.source.postMessage({type: 'pong', version: SW_VERSION}); }
});
