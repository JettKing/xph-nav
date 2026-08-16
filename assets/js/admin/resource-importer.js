/* 徐胖虎资源社 V19 · Core Decision Rebuild
 * 1) 读取层只读取真实网页 / GitHub，不调用 AI。
 * 2) 名称只来自真实来源，不翻译、不中文化、不交给 DeepSeek 修改。
 * 3) 简介生成层只把已经读取并缓存的真实内容交给 Cloudflare Function。
 * 4) thumbnail 不在 UI 输入，但读取后继续保留到最终 JSON。
 */
(function(){
'use strict';
const KEY='xph_v53_resource_drafts';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=v=>String(v??'').trim(),uniq=a=>[...new Set((a||[]).map(txt).filter(Boolean))];
const count=v=>Array.from(txt(v)).length;
const normalizeUrl=v=>{try{const u=new URL(txt(v));u.hash='';return u.href.replace(/\/$/,'')||u.href}catch{return txt(v).replace(/#.*$/,'').replace(/\/+$/,'')}};
const normalizeGithub=v=>{const m=txt(v).replace(/[)\]}>.,;]+$/g,'').match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);return m?`https://github.com/${m[1]}/${m[2].replace(/\.git$/i,'')}`:''};
const isGithubUrl=v=>!!normalizeGithub(v);
const normalizeWebsite=v=>{if(typeof v!=='string')return '';const u=normalizeUrl(v);if(!u)return '';try{const host=new URL(u).hostname.toLowerCase().replace(/^www\./,'');if(/(?:^|\.)github(?:usercontent)?\.com$/.test(host)||host==='github.com'||host==='gist.github.com'||host==='githubassets.com')return '';return u}catch{return ''}};
const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORIES=window.categories||{};const TAGS=window.tags||{capabilities:[],scenarios:[],attributes:{pricing:[],platform:[],language:[],audience:[]}};const RESOURCE_ICONS=window.XPH_RESOURCE_ICONS||{};
const state={reading:null,resource:null,source:null};
function status(msg,type=''){const e=$('#status');e.textContent=msg;e.className='status '+type}
function timeoutFetch(url,options={},ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);return fetch(url,{...options,signal:c.signal}).catch(e=>{if(e?.name==='AbortError')throw new Error('请求超时，请稍后重试');throw e}).finally(()=>clearTimeout(t))}
function categoryList(){return Object.entries(CATEGORIES).flatMap(([key,g])=>Object.entries(g.children||{}).map(([sub,label])=>({key,name:g.name,sub,label})))}
function categoryTaxonomy(){return categoryList().map(x=>({category:x.key,categoryName:x.name,subcategory:x.sub,subcategoryName:x.label}))}
function iconForSubcategory(sub){return RESOURCE_ICONS[txt(sub)]||''}
function parentIcon(category){return txt(CATEGORIES?.[category]?.icon)||''}
function validClassification(category,subcategory){const c=txt(category),s=txt(subcategory);const group=CATEGORIES?.[c];return !!(group&&group.children&&Object.prototype.hasOwnProperty.call(group.children,s))}
function applyClassification(category,subcategory){if(!validClassification(category,subcategory))throw new Error('AI 返回了不在现有分类词库中的分类');renderCategories(subcategory,category);const r=buildResource();r.category=category;r.subcategory=subcategory;r.icon=iconForSubcategory(subcategory)||parentIcon(category)||r.icon||'🔗';state.resource=r;$('#categorySelect').value=`${category}::${subcategory}`;return r}
function vocab(type){return type==='capabilities'?TAGS.capabilities:type==='scenarios'?TAGS.scenarios:TAGS.attributes?.[type]||[]}
function renderCategories(selected='',category=''){const s=$('#categorySelect');s.innerHTML=`<option value="">等待AI自动识别分类…</option>`+categoryList().map(x=>`<option value="${esc(x.key+'::'+x.sub)}" ${x.sub===selected&&(!category||x.key===category)?'selected':''}>${esc(x.name)} / ${esc(x.label)}</option>`).join('')}
function renderChips(id,items,type){const set=new Set(items||[]),allowed=vocab(type);$('#'+id).innerHTML=allowed.map(v=>`<button type="button" class="chip ${set.has(v)?'selected':''}" data-type="${esc(type)}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}
function selected(type){return $$(`.chip[data-type="${type}"].selected`).map(x=>x.dataset.value)}
function makeId(name,url){const base=(txt(name)||new URL(normalizeUrl(url)).hostname).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g,'-').replace(/^-|-$/g,'').slice(0,48);return `${base||'resource'}-${Math.random().toString(36).slice(2,8)}`}
async function readWebsite(url){
  const clean=normalizeWebsite(url);
  if(!clean)throw new Error('请输入有效官网 URL');
  const r=await timeoutFetch(`/api/source-read?url=${encodeURIComponent(clean)}`,{headers:{Accept:'application/json'}},30000);
  const data=await r.json().catch(()=>({}));
  if(!r.ok || typeof data?.content!=='string' || !data.content){
    throw new Error(data?.error||`官网读取失败：HTTP ${r.status}`);
  }
  return {
    website:normalizeWebsite(data.website||data.finalUrl||clean),
    name:txt(data.name),
    github:normalizeGithub(data.github),
    thumbnail:normalizeWebsite(data.thumbnail),
    seoTitle:txt(data.seoTitle),
    seoDescription:txt(data.seoDescription),
    content:txt(data.content).slice(0,24000),
    source:'official-web-server'
  };
}

async function readGithub(url){
  const repo=normalizeGithub(url);
  if(!repo)throw new Error('GitHub URL 无效');
  const r=await timeoutFetch(`/api/github-read?repo=${encodeURIComponent(repo)}`,{headers:{Accept:'application/json'}},30000);
  const data=await r.json().catch(()=>({}));
  if(!r.ok || typeof data?.content!=='string' || !data.content){
    throw new Error(data?.error||`GitHub 读取失败：HTTP ${r.status}`);
  }
  return {
    github:repo,
    name:txt(data.name),
    website:normalizeWebsite(data.website),
    thumbnail:normalizeWebsite(data.thumbnail),
    seoTitle:txt(data.seoTitle),
    seoDescription:txt(data.seoDescription),
    content:txt(data.content).slice(0,24000),
    source:'github',
    keywords:Array.isArray(data.keywords)?data.keywords:[],
    apiStatus:data.apiStatus||0
  };
}

async function readRealSources(){
  const rawUrl=txt($('#resourceUrl').value);
  const url=normalizeUrl(rawUrl);
  const githubInput=normalizeGithub($('#resourceGithub').value);
  const inputGithub=githubInput||normalizeGithub(rawUrl);
  const websiteInput=url&&!isGithubUrl(url)?normalizeWebsite(url):'';
  if(!websiteInput&&!inputGithub)throw new Error('请至少填写资源 URL 或 GitHub URL');

  let web=null,gh=null;
  const errors=[];

  // 官网入口：服务器负责真实网页读取，并在同一次读取中发现 GitHub。
  if(websiteInput){
    try{web=await readWebsite(websiteInput)}catch(e){errors.push(e);}
  }

  // GitHub入口：服务器负责 API/HTML/README 多源读取，API 403 不应终止整个链路。
  if(inputGithub){
    try{gh=await readGithub(inputGithub)}catch(e){errors.push(e);}
  }

  // 官网 → GitHub：只接受服务器读取层确认的真实仓库地址。
  if(web?.github && !gh){
    try{gh=await readGithub(web.github)}catch(e){errors.push(e);}
  }

  // GitHub → 官网：只接受 GitHub 读取层返回的合法官方主页；随后再次读取官网真实内容。
  if(gh?.website && !web){
    try{web=await readWebsite(gh.website)}catch(e){errors.push(e);}
  }

  const isHostnameName=(name,url)=>{
    const n=txt(name).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
    try{return !!url&&n===new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return false}
  };
  const webName=txt(web?.name),ghName=txt(gh?.name);
  const generic=/^(?:home|homepage|official website|website|open source|open-source|the open source|free|welcome)$/i;
  const webUsable=webName&&!isHostnameName(webName,web?.website)&&!generic.test(webName);
  const ghUsable=ghName&&!isHostnameName(ghName,gh?.github)&&!generic.test(ghName);
  const preferredName=webUsable?webName:(ghUsable?ghName:(webName||ghName||''));

  const officialWebsite=normalizeWebsite(web?.website)||normalizeWebsite(gh?.website)||'';
  const officialGithub=normalizeGithub(gh?.github)||normalizeGithub(web?.github)||inputGithub||'';
  const source={
    website:officialWebsite,
    name:preferredName,
    github:officialGithub,
    thumbnail:normalizeWebsite(web?.thumbnail)||normalizeWebsite(gh?.thumbnail)||'',
    seoTitle:txt(web?.seoTitle)||txt(gh?.seoTitle),
    seoDescription:txt(web?.seoDescription)||txt(gh?.seoDescription),
    githubName:ghName,
    content:[web?.content,gh?.content].filter(x=>typeof x==='string'&&x.trim()).join('\n\n--- GitHub真实内容 ---\n').slice(0,24000),
    source:web?'official-web':'github',
    githubContent:typeof gh?.content==='string'?gh.content:'',
    keywords:uniq([...(web?.keywords||[]),...(gh?.keywords||[])])
  };
  if(!source.name)throw new Error(errors[0]?.message||'真实来源未读取到资源名称');
  if(!source.website&&!source.github)throw new Error(errors[0]?.message||'真实来源读取失败');
  if(typeof source.website!=='string'||typeof source.github!=='string')throw new Error('来源字段类型异常，已阻止写入最终数据');
  return source;
}
function showRead(source){$('#readBox').classList.remove('hidden');$('#readName').textContent=source.name||'—';$('#readSource').textContent=source.website||'—';$('#readGithub').textContent=source.github||'未发现';$('#readThumb').textContent=source.thumbnail?'已读取':'未读取';$('#readContent').textContent=`已缓存 ${count(source.content)} 字符真实内容`;}
function inputGithubSafe(){return normalizeGithub($('#resourceGithub').value)||normalizeGithub($('#resourceUrl').value)||'';}
function buildResource(extra={}){const [cat,sub]=txt($('#categorySelect').value).split('::');const r=state.resource||{};const manualName=txt($('#resourceName').value);const sourceName=txt(state.source?.name);const finalName=manualName||sourceName;r.id=txt($('#resourceId').value)||r.id||makeId(finalName,$('#resourceUrl').value||$('#resourceGithub').value);r.name=finalName;const manualWebsiteInput=txt($('#resourceUrl').value);const manualWebsite=!isGithubUrl(manualWebsiteInput)?normalizeWebsite(manualWebsiteInput):'';r.website=manualWebsite||normalizeWebsite(state.source?.website)||'';r.github=normalizeGithub($('#resourceGithub').value)||normalizeGithub(state.source?.github)||inputGithubSafe();r.thumbnail=state.source?.thumbnail||r.thumbnail||'';r.description=txt($('#resourceDescription').value);r.category=cat||'website';r.subcategory=sub||'website_tool';r.capabilities=selected('capabilities');r.scenarios=selected('scenarios');r.attributes={pricing:selected('pricing')[0]||'增值',platform:selected('platform'),language:selected('language'),audience:selected('audience')};r.audience=r.attributes.audience?.[0]||'';r.icon=iconForSubcategory(sub)||r.icon||parentIcon(cat)||'🔗';r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||'active';return r}
function renderResource(r){state.resource=r;renderCategories(r.subcategory,r.category);$('#resourceId').value=r.id||'';$('#resourceName').value=r.name||'';$('#resourceUrl').value=r.website||'';$('#resourceGithub').value=r.github||'';$('#resourceDescription').value=r.description||'';renderChips('capabilityChips',r.capabilities,'capabilities');renderChips('scenarioChips',r.scenarios,'scenarios');renderChips('pricingChips',[r.attributes?.pricing].filter(Boolean),'pricing');renderChips('platformChips',r.attributes?.platform,'platform');renderChips('languageChips',r.attributes?.language,'language');renderChips('audienceChips',r.attributes?.audience,'audience');$('#reviewPanel').classList.remove('hidden');$('#jsonPreview').textContent=JSON.stringify(r,null,2);}
async function readStep(){const name=txt($('#resourceName').value);status('正在读取真实网页 / GitHub…','busy');$('#fetchBtn').disabled=true;$('#analyzeBtn').disabled=true;try{const s=await readRealSources();state.source=s;if(name)$('#resourceName').value=name;else $('#resourceName').value=s.name;$('#resourceUrl').value=txt($('#resourceUrl').value)||s.website;$('#resourceGithub').value=txt($('#resourceGithub').value)||s.github;showRead(s);$('#jsonPreview').textContent='真实内容已读取并缓存。现在可以点击“智能分析并生成简介”。';$('#analyzeBtn').disabled=false;status('真实内容读取完成；尚未调用 DeepSeek。','ok')}catch(e){status(e.message||'读取失败')}finally{$('#fetchBtn').disabled=false}}
function isValidDescription(value){const v=txt(value);if(count(v)!==16||!/[\u3400-\u9fff]/.test(v)||/^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v)||/[\r\n]/.test(v))return false;const cjk=count(v.replace(/[^\u3400-\u9fff]/g,''));if(cjk<6)return false;return !/(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备)/.test(v)}
async function aiStep(){if(!state.source){status('请先点击“读取网页信息”');return}const manual=txt($('#resourceDescription').value);status('正在让 DeepSeek 分析真实内容、分类并生成简介（最多5轮 × 5候选）…','busy');$('#analyzeBtn').disabled=true;try{const payload={name:state.source.name,website:state.source.website,github:state.source.github,seoTitle:state.source.seoTitle,seoDescription:state.source.seoDescription,githubName:state.source.githubName,content:state.source.content,manualDescription:manual,taxonomy:categoryTaxonomy()};const r=await timeoutFetch('/api/deepseek-description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},300000);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`DeepSeek 代理 HTTP ${r.status}`);const desc=txt(data.description);if(manual){if(desc!==manual)throw new Error('AI 未按规则原样保留人工简介')}else if(!isValidDescription(desc))throw new Error(`DeepSeek 返回简介长度/格式不合格：${count(desc)} 字符`);if(!validClassification(data.category,data.subcategory))throw new Error('DeepSeek 返回的分类不在现有合法分类词库中');if(!manual)$('#resourceDescription').value=desc;const resource=applyClassification(data.category,data.subcategory);resource.description=manual||desc;resource.icon=iconForSubcategory(data.subcategory)||parentIcon(data.category)||resource.icon||'🔗';renderResource(resource);status(`AI分析完成：${CATEGORIES[data.category]?.name||data.category} / ${CATEGORIES[data.category]?.children?.[data.subcategory]||data.subcategory} · Icon ${resource.icon}`,'ok')}catch(e){status(e.message||'DeepSeek 分析失败')}finally{$('#analyzeBtn').disabled=false}}
function clean(r){const x=JSON.parse(JSON.stringify(r));delete x._meta;return x}
function saveDraft(){const r=buildResource(),all=JSON.parse(localStorage.getItem(KEY)||'[]'),i=all.findIndex(x=>x.id===r.id);if(i>=0)all[i]=r;else all.unshift(r);localStorage.setItem(KEY,JSON.stringify(all));loadDrafts();status('审核草稿已保存。','ok')}
function loadDrafts(){const all=JSON.parse(localStorage.getItem(KEY)||'[]');$('#draftSelect').innerHTML='<option value="">选择已保存草稿…</option>'+all.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('')}
function nativeJs(r){const t=$('#exportTarget').value||r.category;const n={id:r.id,name:r.name,description:r.description,icon:r.icon||'🔗',thumbnail:r.thumbnail||'',category:r.category,subcategory:r.subcategory,website:r.website,github:r.github,platform:(r.attributes?.platform||[]).join(' / '),pricing:r.attributes?.pricing||'增值',language:(r.attributes?.language||[]).join(' / '),features:r.features||[],capabilities:r.capabilities||[],scenarios:r.scenarios||[],attributes:r.attributes||{},audience:r.audience||'',official:!!r.official,recommend:!!r.recommend,status:r.status||'active'};return `,\n${JSON.stringify(n,null,4)}\n`}
function download(name,data,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function bind(){renderCategories('');renderChips('capabilityChips',[],'capabilities');renderChips('scenarioChips',[],'scenarios');renderChips('pricingChips',[],'pricing');renderChips('platformChips',[],'platform');renderChips('languageChips',[],'language');renderChips('audienceChips',[],'audience');loadDrafts();
$('#fetchBtn').onclick=readStep;$('#analyzeBtn').onclick=aiStep;$('#saveBtn').onclick=saveDraft;
$('#resetBtn').onclick=()=>{state.source=null;state.resource=null;$('#resourceName').value='';$('#resourceUrl').value='';$('#resourceGithub').value='';$('#resourceDescription').value='';$('#readBox').classList.add('hidden');$('#reviewPanel').classList.add('hidden');$('#analyzeBtn').disabled=true;$('#jsonPreview').textContent='完成网页读取后显示。';status('当前录入已清空')};
$('#clearAllBtn').onclick=()=>{if(confirm('确定清空当前录入内容吗？历史草稿不会删除。'))$('#resetBtn').click()};
$('#loadDraftBtn').onclick=()=>{const id=$('#draftSelect').value,all=JSON.parse(localStorage.getItem(KEY)||'[]'),r=all.find(x=>x.id===id);if(r){renderResource(r);status('草稿已载入。','ok')}};
$('#clearDraftsBtn').onclick=()=>{localStorage.removeItem(KEY);loadDrafts();status('本机草稿已清空。','ok')};
$('#exportJsonBtn').onclick=()=>{const r=clean(buildResource());download(`xph-resource-${r.id}.json`,JSON.stringify(r,null,2),'application/json')};$('#copyBtn').onclick=()=>navigator.clipboard?.writeText(JSON.stringify(clean(buildResource()),null,2)).then(()=>status('JSON 已复制。','ok'));$('#exportJsBtn').onclick=()=>{const r=clean(buildResource());download(`xph-resource-${r.id}-${$('#exportTarget').value}-native.js`,nativeJs(r),'application/javascript')};$('#copyJsBtn').onclick=()=>navigator.clipboard?.writeText(nativeJs(clean(buildResource()))).then(()=>status('JS 数据片段已复制。','ok'));
$('#categorySelect').onchange=()=>{const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)};
document.addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;b.classList.toggle('selected');if(state.resource){const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)}});
['resourceName','resourceUrl','resourceGithub','resourceDescription','resourceId'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(id==='resourceDescription'&&count($('#resourceDescription').value)>16)$('#resourceDescription').value=Array.from($('#resourceDescription').value).slice(0,16).join('');if(state.resource){const r=buildResource();$('#jsonPreview').textContent=JSON.stringify(r,null,2)}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();