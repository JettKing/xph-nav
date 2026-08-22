/** XPH V5.3 admin page guard: server-issued HttpOnly session only. */
(function(){
'use strict';
function isLoginPage(){const p=(location.pathname||'').replace(/\/+$/,'');return p==='/admin/login.html'||p==='/login.html'||p.endsWith('/admin/login');}
async function requireAuth(){if(isLoginPage())return true;try{const r=await fetch('/api/admin-session',{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});if(r.ok){const data=await r.json().catch(()=>({}));if(data.ok===true)return true;}}catch{}location.replace('/admin/login.html');return false;}
window.XPHAdminAuth={requireAuth,isLoginPage};
if(!isLoginPage()&&(location.pathname||'').includes('/admin/'))requireAuth();
})();