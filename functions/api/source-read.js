const clean = v => String(v ?? '').trim();
const normalizeUrl = value => { try { const u = new URL(clean(value)); u.hash = ''; return u.href.replace(/\/$/,''); } catch { return ''; } };
const normalizeGithub = value => {
  const m = clean(value).replace(/[)\]}>.,;]+$/g,'').match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);
  return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i,'')}` : '';
};
const stripHtml = html => String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/&#x2F;/gi,'/').replace(/\s+/g,' ').trim();
const decode = s => clean(s).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x2F;/gi,'/');
const fetchText = async (url, ms=15000) => {
  const c = new AbortController(); const t = setTimeout(()=>c.abort(),ms);
  try {
    const r = await fetch(url,{headers:{'User-Agent':'XPH-Resource-Importer/18.1','Accept':'text/html,text/plain;q=0.9,*/*;q=0.8'},signal:c.signal});
    const text = r.ok ? await r.text() : '';
    return {ok:r.ok,status:r.status,text};
  } catch { return {ok:false,status:0,text:''}; }
  finally { clearTimeout(t); }
};
const jina = async url => {
  const r = await fetchText('https://r.jina.ai/'+normalizeUrl(url),18000);
  return r.ok ? r.text : '';
};
const isBadHost = host => {
  const h=clean(host).toLowerCase().replace(/^www\./,'');
  return /(?:^|\.)github(?:usercontent)?\.com$/.test(h) || /^(?:github\.com|gist\.github\.com|githubassets\.com)$/.test(h) || /(?:googleapis|gstatic|jsdelivr|unpkg|cdnjs|cloudflare|gravatar)\./.test(h);
};
const validExternal = value => {
  try { const u=new URL(normalizeUrl(value)); if(!/^https?:$/.test(u.protocol)||!u.hostname||isBadHost(u.hostname)) return false; return u.href; } catch { return ''; }
};
function githubLinks(text){
  const s=decode(text), out=[];
  const add=v=>{const u=normalizeGithub(v);if(u)out.push(u)};
  for(const m of s.matchAll(/(?:href|data-url|data-href)\s*=\s*["']([^"']+github\.com\/[^"']+)["']/gi)) add(m[1]);
  for(const m of s.matchAll(/\[[^\]]{0,160}\]\((https?:\/\/(?:www\.)?github\.com\/[^)\s]+)\)/gi)) add(m[1]);
  for(const m of s.matchAll(/(?:^|[\s(<"'=])(https?:\/\/(?:www\.)?github\.com\/[^\s<>\]\\)"']+)/gim)) add(m[1]);
  for(const m of s.matchAll(/(?:^|[\s(<"'=])((?:www\.)?github\.com\/[^\s<>\]\\)"']+)/gim)) add(m[1]);
  return [...new Set(out)];
}
function externalLinks(text){
  const s=decode(text),out=[]; const add=v=>{const u=validExternal(v);if(u)out.push(u)};
  for(const m of s.matchAll(/(?:href|data-url|data-href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) add(m[1]);
  for(const m of s.matchAll(/\[[^\]]{0,160}\]\((https?:\/\/[^)\s]+)\)/gi)) add(m[1]);
  for(const m of s.matchAll(/https?:\/\/[^\s<>\]\\)"']+/gi)) add(m[0]);
  return [...new Set(out)];
}
function meta(html,name,property){
  const re=new RegExp(`<meta[^>]+(?:${name})=["']${property}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:${name})=["']${property}["']`,'i');
  const m=String(html||'').match(re); return decode(m?.[1]||m?.[2]||'');
}
function pageInfo(html,url){
  const title=(String(html||'').match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
  const site=meta(html,'property','og:site_name')||meta(html,'name','application-name');
  const og=meta(html,'property','og:title');
  const desc=meta(html,'name','description')||meta(html,'property','og:description')||meta(html,'name','twitter:description');
  const h1=(String(html||'').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'';
  const name=(site||og||h1||title).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return {name,seoTitle:clean(og||title),seoDescription:clean(desc)};
}
async function discoverGithub(name,website){
  const q=clean(name)||(()=>{try{return new URL(website).hostname.replace(/^www\./,'')}catch{return ''}})();
  if(!q)return '';
  const raw=await jina(`https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`);
  if(!raw)return '';
  const links=githubLinks(raw); const target=q.toLowerCase().replace(/[^a-z0-9]+/g,'');
  const scored=links.map(u=>{const repo=u.split('/').pop().toLowerCase().replace(/[^a-z0-9]+/g,'');let score=0;if(repo===target)score+=200;if(repo.includes(target)||target.includes(repo))score+=70;return{u,score};}).sort((a,b)=>b.score-a.score);
  return scored[0]?.score>=200 ? scored[0].u : '';
}
export async function onRequestOptions({request}){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}})}
export async function onRequestGet({request}){
  const url=new URL(request.url); const target=normalizeUrl(url.searchParams.get('url'));
  if(!target)return new Response(JSON.stringify({error:'URLæ æ'}),{status:400,headers:{'Content-Type':'application/json'}});
  let html='',status=0,mode='direct';
  const direct=await fetchText(target,15000);
  if(direct.ok){html=direct.text;status=direct.status;}
  else {mode='jina';html=await jina(target);status=html?200:direct.status;}
  if(!html)return new Response(JSON.stringify({error:'å®ç½è¯»åå¤±è´¥',status}),{status:502,headers:{'Content-Type':'application/json'}});
  const info=pageInfo(html,target);
  const githubs=githubLinks(html);
  let github=githubs[0]||'';
  if(!github)github=await discoverGithub(info.name,target);
  const links=externalLinks(html);
  const thumbnail=(()=>{const m=String(html).match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);return validExternal(m?.[1]||'')||''})();
  const content=(mode==='jina'?html:stripHtml(html)).slice(0,22000);
  return new Response(JSON.stringify({website:target,name:info.name,github,githubCandidates:githubs.slice(0,10),seoTitle:info.seoTitle,seoDescription:info.seoDescription,thumbnail,content,externalLinks:links.slice(0,30),mode,status}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
}