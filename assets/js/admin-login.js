/**
 * 徐胖虎资源社 V5.3 后台登录模块
 */
(function(){
"use strict";

async function sha256(text){
 const data=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(hash))
 .map(b=>b.toString(16).padStart(2,"0")).join("");
}

const ADMIN_HASH="b59c67bf196a4758191e42f76670ceba72b1f8d2f4c7f5f8b5d7a6d4f0e8c2b9";

window.XPHAdminLogin={sha256,ADMIN_HASH};

document.addEventListener("DOMContentLoaded",()=>{
 const form=document.getElementById("loginForm");
 const pwd=document.getElementById("pwd");
 const btn=document.getElementById("login");
 const msg=document.getElementById("msg");
 if(!form) return;

 form.addEventListener("submit",async e=>{
  e.preventDefault();
  btn.disabled=true;
  const h=await sha256(pwd.value);
  if(h===ADMIN_HASH){
   sessionStorage.setItem("xph_admin_auth","1");
   location.replace("/admin/index.html");
  }else{
   msg.textContent="密码错误";
   btn.disabled=false;
  }
 });
});
})();