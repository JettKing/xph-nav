/**
 * 徐胖虎资源社 V5.3.6 后台认证
 * SHA-256 Hash 校验 + Session保护
 */
(function(){
"use strict";
const ADMIN_HASH="800ad4754ba1c7e6e453072f36bd5289e41811f8e2b89fa347ff18b79061e97c";
async function sha256(text){
 const data=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function requireAuth(){
 if(sessionStorage.getItem("xph_admin_auth")==="1") return true;
 location.href="/admin/login.html"; return false;
}
window.XPHAdminAuth={sha256,requireAuth,ADMIN_HASH};
if(location.pathname.includes("/admin/")&&!location.pathname.endsWith("/login.html")) requireAuth();
})();