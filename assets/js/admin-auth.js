/**
 * 徐胖虎资源社 V5.3.6 后台认证
 * SHA-256 Hash 校验 + Session保护
 */
(function(){
"use strict";
const ADMIN_HASH="b59c67bf196a4758191e42f76670ceba72b1f8d2f4c7f5f8b5d7a6d4f0e8c2b9";
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