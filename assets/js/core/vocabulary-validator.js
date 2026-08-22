/** XPH V5.3 Vocabulary Validator: taxonomy IDs, labels, icons and resource dimensions. */
window.XPHVocabularyValidator={
 version:'5.3',
 validateTaxonomy(){
  const errors=[],seen=new Set();
  for(const [category,group] of Object.entries(window.categories||{})){
   if(!category||!group?.name) errors.push(`分类无效：${category}`);
   for(const [subcategory,label] of Object.entries(group?.children||{})){
    if(seen.has(subcategory)) errors.push(`重复子分类ID：${subcategory}`); seen.add(subcategory);
    if(!window.XPH_RESOURCE_ICONS?.[subcategory]) errors.push(`缺少Icon映射：${subcategory}`);
    if(!label) errors.push(`缺少子分类名称：${subcategory}`);
   }
  }
  for(const [type,values] of Object.entries({capabilities:window.tags?.capabilities||[],scenarios:window.tags?.scenarios||[]})){
   const s=new Set(values);if(s.size!==values.length)errors.push(`${type}存在重复词`);
  }
  return {valid:errors.length===0,errors};
 },
 validateResources(resources){return window.XPHResourceValidator?.validateAll(resources)||{valid:false,errors:['资源验证器未加载']};}
};