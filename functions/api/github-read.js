import { XPH_RESOURCE_CONTRACT } from '../../shared/resource-contract.js';
const clean = value => typeof value === 'string' ? value.trim() : '';
const json = (payload, status=200, extra={}) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*', ...extra } });
const ok = (data, stage='reading_source') => json({ ok:true, status:XPH_RESOURCE_CONTRACT.statuses[0], stage, data:{ contractVersion:XPH_RESOURCE_CONTRACT.version, ...data }, error:null });
const fail = (code, message, status=422, stage='reading_source', details=null) => json({ ok:false, status:'error', stage, data:null, error:{ code, message, details } }, status);

const normalizeUrl = value => {
  const raw = clean(value);
  if (!raw) return '';
  try { const u = new URL(raw); u.hash = ''; return u.href.replace(/\/$/, '') || u.href; } catch { return ''; }
};
const normalizeRepo = value => {
  const raw = clean(value).replace(/[)\]}>.,;]+$/g, '');
  const m = raw.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);
  return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, '')}` : '';
};
const repoPath = repo => normalizeRepo(repo).match(/github\.com\/([^/]+\/[^/]+)/i)?.[1] || '';
const timeoutFetch = async (url, options = {}, ms = 15000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...options, signal: c.signal, redirect: 'follow' }); }
  finally { clearTimeout(t); }
};
const stripHtml = html => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
  .replace(/\s+/g, ' ').trim();
const cleanText = value => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[`*_>#~]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const badHost = host => /(?:^|\.)(?:githubusercontent\.com|githubassets\.com)$/i.test(host) || /^(?:github\.com|gist\.github\.com)$/i.test(host);
const validWebsite = value => {
  const u = normalizeUrl(value);
  if (!u) return '';
  try {
    const p = new URL(u);
    if (!/^https?:$/.test(p.protocol) || badHost(p.hostname.toLowerCase())) return '';
    return u;
  } catch { return ''; }
};
const unique = values => [...new Set((values || []).map(clean).filter(Boolean))];

