/* 徐胖虎资源社 V5.3 · DeepSeek Flow Rebuild
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
async function githubApi(repo){
  try{
    const r=await timeoutFetch(`https://api.github.com/repos/${repo.split('/').slice(-2).join('/')}`,{headers:{Accept:'application/vnd.github+json'}},10000);
    if(!r.ok)return{ok:false,status:r.status,data:null};
    return{ok:true,status:r.status,data:await r.json()};
  }catch{return{ok:false,status:0,data:null}}
}
function extractGithubLinks(raw){
  const text=String(raw||'').replace(/&amp;/gi,'&').replace(/\\\//g,'/');
  const found=[];
  const add=v=>{const u=normalizeGithub(v);if(u)found.push(u)};
  // Markdown links: [GitHub](https://github.com/owner/repo)
  for(const m of text.matchAll(/\[[^\]]{0,120}\]\((https?:\/\/(?:www\.)?github\.com\/[^)\s]+)\)/gi)) add(m[1]);
  // HTML hrefs and plain absolute URLs.
  for(const m of text.matchAll(/(?:href\s*=\s*[\"']|^|[\s(<\"'=])(https?:\/\/(?:www\.)?github\.com\/[^\s<>\]\)\"']+)/gim)) add(m[1]);
  // Bare github.com/owner/repo forms.
  for(const m of text.matchAll(/(?:^|[\s(<\"'=])((?:www\.)?github\.com\/[^\s<>\]\)\"']+)/gim)) add(m[1]);
  return uniq(found);
}
function isGithubAssetHost(host){
  const h=String(host||'').toLowerCase().replace(/^www\./,'');
  return /^(?:camo\.githubusercontent\.com|raw\.githubusercontent\.com|objects\.githubusercontent\.com|user-images\.githubusercontent\.com|avatars\.githubusercontent\.com|githubassets\.com|github\.com|gist\.github\.com)$/.test(h);
}
function isValidHomepageUrl(value){
  try{
    const u=new URL(normalizeUrl(value));
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(!/^https?:$/.test(u.protocol) || !host || isGithubAssetHost(host)) return false;
    if(/(?:^|\.)githubusercontent\.com$/.test(host)) return false;
    return true;
  }catch{return false}
}
function extractExternalLinks(raw){
  const text=String(raw||'').replace(/&amp;/gi,'&').replace(/\\\//g,'/');
  const found=[];
  const add=v=>{try{const u=normalizeUrl(v);if(isValidHomepageUrl(u))found.push(u)}catch{}};
  for(const m of text.matchAll(/\[[^\]]{0,160}\]\((https?:\/\/[^)\s]+)\)/gi)) add(m[1]);
  for(const m of text.matchAll(/(?:href\s*=\s*[\"']|^|[\s(<\"'=])(https?:\/\/[^\s<>\]\)\"']+)/gim)) add(m[1]);
  for(const m of text.matchAll(/https?:\/\/[^\s<>\]\)\"']+/gi)) add(m[0]);
  return uniq(found);
}
function extractGithubHomepage(raw,repo=''){
  const text=String(raw||'').replace(/&amp;/gi,'&').replace(/\\\//g,'/');
  const labeled=[
    /(?:homepage|home page|website|官网|项目主页|official website|official site)\s*(?:[:：]|[-–—])?\s*(https?:\/\/(?!github\.com)[^\s<>)"']+)/i,
    /(?:homepage|home page|website|官网|项目主页|official website|official site)[^\n]{0,200}?(https?:\/\/(?!github\.com)[^\s<>)"']+)/i
  ];
  for(const re of labeled){
    const m=text.match(re);
    if(m && isValidHomepageUrl(m[1])) return normalizeUrl(m[1]);
  }
  const links=extractExternalLinks(text);
  if(!links.length)return '';
  let target='';
  try{target=(repo.match(/github\.com\/[^/]+\/([^/?#]+)/i)?.[1]||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}catch{}
  const scored=links.map(u=>{
    let score=0;
    try{
      const host=new URL(u).hostname.toLowerCase().replace(/^www\./,'');
      const compactHost=host.replace(/[^a-z0-9]+/g,'');
      const root=host.split('.').slice(-2).join('.').replace(/[^a-z0-9]+/g,'');
      if(target && root===target)score+=140;
      else if(target && root.includes(target))score+=100;
      if(target && compactHost.includes(target))score+=40;
      if(/^(?:docs|doc|developer|developers|careers|blog|status|support)\./.test(host))score-=35;
      if(/(?:discord\.(?:gg|com)|twitter\.com|x\.com|linkedin\.com|youtube\.com|twitch\.tv|npmjs\.com|pypi\.org|medium\.com)/.test(host))score-=100;
    }catch{}
    return{u,score};
  }).sort((a,b)=>b.score-a.score);
  // Never choose an arbitrary external asset/link from a GitHub page.
  return scored[0]?.score>=80 ? scored[0].u : '';
}
async function githubReadme(repo){try{const m=repo.match(/github\.com\/([^/]+\/[^/]+)/i);if(!m)return '';const r=await timeoutFetch(`https://raw.githubusercontent.com/${m[1]}/HEAD/README.md`,{headers:{Accept:'text/plain'}},10000);return r.ok?(await r.text()).slice(0,18000):''}catch{return ''}}
async function discoverGithubBySearch(name,website){
  const q=txt(name)||(()=>{try{return new URL(website).hostname.replace(/^www\./,'')}catch{return ''}})();
  if(!q)return '';
  try{
    const searchUrl=`https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`;
    const r=await timeoutFetch('https://r.jina.ai/'+searchUrl,{headers:{Accept:'text/plain'}},18000);
    if(!r.ok)return '';
    const raw=await r.text();
    const links=extractGithubLinks(raw);
    const target=q.toLowerCase().replace(/[^a-z0-9]+/g,'');
    const scored=links.map(u=>{const repo=u.split('/').pop().toLowerCase().replace(/[^a-z0-9]+/g,'');let score=0;if(repo===target)score+=100;if(repo.includes(target)||target.includes(repo))score+=25;return{u,score}}).sort((a,b)=>b.score-a.score);
    return scored[0]?.score>=100?scored[0].u:'';
  }catch{return ''}
}

async function readGithubPage(repo){
  try{
    const r=await timeoutFetch('https://r.jina.ai/'+normalizeUrl(repo),{headers:{Accept:'text/plain'}},18000);
    if(!r.ok)return{raw:'',website:''};
    const raw=await r.text();
    const pageInfo=extractPageInfo(raw,repo);
    const website=extractGithubHomepage(raw,repo);
    return{raw:raw.slice(0,18000),website,name:pageInfo.name,seoTitle:pageInfo.seoTitle,seoDescription:pageInfo.seoDescription};
  }catch{return{raw:'',website:''}}
}
function cleanText(v){return txt(v).replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/[`*_>#~]/g,' ').replace(/\s+/g,' ').trim()}
function cleanName(v){
  let x=cleanText(v).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,' ').replace(/^[-–—•·|:：]+|[-–—•·|:：]+$/g,'').trim();
  const parts=x.split(/\s+(?:—|–|\||·)\s+|\s*[:：]\s+(?=\S)|\s+-\s+/).map(t=>t.trim()).filter(Boolean);
  if(parts.length>1){
    const generic=/\b(?:the\s+)?(?:best|free|open[- ]?source|official|website|homepage|platform|tool|software|project|app|workspace|alternative|for|powered|built|made)\b|(?:截图|转码|文件传输|项目管理|协作|视频|rss|阅读器|工具|平台|软件|工作台)/i;
    const cleanParts=parts.map(part=>({part,score:(generic.test(part)?-30:0)-(part.length>48?20:0)-(part.length>32?10:0)}));
    cleanParts.sort((a,b)=>b.score-a.score||a.part.length-b.part.length);
    x=cleanParts[0].part;
  }
  x=x.replace(/^[-–—•·|:：]+|[-–—•·|:：]+$/g,'').trim();
  x=x.replace(/\s+(?:[-–—|:]\s*)?(?:the\s+)?(?:official\s+)?(?:website|homepage)\s*$/i,'').trim();
  return x.replace(/^[-–—•·|:：]+|[-–—•·|:：]+$/g,'').trim();
}
function isBadName(v,url){
  const x=txt(v); if(!x)return true;
  try{
    const host=new URL(url||'').hostname.replace(/^www\./,'').toLowerCase();
    const n=x.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
    if(host && n===host)return true;
  }catch{}
  return /^(home|homepage|official website|website|menu|navigation|untitled|welcome|登录|首页|主页)$/i.test(x);
}
function extractPageInfo(md,url){
  const text=String(md||'').replace(/\r/g,'');
  const candidates=[];
  const add=(v,priority=0)=>{const x=cleanName(v);if(x&&x.length<=80&&!isBadName(x,url))candidates.push({value:x,priority})};
  const titleMatch=text.match(/^(?:Title|标题)\s*[:：]\s*(.+)$/im);
  const siteName=text.match(/(?:og:site_name|application-name)\s*[=:]\s*["']?([^"'\n>]+)["']?/i);
  const ogTitle=text.match(/(?:og:title|twitter:title)\s*[=:]\s*["']?([^"'\n>]+)["']?/i);
  const titleTag=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDesc=text.match(/(?:meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']+)|meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'])/i);
  if(siteName)add(siteName[1],120);
  if(titleMatch)add(titleMatch[1],110);
  if(ogTitle)add(ogTitle[1],100);
  if(titleTag)add(titleTag[1],90);
  for(const re of [/^#\s+(.+)$/m,/^##\s+(.+)$/m,/^###\s+(.+)$/m]){const m=text.match(re);if(m)add(m[1],70)}
  const first=text.split('\n').map(x=>cleanText(x)).find(x=>x&&x.length>=2&&!/^https?:\/\//i.test(x)&&!/^(home|首页|menu|导航|skip to content)$/i.test(x)&&x.length<=120);
  if(first)add(first,20);
  const name=candidates.sort((a,b)=>b.priority-a.priority)[0]?.value||'';
  const hostname=(()=>{try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}})();
  const seoTitle=cleanText(titleMatch?.[1]||ogTitle?.[1]||titleTag?.[1]||'');
  const seoDescription=cleanText(metaDesc?.[1]||metaDesc?.[2]||(text.match(/^(?:Description|Meta Description|描述)\s*[:：]\s*(.+)$/im)||[])[1]||'');
  return{name,seoTitle,seoDescription,hostname};
}
function extractTitle(md,url){return extractPageInfo(md,url).name}
async function readWebsite(url){
  const clean=normalizeUrl(url);
  if(!/^https?:\/\//i.test(clean))throw new Error('请输入有效 URL');
  let r;
  try{r=await timeoutFetch('https://r.jina.ai/'+clean,{headers:{Accept:'text/plain'}},18000)}catch(e){throw new Error(e.name==='AbortError'?'网页读取超时':'网页读取失败')}
  if(!r.ok)throw new Error('网页读取失败：HTTP '+r.status);
  const raw=await r.text();
  const info=extractPageInfo(raw,clean);
  const links=extractGithubLinks(raw);
  const thumb=(raw.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i)||[])[1]||'';
  return{website:clean,name:info.name,seoTitle:info.seoTitle,seoDescription:info.seoDescription,github:links[0]||'',thumbnail:thumb,content:raw.slice(0,22000),source:'official-web'};
}
function githubDisplayName(repo){
  const slug=txt(repo).match(/github\.com\/[^/]+\/([^/?#]+)/i)?.[1]||'';
  return cleanName(slug.replace(/[-_]+/g,' '));
}
async function readGithub(url){
  const repo=normalizeGithub(url);
  if(!repo)throw new Error('GitHub URL 无效');
  // GitHub网页 + README 是主通道；REST API 只做补充，403/限流不能阻断反向读取。
  const page=await readGithubPage(repo);
  const readme=await githubReadme(repo);
  let api={ok:false,status:0,data:null};
  if(!page.raw || !page.website || !page.name) api=await githubApi(repo);
  const d=api.data||{};
  const readmeInfo=extractPageInfo(readme,repo);
  const readmeName=readmeInfo.name;
  const slugName=githubDisplayName(repo);
  const pageName=txt(page.name);
  // GitHub 页面偶尔会被 Jina 的页面导航/图片元数据误识别成“Published Time”等无关文本。
  // 对明显导航/时间/图片类候选直接回退到仓库 slug，而不是把错误名称传给 AI。
  const suspiciousGithubName=/^(?:published time|updated time|created time|release time|commit time|view raw|raw|source|image|download|home|homepage|website|menu|navigation)$/i;
  const safeName=v=>{
    const x=txt(v);
    return x && !suspiciousGithubName.test(x) && x.length<=80 ? x : '';
  };
  const name=safeName(d.name)||safeName(readmeName)||safeName(pageName)||slugName||repo.split('/').pop();
  // 官网识别顺序：API homepage → README 明确/高置信外链 → GitHub 页面明确/高置信外链。
  // 严禁把 camo/raw.githubusercontent.com 等图片/资源地址当官网。
  const apiHomepage=isValidHomepageUrl(d.homepage)?normalizeUrl(d.homepage):'';
  const readmeHomepage=extractGithubHomepage(readme,repo);
  const pageHomepage=extractGithubHomepage(page.raw,repo);
  const website=apiHomepage||readmeHomepage||pageHomepage||'';
  const description=txt(d.description);
  const pageInfo=[txt(page.raw),description,readme].filter(Boolean).join('\n\n--- GitHub README ---\n').slice(0,22000);
  if(!pageInfo)throw new Error('GitHub 真实内容读取失败，请稍后重试');
  return{github:repo,name,website,thumbnail:'',seoTitle:txt(page.seoTitle)||'',seoDescription:txt(page.seoDescription)||'',content:pageInfo,source:'github',keywords:Array.isArray(d.topics)?d.topics:[],apiStatus:api.status||0};
}
async function readRealSources(){
  const url=normalizeUrl($('#resourceUrl').value);
  const githubInput=normalizeGithub($('#resourceGithub').value);
  const inputGithub=githubInput||normalizeGithub(url);
  if(!url&&!inputGithub)throw new Error('请至少填写资源 URL 或 GitHub URL');
  let web=null,gh=null;
  if(url&&!normalizeGithub(url)){try{web=await readWebsite(url)}catch(e){if(!inputGithub)throw e}}
  if(inputGithub){gh=await readGithub(inputGithub)}
  // 官网 -> GitHub：先用页面真实链接；页面解析不到时，再用 GitHub 公共搜索按真实名称发现仓库。
  if(!gh&&web){
    let discovered=normalizeGithub(web.github);
    if(!discovered) discovered=await discoverGithubBySearch(web.name||web.seoTitle,web.website);
    if(discovered){try{gh=await readGithub(discovered)}catch{}}
  }
  // GitHub -> 官网：优先仓库 About/API，其次 README；成功发现后再读取官网真实内容。
  if(gh?.website&&!web){try{web=await readWebsite(gh.website)}catch{}}
  const isHostnameName=(name,url)=>{const n=txt(name).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');try{return !!url&&n===new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return false}};
  const webName=txt(web?.name);
  const ghName=txt(gh?.name);
  const webNameLooksGeneric=/^(?:home|homepage|official website|website|open source|open-source|the open source|free|welcome)$/i.test(webName)||/\b(?:best|free|open[- ]?source)\b.*\b(?:tool|software|platform|website)\b/i.test(webName);
  const preferredName=(webName && !isHostnameName(webName,web?.website) && !webNameLooksGeneric)?webName:(ghName&&!isHostnameName(ghName,gh?.github)?ghName:(webName||ghName||''));
  const source={website:txt(web?.website)||txt(gh?.website)||'',name:preferredName,github:txt(gh?.github)||txt(web?.github)||inputGithub||'',thumbnail:txt(web?.thumbnail)||'',seoTitle:txt(web?.seoTitle)||txt(gh?.seoTitle)||'',seoDescription:txt(web?.seoDescription)||txt(gh?.seoDescription)||'',githubName:ghName,content:[web?.content,gh?.content].filter(Boolean).join('\n\n--- GitHub ---\n').slice(0,24000),source:web?'official-web':'github',githubContent:gh?.content||'',keywords:uniq([...(web?.keywords||[]),...(gh?.keywords||[])])};
  if(!source.name)throw new Error('真实来源未读取到资源名称');
  if(!source.website&&!source.github)throw new Error('真实来源读取失败');
  return source;
}
function showRead(source){$('#readBox').classList.remove('hidden');$('#readName').textContent=source.name||'—';$('#readSource').textContent=source.website||'—';$('#readGithub').textContent=source.github||'未发现';$('#readThumb').textContent=source.thumbnail?'已读取':'未读取';$('#readContent').textContent=`已缓存 ${count(source.content)} 字符真实内容`;}
function buildResource(extra={}){const [cat,sub]=txt($('#categorySelect').value).split('::');const r=state.resource||{};const manualName=txt($('#resourceName').value);const sourceName=txt(state.source?.name);const finalName=manualName||sourceName;r.id=txt($('#resourceId').value)||r.id||makeId(finalName,$('#resourceUrl').value||$('#resourceGithub').value);r.name=finalName;r.website=normalizeUrl($('#resourceUrl').value)||txt(state.source?.website);r.github=normalizeGithub($('#resourceGithub').value)||txt(state.source?.github);r.thumbnail=state.source?.thumbnail||r.thumbnail||'';r.description=txt($('#resourceDescription').value);r.category=cat||'website';r.subcategory=sub||'website_tool';r.capabilities=selected('capabilities');r.scenarios=selected('scenarios');r.attributes={pricing:selected('pricing')[0]||'增值',platform:selected('platform'),language:selected('language'),audience:selected('audience')};r.audience=r.attributes.audience?.[0]||'';r.icon=iconForSubcategory(sub)||r.icon||parentIcon(cat)||'🔗';r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||'active';return r}
function renderResource(r){state.resource=r;renderCategories(r.subcategory,r.category);$('#resourceId').value=r.id||'';$('#resourceName').value=r.name||'';$('#resourceUrl').value=r.website||'';$('#resourceGithub').value=r.github||'';$('#resourceDescription').value=r.description||'';renderChips('capabilityChips',r.capabilities,'capabilities');renderChips('scenarioChips',r.scenarios,'scenarios');renderChips('pricingChips',[r.attributes?.pricing].filter(Boolean),'pricing');renderChips('platformChips',r.attributes?.platform,'platform');renderChips('languageChips',r.attributes?.language,'language');renderChips('audienceChips',r.attributes?.audience,'audience');$('#reviewPanel').classList.remove('hidden');$('#jsonPreview').textContent=JSON.stringify(r,null,2);}
async function readStep(){const name=txt($('#resourceName').value);status('正在读取真实网页 / GitHub…','busy');$('#fetchBtn').disabled=true;$('#analyzeBtn').disabled=true;try{const s=await readRealSources();state.source=s;if(name)$('#resourceName').value=name;else $('#resourceName').value=s.name;$('#resourceUrl').value=txt($('#resourceUrl').value)||s.website;$('#resourceGithub').value=txt($('#resourceGithub').value)||s.github;showRead(s);$('#jsonPreview').textContent='真实内容已读取并缓存。现在可以点击“智能分析并生成简介”。';$('#analyzeBtn').disabled=false;status('真实内容读取完成；尚未调用 DeepSeek。','ok')}catch(e){status(e.message||'读取失败')}finally{$('#fetchBtn').disabled=false}}
function isValidDescription(value){const v=txt(value);if(count(v)!==16||!/[\u3400-\u9fff]/.test(v)||/^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v)||/[\r\n]/.test(v))return false;const cjk=count(v.replace(/[^\u3400-\u9fff]/g,''));if(cjk<6)return false;return !/(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备)/.test(v)}
async function aiStep(){if(!state.source){status('请先点击“读取网页信息”');return}const manual=txt($('#resourceDescription').value);status('正在让 DeepSeek 分析简介与标准分类（最多自动生成5次）…','busy');$('#analyzeBtn').disabled=true;try{const payload={name:state.source.name,website:state.source.website,github:state.source.github,seoTitle:state.source.seoTitle,seoDescription:state.source.seoDescription,githubName:state.source.githubName,content:state.source.content,manualDescription:manual,taxonomy:categoryTaxonomy()};const r=await timeoutFetch('/api/deepseek-description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},300000);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`DeepSeek 代理 HTTP ${r.status}`);const desc=txt(data.description);if(manual){if(desc!==manual)throw new Error('AI 未按规则原样保留人工简介')}else if(!isValidDescription(desc))throw new Error(`DeepSeek 返回简介长度/格式不合格：${count(desc)} 字符`);if(!validClassification(data.category,data.subcategory))throw new Error('DeepSeek 返回的分类不在现有合法分类词库中');if(!manual)$('#resourceDescription').value=desc;const resource=applyClassification(data.category,data.subcategory);resource.description=manual||desc;resource.icon=iconForSubcategory(data.subcategory)||parentIcon(data.category)||resource.icon||'🔗';renderResource(resource);status(`AI分析完成：${CATEGORIES[data.category]?.name||data.category} / ${CATEGORIES[data.category]?.children?.[data.subcategory]||data.subcategory} · Icon ${resource.icon}`,'ok')}catch(e){status(e.message||'DeepSeek 分析失败')}finally{$('#analyzeBtn').disabled=false}}
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