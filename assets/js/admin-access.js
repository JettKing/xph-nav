/**
 * 徐胖虎资源社 V5.3.6.1 隐藏后台入口修复
 */
(function(){
"use strict";

function init(){
 const trigger=document.getElementById("xph-admin-trigger");
 if(!trigger) return;
 let count=0;
 let timer=null;
 const hit=function(e){
  if(e && e.preventDefault) e.preventDefault();
  count++;
  clearTimeout(timer);
  timer=setTimeout(()=>{count=0;},1500);
  if(count>=5){
   count=0;
   clearTimeout(timer);
   window.location.href="/admin/login.html";
  }
 };
 trigger.addEventListener("click",hit);
 trigger.addEventListener("touchend",hit,{passive:false});
}
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',init);
}else{init();}
})();