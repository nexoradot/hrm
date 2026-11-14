/* VELNORA central audit telemetry. Records successful authenticated activity; never stores request bodies or passwords. */
(function () {
  'use strict';
  if (window.__VELNORA_AUDIT_TRACKER__) return;
  window.__VELNORA_AUDIT_TRACKER__ = true;
  var cfg = window.NEXORA_CONFIG || {};
  if (!cfg.url || !cfg.anonKey || !window.fetch) return;
  var portal = /\/candidate-portal\//i.test(location.pathname) ? 'candidate_portal' :
    /\/my-portal\//i.test(location.pathname) ? 'employee_portal' :
    /\/superadmin\//i.test(location.pathname) ? 'superadmin' :
    /\/hrm\//i.test(location.pathname) ? 'hr_workspace' : 'public_portal';
  var nativeFetch = window.fetch.bind(window);
  var busy = false;
  function decode(token) {
    try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
    catch (_) { return {}; }
  }
  function log(token, event) {
    if (!token || busy) return;
    var claims = decode(token), actor = claims.sub;
    if (!actor) return;
    busy = true;
    var row = {
      actor_user_id: actor,
      portal: portal,
      action_category: event.category || 'data_change',
      action: String(event.action || 'activity').slice(0,120),
      entity_type: event.entity || null,
      entity_id: null,
      outcome: event.outcome || 'success',
      request_path: String(event.path || location.pathname).slice(0,500),
      source: 'browser_telemetry',
      details: { method: event.method || null, http_status: event.status || null, page: location.pathname, query: location.search ? '[redacted]' : null }
    };
    nativeFetch(cfg.url + '/rest/v1/audit_events', {
      method: 'POST',
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify(row),
      keepalive: true
    }).catch(function () {}).finally(function () { busy = false; });
  }
  window.fetch = async function (input, init) {
    var requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var headers = new Headers((init && init.headers) || (input && input.headers) || {});
    var auth = headers.get('Authorization') || '';
    var token = auth.replace(/^Bearer\s+/i,'');
    var isAuth = requestUrl.indexOf('/auth/v1/') !== -1;
    var isRest = requestUrl.indexOf('/rest/v1/') !== -1;
    var isFunction = requestUrl.indexOf('/functions/v1/') !== -1;
    var isAudit = requestUrl.indexOf('/rest/v1/audit_events') !== -1;
    var response = await nativeFetch(input, init);
    try {
      if (isAuth && /token\?grant_type=password|logout/i.test(requestUrl)) {
        if (response.ok && /token\?grant_type=password/i.test(requestUrl)) {
          var copy = response.clone();
          copy.json().then(function (data) {
            if (data && data.access_token) log(data.access_token, {category:'authentication',action:'Successful sign-in',path:'/auth/v1/token',method:'POST',status:response.status});
          }).catch(function(){});
        } else if (response.ok && /logout/i.test(requestUrl)) {
          log(token, {category:'authentication',action:'Signed out',path:'/auth/v1/logout',method:'POST',status:response.status});
        }
      } else if (isRest && !isAudit && ['GET','POST','PATCH','PUT','DELETE'].indexOf(method) !== -1 && response.ok) {
        var table = requestUrl.split('/rest/v1/')[1].split(/[?/#]/)[0];
        var write = method !== 'GET';
        log(token, {category:write?'data_change':'data_access',action:(write?method+' ':'Viewed ')+table,entity:table,path:'/rest/v1/'+table,method:method,status:response.status});
      } else if (isFunction && response.ok) {
        var fn = requestUrl.split('/functions/v1/')[1].split(/[?/#]/)[0];
        log(token, {category:'workflow',action:'Invoked '+fn,entity:fn,path:'/functions/v1/'+fn,method:method,status:response.status});
      }
    } catch (_) {}
    return response;
  };
})();