function extractUrls(text) {
  const s = String(text || '').replace(/&amp;/gi, '&').replace(/\\\//g, '/');
  const urls = [];
  for (const m of s.matchAll(/https?:\/\/[^\s<>)"']+/gi)) urls.push(m[0].replace(/[.,;]+$/g, ''));
  return unique(urls);
}
function extractLabeledWebsite(text) {
  const s = String(text || '');
  const patterns = [
    /(?:official\s+(?:website|site)|homepage|home\s*page|website|å®ç½|é¡¹ç®ä¸»é¡µ|å®æ¹ç½ç«)[^\n]{0,260}?(https?:\/\/[^\s<>)"']+)/i,
    /(?:https?:\/\/[^\s<>)"']+)[^\n]{0,100}(?:official\s+(?:website|site)|homepage|website|å®ç½)/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    const candidate = m?.[1] || '';
    const valid = validWebsite(candidate);
    if (valid) return valid;
  }
  return '';
}

function normalizeProjectName(value, fallback = '') {
  let x = cleanText(value)
    .replace(/\s*(?:\||ï½|â|â|-|Â·|â¢)\s*(?:github|gitlab|bitbucket)\s*$/i, '')
    .trim();
  const parts = x.split(/\s*(?:â|â|\||ï½|Â·|â¢)\s*|:\s+/).map(v => v.trim()).filter(Boolean);
  if (parts.length > 1 && parts[0].length >= 2 && parts[0].length <= 40) x = parts[0];
  x = x.replace(/\s+(?:community|community forum|official community)$/i, '').trim();
  return x || cleanText(fallback);
}
function homepageScore(url, repo, projectName = '') {
  let score = 0;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const compact = host.replace(/[^a-z0-9]+/g, '');
    const slug = (repo.split('/').pop() || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const name = clean(projectName).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (slug && compact === slug) score += 180;
    if (slug && compact.startsWith(slug)) score += 120;
    if (name && compact.includes(name)) score += 100;
    if (/^(?:docs?|blog|status|support|careers|developer|developers)\./.test(host)) score -= 45;
    if (/(?:discord\.(?:gg|com)|twitter\.com|x\.com|linkedin\.com|youtube\.com|twitch\.tv|npmjs\.com|pypi\.org|medium\.com|buymeacoffee\.com)/.test(host)) score -= 120;
    if (/(?:badge|shields|googleapis|fonts\.|jsdelivr|unpkg)/.test(host)) score -= 160;
  } catch {}
  return score;
}
function pickHomepage({ apiHomepage, readme, html, repo, projectName }) {
  const direct = validWebsite(apiHomepage);
  if (direct) return direct;
  const labeled = extractLabeledWebsite(readme) || extractLabeledWebsite(html);
  if (labeled) return labeled;
  const candidates = [...extractUrls(readme), ...extractUrls(html)].map(validWebsite).filter(Boolean);
  const scored = unique(candidates).map(url => ({ url, score: homepageScore(url, repo, projectName) })).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 140 ? scored[0].url : '';
}
function extractName(api, html, readme, repo) {
  const candidates = [];
  const add = (value, score) => {
    const x = normalizeProjectName(value, repo.split('/').pop()).replace(/^#+\s*/, '').replace(/\s*[Â·|â-]\s*GitHub\s*$/i, '').trim();
    if (x && x.length <= 80) candidates.push({ x, score });
  };
  if (api?.name) add(api.name, 400);
  const og = String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i); if (og) add(og[1], 320);
  const title = String(html || '').match(/<title[^>]*>([^<]+)/i); if (title) add(title[1], 300);
  const h1 = String(readme || '').match(/^#\s+(.+)$/m); if (h1) add(h1[1], 260);
  const slug = repo.split('/').pop() || ''; if (slug) add(slug, 180);
  const bad = /^(published time|updated time|created time|release time|commit time|view raw|raw|source|image|download|home|homepage|website|menu|navigation)$/i;
  const best = candidates.filter(x => !bad.test(x.x)).sort((a, b) => b.score - a.score)[0];
  return normalizeProjectName(best?.x || slug, slug);
}
async function readText(url, headers, ms) {
  try {
    const r = await timeoutFetch(url, { headers }, ms);
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } catch { return { ok: false, status: 0, text: '' }; }
}
async function readJson(url, headers, ms) {
  try {
    const r = await timeoutFetch(url, { headers }, ms);
    return { ok: r.ok, status: r.status, data: r.ok ? await r.json() : null };
  } catch { return { ok: false, status: 0, data: null }; }
}
async function discoverRepo(name, website) {
  const host = (() => { try { return new URL(website).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
  const rawName = clean(name);
  const hostName = host.split('.')[0] || '';
  const terms = unique([
    rawName,
    rawName.replace(/[^a-z0-9]+/gi, ' ').trim(),
    hostName,
    host.replace(/\.(?:com|org|net|io|app|dev|ai|co)$/i, '')
  ]).filter(Boolean).slice(0, 4);
  if (!terms.length) return '';

  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'XPH-Resource-Importer/5.3' };
  const targetTokens = unique([rawName, hostName].map(v => v.toLowerCase().replace(/[^a-z0-9]+/g, '')).filter(Boolean));
  const scoreRepo = (repo, homepage = '', description = '') => {
    const path = repoPath(repo), slug = path.split('/').pop() || '', owner = path.split('/')[0] || '';
    const compactSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const compactOwner = owner.toLowerCase().replace(/[^a-z0-9]+/g, '');
    let score = 0;
    for (const target of targetTokens) {
      if (compactSlug === target) score += 260;
      else if (compactSlug.includes(target) || target.includes(compactSlug)) score += 120;
      if (compactOwner === target) score += 35;
    }
    const normalizedHomepage = validWebsite(homepage);
    if (normalizedHomepage && host) {
      try {
        const hp = new URL(normalizedHomepage).hostname.replace(/^www\./, '').toLowerCase();
        if (hp === host) score += 320;
        else if (hp.endsWith(`.${host}`) || host.endsWith(`.${hp}`)) score += 180;
      } catch {}
    }
    if (/official|open[- ]source|desktop|app|software|tool|client/i.test(description)) score += 8;
    return score;
  };

  const candidates = new Map();
  const addCandidate = (repo, score = 0, homepage = '', description = '') => {
    const normalized = normalizeRepo(repo);
    if (!normalized) return;
    const old = candidates.get(normalized) || { repo: normalized, score: 0, homepage: '', description: '' };
    old.score = Math.max(old.score, score + scoreRepo(normalized, homepage, description));
    old.homepage = validWebsite(homepage) || old.homepage;
    old.description = description || old.description;
    candidates.set(normalized, old);
  };

  // 1) GitHub APIï¼å¯ç¨æ¶è·åé«è´¨éåéï¼403/429ä¸é»æ­åç»­ç½é¡µæç´¢ã
  await Promise.all(terms.map(async term => {
    const api = await readJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(term)}&per_page=10`, headers, 9000);
    const items = Array.isArray(api.data?.items) ? api.data.items : [];
    for (const item of items) addCandidate(item?.html_url, 0, item?.homepage, item?.description);
  }));

  // 2) GitHubå¬å¼æç´¢é¡µï¼APIåéæ¶ä»è½åç°ä»åºã
  const htmlResults = await Promise.all(terms.map(term => readText(
    `https://github.com/search?q=${encodeURIComponent(term)}&type=repositories`,
    { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 12000
  )));
  for (const result of htmlResults) {
    const html = String(result.text || '');
    for (const m of html.matchAll(/href=["']\/(?!search\/|topics\/|features\/|collections\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)["']/gi)) {
      const repo = `https://github.com/${m[1]}/${m[2]}`;
      addCandidate(repo);
    }
  }

  let ranked = [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  if (!ranked.length) return '';

  // 3) å¯¹æé«ç¸å³åéåä¸æ¬¡è½»éäº¤åéªè¯ï¼è¯»åä»åºé¡µ/READMEï¼ç¡®è®¤å®ç½æ¯å¦çæ­£å¯¹åºè¾å¥å®ç½ã
  const verified = await Promise.all(ranked.map(async item => {
    const path = repoPath(item.repo);
    const [page, readme] = await Promise.all([
      readText(item.repo, { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 9000),
      readText(`https://raw.githubusercontent.com/${path}/HEAD/README.md`, { Accept: 'text/plain', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 9000)
    ]);
    const homepage = pickHomepage({ apiHomepage: item.homepage, readme: readme.text, html: page.text, repo: item.repo, projectName: path.split('/').pop() });
    let score = item.score;
    if (homepage && host) {
      try {
        const hp = new URL(homepage).hostname.replace(/^www\./, '').toLowerCase();
        if (hp === host) score += 500;
        else if (hp.endsWith(`.${host}`) || host.endsWith(`.${hp}`)) score += 250;
      } catch {}
    }
    return { ...item, score, homepage };
  }));
  ranked = verified.sort((a, b) => b.score - a.score);

  // æå®ç½è¾å¥æ¶ï¼ä¼åè¦æ±åéä»åºè½è¯æä¸è¯¥å®ç½å­å¨å¯¹åºå³ç³»ï¼å¦åéååç§°é«ç½®ä¿¡å¹éã
  if (host) {
    const sameSite = ranked.find(x => x.homepage && (() => { try { const h = new URL(x.homepage).hostname.replace(/^www\./, '').toLowerCase(); return h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`); } catch { return false; } })() && x.score >= 500);
    if (sameSite) return sameSite.repo;
  }
  const best = ranked[0];
  return best && best.score >= 260 ? best.repo : '';
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  let repo = normalizeRepo(url.searchParams.get('repo'));
  const discoverName = clean(url.searchParams.get('discoverName'));
  const discoverWebsite = clean(url.searchParams.get('discoverWebsite'));
  if (!repo && discoverName) repo = await discoverRepo(discoverName, discoverWebsite);
  if (!repo) return fail(XPH_RESOURCE_CONTRACT.errors.SOURCE_READ_FAILED, 'æªæ¾å°å¯éªè¯çå®æ¹ GitHub ä»åº', 404);
  const path = repoPath(repo);
  if (!path) return fail(XPH_RESOURCE_CONTRACT.errors.INVALID_REQUEST, 'GitHub ä»åºå°åæ æ', 400);

  const api = await readJson(`https://api.github.com/repos/${path}`, { Accept: 'application/vnd.github+json', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 10000);
  const html = await readText(repo, { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 15000);
  const readme = await readText(`https://raw.githubusercontent.com/${path}/HEAD/README.md`, { Accept: 'text/plain', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 12000);
  const d = api.data || {};
  const name = extractName(d, html.text, readme.text, repo);
  const website = pickHomepage({ apiHomepage: typeof d.homepage === 'string' ? d.homepage : '', readme: readme.text, html: html.text, repo, projectName: name });
  const description = cleanText(d.description || '');
  const readmeText = cleanText(readme.text).slice(0, 16000);
  const htmlText = stripHtml(html.text).slice(0, 10000);
  const content = [`GitHubä»åºï¼${repo}`, `é¡¹ç®åç§°ï¼${name}`, description ? `é¡¹ç®æè¿°ï¼${description}` : '', website ? `å®æ¹ä¸»é¡µï¼${website}` : '', readmeText ? `READMEï¼${readmeText}` : '', htmlText ? `GitHubé¡µé¢ï¼${htmlText}` : ''].filter(Boolean).join('\n\n').slice(0, 24000);
  if (!content || content.length < 30) return fail(XPH_RESOURCE_CONTRACT.errors.SOURCE_READ_FAILED, 'GitHubçå®åå®¹è¯»åå¤±è´¥', 502, 'reading_source', { apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status });
  return ok({ github: repo, name, website: website || '', seoTitle: name, seoDescription: description, thumbnail: '', content, keywords: Array.isArray(d.topics) ? d.topics : [], apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status });
}