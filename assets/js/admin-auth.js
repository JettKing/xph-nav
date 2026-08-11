/** 徐胖虎资源社 V5.3.6.6 后台页面保护 */
(function(){
"use strict";
function isLoginPage(){
 const p=(window.location.pathname||"").replace(/\/+$/,"");
 return p==="/admin/login.html" || p==="/login.html" || p.endsWith("/admin/login");
}
function requireAuth(){
 if(sessionStorage.getItem("xph_admin_auth")==="1") return true;
 window.location.replace("/admin/login.html");
 return false;
}
window.XPHAdminAuth={requireAuth,isLoginPage};
if(!isLoginPage() && (window.location.pathname||"").includes("/admin/")){ requireAuth(); }
})();