const clean = value => typeof value === 'string' ? value.trim() : '';
const normalizeRepo = value => {
  const m = clean(value).replace(/[)\]}>.,;]+$/g,'').match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);
  return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i,'')}` : '';
};
const timeoutFetch = async (url, options={}, ms=12000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, {...options, signal:c.signal}); }
  finally { clearTimeout(t); }
};
const normalizeUrl = value => { try { const u=new URL(clean(value)); u.hash=''; return u.href.replace(/\/$/,''); } catch { return ''; } };
const validHomepage = value => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const u=new URL(normalizeUrl(value));
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    if (!/^https?:$/.test(u.protocol)) return false;
    if (!h || /(?:^|\.)github(?:usercontent)?\.com$/.test(h)) return false;
    if (/^(?:github\.com|gist\.github\.com|githubassets\.com)$/.test(h)) return false;
    return true;
  } catch { return false; }
};
const stripHtml = html => String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const cleanText = value => String(value||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/[`*_>#~]/g,' ').replace(/\s+/g,' ').trim();
const suspicious = /(?:camo\.githubusercontent\.com|raw\.githubusercontent\.com|objects\.githubusercontent\.com|user-images\.githubusercontent\.com|avatars\.githubusercontent\.com|githubassets\.com)/i;
function externalLinks(text){
  const found=[];
  const add=v=>{try{const u=normalizeUrl(v);if(u&&validHomepage(u)&&!suspicious.test(u))found.push(u)}catch{}};
  const s=String(text||'').replace(/&amp;/gi,'&').replace(/\\\//g,'/');
  for(const m of s.matchAll(/(?:href|data-href|data-url|data-link|data-target)=["']([^"']+)["']/gi)) add(m[1]);
  for(const m of s.matchAll(/https?:\/\/[^\s<>)"']+/gi)) add(m[0]);
  return [...new Set(found)];
}
function pickHomepage(readme, html, repo, apiHomepage){
  if(validHomepage(apiHomepage)) return normalizeUrl(apiHomepage);
  const labeled = String(readme || '').match(/(?:official\s+(?:website|site)|homepage|home\s*page|website|å®ç½|é¡¹ç®ä¸»é¡µ)[^\n]{0,220}?(https?:\/\/(?!github\.com)[^\s<>)\"']+)/i);
  if(labeled && validHomepage(labeled[1])) return normalizeUrl(labeled[1]);
  const repoName=(repo.match(/github\.com\/[^/]+\/([^/?#]+)/i)?.[1]||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const all=[...externalLinks(readme),...externalLinks(html)];
  const scored=all.map(u=>{
    let score=0;
    try{
      const host=new URL(u).hostname.toLowerCase().replace(/^www\./,'');
      const compact=host.replace(/[^a-z0-9]+/g,'');
      const root=host.split('.').slice(-2).join('.').replace(/[^a-z0-9]+/g,'');
      if(repoName && compact===repoName) score+=220;
      if(repoName && root===repoName) score+=200;
      if(repoName && (compact.includes(repoName)||repoName.includes(compact))) score+=100;
      if(/(?:docs?|blog|status|support|careers|developer|developers)\./.test(host)) score-=50;
      if(/(?:discord\.(?:gg|com)|twitter\.com|x\.com|linkedin\.com|youtube\.com|twitch\.tv|npmjs\.com|pypi\.org|medium\.com|buymeacoffee\.com)/.test(host)) score-=120;
      if(/(?:badge|shields|githubusercontent|googleapis|fonts\.|jsdelivr|unpkg)/.test(host)) score-=180;
    }catch{}
    return {u,score};
  }).sort((a,b)=>b.score-a.score);
  return scored[0]?.score>=120 ? scored[0].u : '';
}
function extractName(api, html, readme, repo){
  const candidates=[];
  const add=(v,score)=>{const x=cleanText(v).replace(/^#+\s*/,'').trim();if(x&&x.length<=100)candidates.push({x,score});};
  if(api?.name)add(api.name,300);
  const og=String(html||'').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i); if(og)add(og[1],260);
  const title=String(html||'').match(/<title[^>]*>([^<]+)/i); if(title)add(title[1].replace(/\s*[Â·|â-]\s*GitHub.*$/i,''),240);
  const h1=String(readme||'').match(/^#\s+(.+)$/m); if(h1)add(h1[1],220);
  const slug=repo.match(/github\.com\/[^/]+\/([^/?#]+)/i)?.[1]||''; if(slug)add(slug.replace(/[-_]+/g,' '),180);
  const bad=/^(published time|updated time|created time|release time|commit time|view raw|raw|source|image|download|home|homepage|website|menu|navigation)$/i;
  return candidates.filter(x=>!bad.test(x.x)).sort((a,b)=>b.score-a.score)[0]?.x || slug;
}
function parseReadmeLinksForGithubName(readme, repo){ return extractName({},'',readme,repo); }
export async function onRequestOptions({request}){ return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}}); }
export async function onRequestGet({request}){
  const url=new URL(request.url); const repo=normalizeRepo(url.searchParams.get('repo'));
  if(!repo) return new Response(JSON.stringify({error:'GitHub URL æ æ'}),{status:400,headers:{'Content-Type':'application/json'}});
  const match=repo.match(/github\.com\/([^/]+\/[^/]+)/i); const path=match?.[1];
  if(!path) return new Response(JSON.stringify({error:'GitHub ä»åºå°åæ æ'}),{status:400,headers:{'Content-Type':'application/json'}});
  const apiPromise=timeoutFetch(`https://api.github.com/repos/${path}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'XPH-Resource-Importer/18'}},10000).then(async r=>({status:r.status,data:r.ok?await r.json():null})).catch(()=>({status:0,data:null}));
  const htmlPromise=timeoutFetch(repo,{headers:{Accept:'text/html','User-Agent':'XPH-Resource-Importer/18'}},15000).then(async r=>({status:r.status,text:r.ok?await r.text():''})).catch(()=>({status:0,text:''}));
  const readmePromise=timeoutFetch(`https://raw.githubusercontent.com/${path}/HEAD/README.md`,{headers:{Accept:'text/plain','User-Agent':'XPH-Resource-Importer/18'}},12000).then(async r=>({status:r.status,text:r.ok?await r.text():''})).catch(()=>({status:0,text:''}));
  const [api,html,readme]=await Promise.all([apiPromise,htmlPromise,readmePromise]);
  const d=api.data||{};
  const name=extractName(d,html.text,readme.text,repo);
  const website=pickHomepage(readme.text,html.text,repo,typeof d.homepage==='string'?d.homepage:'');
  const htmlText=stripHtml(html.text).slice(0,10000);
  const readmeText=cleanText(readme.text).slice(0,16000);
  const description=cleanText(d.description||'');
  const content=[`GitHubä»åºï¼${repo}`,`é¡¹ç®åç§°ï¼${name}`,description?`é¡¹ç®æè¿°ï¼${description}`:'',website?`å®æ¹ä¸»é¡µï¼${website}`:'',readmeText?`READMEï¼${readmeText}`:'',htmlText?`GitHubé¡µé¢ï¼${htmlText}`:''].filter(Boolean).join('\n\n').slice(0,24000);
  if(!content || content.length<30) return new Response(JSON.stringify({error:'GitHub çå®åå®¹è¯»åå¤±è´¥',apiStatus:api.status,htmlStatus:html.status,readmeStatus:readme.status}),{status:502,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({github:repo,name,website:typeof website==='string'?website:'',thumbnail:'',seoTitle:name,seoDescription:description,content,keywords:Array.isArray(d.topics)?d.topics:[],apiStatus:api.status,htmlStatus:html.status,readmeStatus:readme.status}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
}