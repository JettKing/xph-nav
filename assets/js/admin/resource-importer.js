import { XPH_RESOURCE_CONTRACT } from '/shared/resource-contract.js';

/* 徐胖虎资源社 V5.3 · Core Contract 01
 * 来源层：程序读取与交叉验证，不调用AI。
 * 决策层：DeepSeek只负责真实语义、合法分类、候选生成与最终选择；程序掌握候选修改权限与最终落盘。
 * 输出层：程序再次校验名称、URL、分类、Icon和严格16字符简介。
 */
(function(){
'use strict';
const KEY='xph_v53_resource_drafts';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=v=>String(v??'').trim(),uniq=a=>[...new Set((a||[]).map(txt).filter(Boolean))],count=v=>Array.from(txt(v)).length;
const normalizeUrl=v=>{try{const u=new URL(txt(v));u.hash='';return u.href.replace(/\/$/,'')||u.href}catch{return ''}};
const normalizeGithub=v=>{const m=txt(v).replace(/[)\]}>.,;]+$/g,'').match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);return m?`https://github.com/${m[1]}/${m[2].replace(/\.git$/i,'')}`:''};
const isGithubUrl=v=>!!normalizeGithub(v);
const normalizeWebsite=v=>{if(typeof v!=='string')return '';const u=normalizeUrl(v);if(!u)return '';try{const h=new URL(u).hostname.toLowerCase().replace(/^www\./,'');if(/(?:^|\.)github(?:usercontent)?\.com$/.test(h)||/^(?:githubassets\.com|gist\.github\.com)$/.test(h))return '';return u}catch{return ''}};
const normalizeSourceName=v=>{
  let x=txt(v).replace(/\s*(?:—|–|-|·|•|\||｜)\s*(?:the\s+)?(?:official\s+)?(?:website|github)\s*$/i,'').trim();
  const parts=x.split(/\s*(?:—|–|\||｜|·|•)\s*|:\s+/).map(v=>v.trim()).filter(Boolean);
  if(parts.length>1&&parts[0].length>=2&&parts[0].length<=40)x=parts[0];
  return x;
};
const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORIES=window.categories||{},TAGS=window.tags||{capabilities:[],scenarios:[],attributes:{pricing:[],platform:[],language:[],audience:[]}},RESOURCE_ICONS=window.XPH_RESOURCE_ICONS||{};
const state={source:null,resource:null,manualNameDirty:false,manualDescriptionDirty:false,loadingStage:'idle'};
const CONTRACT=XPH_RESOURCE_CONTRACT, STAGES=CONTRACT.stages;
function status(msg,type=''){const e=$('#status');e.textContent=msg;e.className='status '+type}
function setLoading(stage,msg){state.loadingStage=stage;status(msg,'busy');$('#fetchBtn').disabled=true;$('#analyzeBtn').disabled=true}
function apiError(data,fallback){const e=data?.error;if(e&&typeof e==='object')return e.message||fallback;if(typeof e==='string')return e;return fallback}
function assertResourceSchema(r){for(const key of CONTRACT.resourceSchema.required){if(!(key in r))throw new Error(`JSON字段缺失：${key}`)}if(!validClassification(r.category,r.subcategory))throw new Error('分类/子分类不符合统一词库');const mapped=iconForSubcategory(r.subcategory);if(!mapped||r.icon!==mapped)throw new Error('Icon未按统一子分类映射');if(!r.description||count(r.description)!==16)throw new Error('最终简介未通过16字验收');return r}
function timeoutFetch(url,options={},ms=30000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(url,{...options,signal:c.signal}).catch(e=>{if(e?.name==='AbortError')throw new Error('请求超时，请稍后重试');throw e}).finally(()=>clearTimeout(t))}
function categoryList(){return Object.entries(CATEGORIES).flatMap(([key,g])=>Object.entries(g.children||{}).map(([sub,label])=>({key,name:g.name,sub,label})))}
function categoryTaxonomy(){return categoryList().map(x=>({category:x.key,categoryName:x.name,subcategory:x.sub,subcategoryName:x.label}))}
function iconForSubcategory(sub){return RESOURCE_ICONS[txt(sub)]||''}
function validClassification(category,subcategory){const g=CATEGORIES?.[txt(category)];return !!(g&&g.children&&Object.prototype.hasOwnProperty.call(g.children,txt(subcategory)))}
function renderCategories(selected='',category=''){const s=$('#categorySelect');s.innerHTML=`<option value="">等待AI自动识别分类…</option>`+categoryList().map(x=>`<option value="${esc(x.key+'::'+x.sub)}" ${x.sub===selected&&(!category||x.key===category)?'selected':''}>${esc(x.name)} / ${esc(x.label)}</option>`).join('')}
function renderChips(id,items,type){const set=new Set(items||[]),allowed=vocab(type);$('#'+id).innerHTML=allowed.map(v=>`<button type="button" class="chip ${set.has(v)?'selected':''}" data-type="${esc(type)}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}
function vocab(type){return type==='capabilities'?TAGS.capabilities:type==='scenarios'?TAGS.scenarios:TAGS.attributes?.[type]||[]}
function selected(type){return $$(`.chip[data-type="${type}"].selected`).map(x=>x.dataset.value)}
function makeId(name,url){const base=(txt(name)||(()=>{try{return new URL(normalizeUrl(url)).hostname}catch{return 'resource'}})()).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g,'-').replace(/^-|-$/g,'').slice(0,48);return `${base||'resource'}-${Math.random().toString(36).slice(2,8)}`}
function applyClassification(category,subcategory,icon){if(!validClassification(category,subcategory))throw new Error('分类/子分类不符合统一词库');const mapped=iconForSubcategory(subcategory);if(!mapped||icon!==mapped)throw new Error('Icon与统一子分类映射不一致');const r=buildResource();r.category=category;r.subcategory=subcategory;r.icon=mapped;state.resource=r;renderCategories(subcategory,category);$('#categorySelect').value=`${category}::${subcategory}`;return r}
function buildResource(){const [cat,sub]=txt($('#categorySelect').value).split('::');const r=state.resource||{};const manualName=txt($('#resourceName').value);r.id=txt($('#resourceId').value)||r.id||makeId(manualName||state.source?.name,$('#resourceUrl').value||$('#resourceGithub').value);r.name=manualName||txt(state.source?.name);const manualWebsite=isGithubUrl($('#resourceUrl').value)?'':normalizeWebsite($('#resourceUrl').value);r.website=manualWebsite||normalizeWebsite(state.source?.website)||'';r.github=normalizeGithub($('#resourceGithub').value)||normalizeGithub(state.source?.github)||'';r.thumbnail=normalizeWebsite(state.source?.thumbnail)||r.thumbnail||'';r.description=txt($('#resourceDescription').value);r.category=cat||r.category||'website';r.subcategory=sub||r.subcategory||'website_tool';r.capabilities=selected('capabilities');r.scenarios=selected('scenarios');r.attributes={pricing:selected('pricing')[0]||'增值',platform:selected('platform'),language:selected('language'),audience:selected('audience')};r.audience=r.attributes.audience?.[0]||'';r.icon=iconForSubcategory(r.subcategory)||'';r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||'active';return r}
function renderResource(r){state.resource=r;renderCategories(r.subcategory,r.category);$('#resourceId').value=r.id||'';$('#resourceName').value=r.name||'';$('#resourceUrl').value=r.website||'';$('#resourceGithub').value=r.github||'';$('#resourceDescription').value=r.description||'';renderChips('capabilityChips',r.capabilities,'capabilities');renderChips('scenarioChips',r.scenarios,'scenarios');renderChips('pricingChips',[r.attributes?.pricing].filter(Boolean),'pricing');renderChips('platformChips',r.attributes?.platform,'platform');renderChips('languageChips',r.attributes?.language,'language');renderChips('audienceChips',r.attributes?.audience,'audience');$('#reviewPanel').classList.remove('hidden');$('#jsonPreview').textContent=JSON.stringify(r,null,2)}
async function readWebsite(url){const clean=normalizeWebsite(url);if(!clean)throw new Error('请输入有效官网 URL');const r=await timeoutFetch(`/api/source-read?url=${encodeURIComponent(clean)}`,{headers:{Accept:'application/json'}},30000);const envelope=await r.json().catch(()=>({}));if(!r.ok||envelope?.ok!==true)throw new Error(apiError(envelope,`官网读取失败：HTTP ${r.status}`));const data=envelope.data||{};return{website:normalizeWebsite(data.website)||clean,name:txt(data.name),github:normalizeGithub(data.github),githubCandidates:uniq((data.githubCandidates||[]).map(normalizeGithub).filter(Boolean)),thumbnail:normalizeWebsite(data.thumbnail),seoTitle:txt(data.seoTitle),seoDescription:txt(data.seoDescription),content:txt(data.content).slice(0,24000),source:'official-web-server'}}
async function readGithub(repo,{discoverName='',discoverWebsite=''}={}){const cleanRepo=normalizeGithub(repo);const qs=cleanRepo?`repo=${encodeURIComponent(cleanRepo)}`:`discoverName=${encodeURIComponent(discoverName)}&discoverWebsite=${encodeURIComponent(discoverWebsite)}`;const r=await timeoutFetch(`/api/github-read?${qs}`,{headers:{Accept:'application/json'}},30000);const envelope=await r.json().catch(()=>({}));if(!r.ok||envelope?.ok!==true)throw new Error(apiError(envelope,`GitHub读取失败：HTTP ${r.status}`));const data=envelope.data||{};return{github:normalizeGithub(data.github),name:txt(data.name),website:normalizeWebsite(data.website),thumbnail:'',seoTitle:txt(data.seoTitle),seoDescription:txt(data.seoDescription),content:txt(data.content).slice(0,24000),keywords:Array.isArray(data.keywords)?data.keywords:[],apiStatus:data.apiStatus||0,source:'github-server'}}
async function readRealSources(manualNameOverride=''){
  const rawUrl=txt($('#resourceUrl').value),rawGithub=txt($('#resourceGithub').value);const inputGithub=normalizeGithub(rawGithub)||normalizeGithub(rawUrl);const websiteInput=rawUrl&&!isGithubUrl(rawUrl)?normalizeWebsite(rawUrl):'';
  if(!websiteInput&&!inputGithub)throw new Error('请至少填写资源 URL 或 GitHub URL');
  let web=null,gh=null;
  const sourceErrors=[];
  // 官网读取失败时，如果同时存在GitHub，不阻断整条链路；反向读取仍继续。
  if(websiteInput){try{web=await readWebsite(websiteInput)}catch(e){sourceErrors.push(e?.message||'官网读取失败')}}
  // GitHub读取同样不把API错误视为整条流程失败；github-read会优先走网页/README。
  if(inputGithub){try{gh=await readGithub(inputGithub)}catch(e){sourceErrors.push(e?.message||'GitHub读取失败')}}
  if(!gh&&web){
    const directCandidates=uniq([web.github,...(web.githubCandidates||[])].map(normalizeGithub).filter(Boolean));
    for(const candidate of directCandidates){try{gh=await readGithub(candidate);if(gh)break}catch{}}
    if(!gh){try{gh=await readGithub('',{discoverName:web.name||web.seoTitle,discoverWebsite:web.website})}catch(e){sourceErrors.push(e?.message||'GitHub发现失败')}}
  }
  // GitHub反向发现官网：只接受GitHub读取层确认过的真实外部主页，不接受githubusercontent/camo等资源地址。
  if(gh?.website&&!web){try{web=await readWebsite(gh.website)}catch(e){sourceErrors.push(e?.message||'反向官网读取失败')}}
  const manualName=txt($('#resourceName').value);
  const sourceNames=uniq([txt(gh?.name),txt(web?.name)]);
  const canonicalGithubName=txt(gh?.name);
  const name=manualName||canonicalGithubName||sourceNames[0]||'';
  const website=normalizeWebsite(websiteInput)||normalizeWebsite(web?.website)||normalizeWebsite(gh?.website)||'';
  const github=inputGithub||normalizeGithub(gh?.github)||normalizeGithub(web?.github)||'';
  const content=[web?.content,gh?.content].filter(Boolean).join('\n\n--- GitHub ---\n').slice(0,30000);
  if(!name)throw new Error(sourceErrors[0]||'真实来源未读取到可靠资源名称');
  if(!website&&!github)throw new Error(sourceErrors[0]||'未能确认官方官网或GitHub来源');
  if(!content)throw new Error(sourceErrors[0]||'真实来源内容为空');
  return{website,github,name:normalizeSourceName(name),thumbnail:normalizeWebsite(web?.thumbnail)||'',seoTitle:txt(web?.seoTitle)||txt(gh?.seoTitle),seoDescription:txt(web?.seoDescription)||txt(gh?.seoDescription),githubName:normalizeSourceName(gh?.name),content,keywords:uniq([...(web?.keywords||[]),...(gh?.keywords||[])])};
}
function showRead(source){$('#readBox').classList.remove('hidden');$('#readName').textContent=source.name||'—';$('#readSource').textContent=source.website||'—';$('#readGithub').textContent=source.github||'未发现';$('#readThumb').textContent=source.thumbnail?'已读取':'未读取';$('#readContent').textContent=`已缓存 ${count(source.content)} 字符真实内容`}
function isValidDescription(value){const v=txt(value);if(count(v)!==16||!/[\u3400-\u9fff]/.test(v)||/^[A-Za-z0-9\s.,!?;:()[\]{}+\-_/&%#]+$/.test(v)||/[\r\n]/.test(v))return false;const cjk=Array.from(v).filter(ch=>/[\u3400-\u9fff]/.test(ch)).length;return cjk>=6&&!/(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备|一站式)/.test(v)}
async function readStep(){
  const manualName=state.manualNameDirty?txt($('#resourceName').value):'';
  setLoading(STAGES[0],'正在读取真实网页 / GitHub…');
  try{
    const s=await readRealSources(manualName);state.source=s;
    if(manualName){$('#resourceName').value=manualName;}else{$('#resourceName').value=s.name;state.manualNameDirty=false;}
    $('#resourceUrl').value=txt($('#resourceUrl').value)||s.website;$('#resourceGithub').value=txt($('#resourceGithub').value)||s.github;
    showRead(s);$('#jsonPreview').textContent='真实内容已读取并缓存。现在可以点击“智能分析并生成简介”。';
    $('#analyzeBtn').disabled=false;status('真实内容读取完成；尚未调用 DeepSeek。','ok');
  }catch(e){status(e.message||'读取失败')}finally{state.loadingStage='idle';$('#fetchBtn').disabled=false;$('#analyzeBtn').disabled=!state.source}
}
async function aiStep(){
  if(!state.source){status('请先点击“读取网页信息”');return}
  const manual=state.manualDescriptionDirty?txt($('#resourceDescription').value):'';
  setLoading(STAGES[1],'正在让 DeepSeek 理解真实内容…');
  try{
    const payload={name:state.source.name,website:state.source.website,github:state.source.github,seoTitle:state.source.seoTitle,seoDescription:state.source.seoDescription,githubName:state.source.githubName,content:state.source.content,manualDescription:manual,taxonomy:categoryTaxonomy(),iconMap:RESOURCE_ICONS};
    setLoading(STAGES[2],'正在最多5次独立生成候选简介…');
    const r=await timeoutFetch('/api/deepseek-description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},300000);
    const envelope=await r.json().catch(()=>({}));
    if(!r.ok||envelope?.ok!==true)throw new Error(apiError(envelope,`DeepSeek 代理 HTTP ${r.status}`));
    const data=envelope.data||{};
    if(data.contractVersion!==CONTRACT.version)throw new Error('前后端资源契约版本不一致，请勿继续写入');
    if(!validClassification(data.category,data.subcategory))throw new Error('分类/子分类不符合统一词库');
    if(data.icon!==iconForSubcategory(data.subcategory))throw new Error('Icon映射不一致');
    if(!manual){
      if(!Array.isArray(data.candidates)||data.candidates.length<1||data.candidates.length>CONTRACT.candidatePolicy.maxCandidates)throw new Error('候选池数量不符合统一协议');
      if(data.generationCalls>CONTRACT.candidatePolicy.maxAttempts)throw new Error('生成次数超过统一协议');
      if(!Number.isInteger(data.selectedIndex)||data.selectedIndex<1||data.selectedIndex>data.candidates.length)throw new Error('最终选择索引无效');
      const selected=data.candidates[data.selectedIndex-1];
      if(txt(data.description)!==txt(selected))throw new Error('AI最终选择结果与候选原文不一致');
      if(count(selected)!==16)throw new Error('最终简介未通过16字验收');
      setLoading(STAGES[5],'正在写入最终结果…');
      $('#resourceDescription').value=selected;state.manualDescriptionDirty=false;
      const resource=applyClassification(data.category,data.subcategory,data.icon);resource.description=selected;
      assertResourceSchema(resource);renderResource(resource);
      status(`AI分析完成：${CATEGORIES[data.category]?.name||data.category} / ${CATEGORIES[data.category]?.children?.[data.subcategory]||data.subcategory} · Icon ${resource.icon}`,'ok');
    }else{
      if(data.description!==manual)throw new Error('人工简介被意外修改');
      const resource=applyClassification(data.category,data.subcategory,data.icon);resource.description=manual;assertResourceSchema(resource);renderResource(resource);status('AI分析完成：分类与 Icon 已统一；人工简介保持原样。','ok');
    }
  }catch(e){status(e.message||'AI分析失败')}finally{state.loadingStage='idle';$('#fetchBtn').disabled=false;$('#analyzeBtn').disabled=!state.source}
}
function clean(r){const x=JSON.parse(JSON.stringify(r));delete x._meta;return x}
function saveDraft(){const r=buildResource(),all=JSON.parse(localStorage.getItem(KEY)||'[]'),i=all.findIndex(x=>x.id===r.id);if(i>=0)all[i]=r;else all.unshift(r);localStorage.setItem(KEY,JSON.stringify(all));loadDrafts();status('审核草稿已保存。','ok')}
function loadDrafts(){const all=JSON.parse(localStorage.getItem(KEY)||'[]');$('#draftSelect').innerHTML='<option value="">选择已保存草稿…</option>'+all.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('')}
function nativeJs(r){const n={id:r.id,name:r.name,description:r.description,icon:r.icon||'🔗',thumbnail:r.thumbnail||'',category:r.category,subcategory:r.subcategory,website:r.website,github:r.github,platform:(r.attributes?.platform||[]).join(' / '),pricing:r.attributes?.pricing||'增值',language:(r.attributes?.language||[]).join(' / '),features:r.features||[],capabilities:r.capabilities||[],scenarios:r.scenarios||[],attributes:r.attributes||{},audience:r.audience||'',official:!!r.official,recommend:!!r.recommend,status:r.status||'active'};return `,\n${JSON.stringify(n,null,4)}\n`}
function download(name,data,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function bind(){
  $('#resourceName').addEventListener('input',()=>{state.manualNameDirty=true});
  $('#resourceDescription').addEventListener('input',()=>{state.manualDescriptionDirty=true});
  renderCategories('');renderChips('capabilityChips',[],'capabilities');renderChips('scenarioChips',[],'scenarios');renderChips('pricingChips',[],'pricing');renderChips('platformChips',[],'platform');renderChips('languageChips',[],'language');renderChips('audienceChips',[],'audience');loadDrafts();$('#fetchBtn').onclick=readStep;$('#analyzeBtn').onclick=aiStep;$('#saveBtn').onclick=saveDraft;$('#resetBtn').onclick=()=>{state.source=null;state.resource=null;state.manualNameDirty=false;state.manualDescriptionDirty=false;$('#resourceName').value='';$('#resourceUrl').value='';$('#resourceGithub').value='';$('#resourceDescription').value='';$('#readBox').classList.add('hidden');$('#reviewPanel').classList.add('hidden');$('#analyzeBtn').disabled=true;$('#jsonPreview').textContent='完成网页读取后显示。';status('当前录入已清空')};$('#clearAllBtn').onclick=()=>{if(confirm('确定清空当前录入内容吗？历史草稿不会删除。'))$('#resetBtn').click()};$('#loadDraftBtn').onclick=()=>{const id=$('#draftSelect').value,all=JSON.parse(localStorage.getItem(KEY)||'[]'),r=all.find(x=>x.id===id);if(r){renderResource(r);status('草稿已载入。','ok')}};$('#clearDraftsBtn').onclick=()=>{localStorage.removeItem(KEY);loadDrafts();status('本机草稿已清空。','ok')};$('#exportJsonBtn').onclick=()=>{const r=assertResourceSchema(clean(buildResource()));download(`xph-resource-${r.id}.json`,JSON.stringify(r,null,2),'application/json')};$('#copyBtn').onclick=()=>navigator.clipboard?.writeText(JSON.stringify(assertResourceSchema(clean(buildResource())),null,2)).then(()=>status('JSON 已复制。','ok'));$('#exportJsBtn').onclick=()=>{const r=assertResourceSchema(clean(buildResource()));download(`xph-resource-${r.id}-${$('#exportTarget').value}-native.js`,nativeJs(r),'application/javascript')};$('#copyJsBtn').onclick=()=>navigator.clipboard?.writeText(nativeJs(assertResourceSchema(clean(buildResource())))).then(()=>status('JS 数据片段已复制。','ok'));$('#categorySelect').onchange=()=>{const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)};document.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;b.classList.toggle('selected');if(state.resource){const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)}});['resourceName','resourceUrl','resourceGithub','resourceDescription','resourceId'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(id==='resourceDescription'&&count($('#resourceDescription').value)>16)$('#resourceDescription').value=Array.from($('#resourceDescription').value).slice(0,16).join('');if(state.resource){const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)}}))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();