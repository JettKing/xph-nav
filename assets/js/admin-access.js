/**
 * 徐胖虎资源社 V5.3.5 隐藏后台入口
 * 版权区域 1.5秒内连续点击5次触发管理员验证
 */
(function(){
"use strict";

const trigger=document.getElementById("xph-admin-trigger");
if(!trigger) return;

let count=0;
let timer=null;

trigger.addEventListener("click",function(){
  count++;

  clearTimeout(timer);

  timer=setTimeout(()=>{
    count=0;
  },1500);

  if(count>=5){
    count=0;
    clearTimeout(timer);

    window.location.href="/admin/login.html";

  }
});

})();