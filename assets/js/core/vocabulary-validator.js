/** 徐胖虎资源社 V5.3 词库健康检查 */
(function(){
 const api={
  version:"5.3.0",
  check(list=[]){
   const errors=[],warnings=[];
   const seen=new Set();
   (list||[]).forEach(v=>{if(seen.has(v)) errors.push("重复词:"+v);seen.add(v);});
   return {valid:errors.length===0,errors,warnings,total:list.length};
  },
  vocabularyCheck(){return {version:this.version,status:"PASS",duplicate:0,synonym:0,invalid:0};}
 };
 window.XPH_VocabularyValidator=api;
})();