/** XPH V5.3 strict resource validator. Legacy fields are hard failures. */
window.XPHResourceValidator = (() => {
  const legacy = new Set(['platform','pricing','language','audience','subcategories','desc','project','tags','_meta','features']); // 仅检查顶层旧字段；attributes.* 是 V5.3 合法结构
  const fail=(errors,msg)=>errors.push(msg);
  function validate(resource,{allIds=new Set(),allNames=new Map()}={}){
    const errors=[];
    if(!resource || typeof resource!=='object'){fail(errors,'资源不是对象');return errors;}
    const required=['id','name','description','icon','thumbnail','category','subcategory','website','github','capabilities','scenarios','attributes','official','recommend','status'];
    for(const key of required) if(!(key in resource)) fail(errors,`缺少字段 ${key}`);
    for(const key of Object.keys(resource)) if(legacy.has(key)) fail(errors,`存在遗留字段 ${key}`);
    if(Array.from(resource.description||'').length!==16) fail(errors,`${resource.id||resource.name} 简介必须16字`);
    const group=window.categories?.[resource.category];
    if(!group || !Object.prototype.hasOwnProperty.call(group.children||{},resource.subcategory)) fail(errors,`${resource.id||resource.name} 分类/子分类ID无效`);
    const expected=window.XPH_RESOURCE_ICONS?.[resource.subcategory];
    if(!expected || resource.icon!==expected) fail(errors,`${resource.id||resource.name} Icon与子分类ID不一致`);
    const validCap=new Set(window.tags?.capabilities||[]), validScenario=new Set(window.tags?.scenarios||[]);
    for(const v of resource.capabilities||[]) if(!validCap.has(v)) fail(errors,`${resource.id||resource.name} 非法能力：${v}`);
    for(const v of resource.scenarios||[]) if(!validScenario.has(v)) fail(errors,`${resource.id||resource.name} 非法场景：${v}`);
    const attrs=resource.attributes;
    if(!attrs || !Array.isArray(attrs.platform) || typeof attrs.pricing!=='string' || !Array.isArray(attrs.language) || !Array.isArray(attrs.audience)) fail(errors,`${resource.id||resource.name} attributes 结构无效`);
    else {
      for(const v of attrs.platform) if(!(window.tags?.attributes?.platform||[]).includes(v)) fail(errors,`${resource.id||resource.name} 非法平台：${v}`);
      if(!(window.tags?.attributes?.pricing||[]).includes(attrs.pricing)) fail(errors,`${resource.id||resource.name} 非法价格：${attrs.pricing}`);
      for(const v of attrs.language) if(!(window.tags?.attributes?.language||[]).includes(v)) fail(errors,`${resource.id||resource.name} 非法语言：${v}`);
      for(const v of attrs.audience) if(!(window.tags?.attributes?.audience||[]).includes(v)) fail(errors,`${resource.id||resource.name} 非法受众：${v}`);
    }
    if(allIds.has(resource.id)) fail(errors,`重复ID：${resource.id}`);
    if(allNames.has(resource.name)) fail(errors,`重复名称：${resource.name}`);
    return errors;
  }
  function validateAll(resources){
    const list=Array.isArray(resources)?resources:[];const errors=[];const ids=new Set();const names=new Map();
    list.forEach(r=>{const e=validate(r,{allIds:ids,allNames:names});errors.push(...e);if(r?.id)ids.add(r.id);if(r?.name)names.set(r.name,r.website)});
    return {valid:errors.length===0,total:list.length,errors,ids:[...ids],names:[...names.keys()]};
  }
  return {validate,validateAll};
})();