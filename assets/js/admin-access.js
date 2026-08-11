/** 徐胖虎资源社 V5.3.6.6 隐藏后台入口 */
(function(){
"use strict";
function init(){
 const trigger=document.getElementById("xph-admin-trigger");
 if(!trigger) return;
 let count=0; let timer=0;
 trigger.addEventListener("click",function(e){
  e.preventDefault(); e.stopPropagation();
  count++;
  clearTimeout(timer);
  timer=setTimeout(function(){count=0;},1500);
  if(count>=5){count=0;clearTimeout(timer);window.location.assign("/admin/login.html");}
 });
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();