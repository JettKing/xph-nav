/** XPH V5.3 server-side admin login. No client-side password/hash is stored. */
(function(){
'use strict';
const form=document.getElementById('loginForm'),pwd=document.getElementById('pwd'),btn=document.getElementById('login'),msg=document.getElementById('msg');
async function login(){if(btn.disabled)return;const password=pwd.value;if(!password){msg.textContent='请输入密码';pwd.focus();return;}btn.disabled=true;msg.textContent='';try{const r=await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});const data=await r.json().catch(()=>({}));if(!r.ok||data.ok!==true){msg.textContent=data?.error?.message||'验证失败';btn.disabled=false;pwd.focus();return;}location.replace('/admin/index.html');}catch(e){msg.textContent='验证服务不可用，请稍后重试';btn.disabled=false;}}
if(form)form.addEventListener('submit',e=>{e.preventDefault();login()});
})();