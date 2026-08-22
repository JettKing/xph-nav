/** XPH Resource Engine V5.3: operates only on Contract fields and taxonomy IDs. */
window.ResourceEngine={
 version:'5.3',
 pages:{ai:()=>window.aiResources||[],software:()=>window.softwareResources||[],productivity:()=>window.productivityResources||[],website:()=>window.websiteResources||[],digital:()=>window.digitalResources||[],solution:()=>window.solutionResources||[]},
 getPageResources(page){const getter=this.pages[page];return typeof getter==='function'?getter():[];},
 getAllResources(){return Object.values(this.pages).flatMap(fn=>typeof fn==='function'?fn():[]);},
 values(item,field){const v=item?.[field];return Array.isArray(v)?v.filter(Boolean).map(x=>String(x).trim()):[];},
 scenarioValues(item){return this.values(item,'scenarios');},
 capabilityValues(item){return this.values(item,'capabilities');},
 attributeValues(item,key){const v=item?.attributes?.[key];return Array.isArray(v)?v.filter(Boolean).map(x=>String(x).trim()):typeof v==='string'&&v.trim()?[v.trim()]:[];},
 pricingValues(item){return this.attributeValues(item,'pricing');},
 normalizeCapability(v){const raw=String(v??'').trim();if(!raw||raw==='all')return 'all';return (window.tags?.capabilities||[]).find(x=>x===raw)||raw;},
 normalizeScenario(v){const raw=String(v??'').trim();if(!raw||raw==='all')return 'all';return (window.tags?.scenarios||[]).find(x=>x===raw)||raw;},
 labelMatch(values,target){const t=String(target||'').trim();return !t||t==='all'||values.includes(t);},
 search(keyword,data=[]){const key=String(keyword||'').trim().toLowerCase();if(!key)return data;return data.filter(i=>{const text=[i.name,i.description,i.category,i.subcategory,...this.capabilityValues(i),...this.scenarioValues(i),...this.attributeValues(i,'platform'),...this.attributeValues(i,'language'),...this.attributeValues(i,'audience'),...this.attributeValues(i,'pricing')].filter(Boolean).join(' ').toLowerCase();return text.includes(key);});},
 filter({data=[],keyword='',capability='all',scenario='all',pricing='all'}={}){let result=Array.isArray(data)?data.slice():[];if(capability!=='all')result=result.filter(i=>this.labelMatch(this.capabilityValues(i),this.normalizeCapability(capability)));if(scenario!=='all')result=result.filter(i=>this.labelMatch(this.scenarioValues(i),this.normalizeScenario(scenario)));if(pricing!=='all')result=result.filter(i=>this.labelMatch(this.pricingValues(i),pricing));return this.search(keyword,result);},
 facets(data=[]){const capabilities=new Map(),scenarios=new Map(),pricing=new Map();const add=(m,v)=>{const s=String(v||'').trim();if(s)m.set(s,(m.get(s)||0)+1);};data.forEach(i=>{this.capabilityValues(i).forEach(v=>add(capabilities,v));this.scenarioValues(i).forEach(v=>add(scenarios,v));this.pricingValues(i).forEach(v=>add(pricing,v));});return{capabilities,scenarios,attributes:{pricing}};},
 validate(data=[]){return window.XPHResourceValidator?.validateAll(data)||{valid:false,total:0,errors:['èµæºéªè¯å¨æªå è½½']};}
};