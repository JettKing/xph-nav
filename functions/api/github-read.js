import { XPH_RESOURCE_CONTRACT } from '../../shared/resource-contract.js';
import { requireAdmin, sameOrigin } from '../lib/admin-auth.js';
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
    /(?:official\s+(?:website|site)|homepage|home\s*page|website|Ã¥Â®ÂÃ§Â½Â|Ã©Â¡Â¹Ã§ÂÂ®Ã¤Â¸Â»Ã©Â¡Âµ|Ã¥Â®ÂÃ¦ÂÂ¹Ã§Â½ÂÃ§Â«Â)[^\n]{0,260}?(https?:\/\/[^\s<>)"']+)/i,
    /(?:https?:\/\/[^\s<>)"']+)[^\n]{0,100}(?:official\s+(?:website|site)|homepage|website|Ã¥Â®ÂÃ§Â½Â)/i
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
    .replace(/^github\s*[-:|Ã¯Â½Â]\s*[^/\s]+\/([^\s]+)$/i, '$1')
    .replace(/^github\s*[-:|Ã¯Â½Â]\s*/i, '')
    .replace(/\s*(?:\||Ã¯Â½Â|Ã¢ÂÂ|Ã¢ÂÂ|-|ÃÂ·|Ã¢ÂÂ¢)\s*(?:github|gitlab|bitbucket)\s*$/i, '')
    .trim();
  const parts = x.split(/\s*(?:Ã¢ÂÂ|Ã¢ÂÂ|\||Ã¯Â½Â|ÃÂ·|Ã¢ÂÂ¢)\s*|:\s+/).map(v => v.trim()).filter(Boolean);
  if (parts.length > 1 && parts[0].length >= 2 && parts[0].length <= 48) x = parts[0];
  x = x.replace(/\s+(?:community|community forum|official community|Ã¥Â¾Â®Ã¤Â¿Â¡Ã¥ÂÂ¬Ã¤Â¼Â?Ã¥ÂÂ·|AIÃ§ÂÂ¥Ã¨Â¯ÂÃ¥ÂºÂ|Ã¥Â·Â¥Ã¤Â½ÂÃ¦ÂµÂ|AgentÃ¥Â¹Â³Ã¥ÂÂ°|RAGÃ¥Â¤Â§Ã¦Â¨Â¡Ã¥ÂÂ.*)$/i, '').trim();
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
function homepageLooksLikeResource(url, projectName = '', repo = '') {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname.toLowerCase().replace(/\/+$/, '');
    const first = host.split('.')[0];
    const repoSlug = (repo.split('/').pop() || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const name = clean(projectName).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!/^https?:$/.test(u.protocol)) return false;
    if (/^(?:docs?|documentation|developer|developers|api|status|support|help|blog|forum|community|changelog|careers|jobs)\./i.test(host)) return false;
    if (/^\/(?:docs?|documentation|developer|developers|api|reference|references|status|support|help|blog|forum|community|changelog|careers|jobs)(?:\/|$)/i.test(path)) return false;
    if (/(?:discord\.(?:gg|com)|twitter\.com|x\.com|linkedin\.com|youtube\.com|twitch\.tv|npmjs\.com|pypi\.org|medium\.com|buymeacoffee\.com)$/i.test(host)) return false;
    if (repoSlug && host.replace(/[^a-z0-9]+/g, '') === repoSlug) return true;
    if (name && host.replace(/[^a-z0-9]+/g, '').includes(name)) return true;
    if (first && (first === repoSlug || first === name)) return true;
    return true;
  } catch { return false; }
}
function pickHomepage({ apiHomepage, readme, html, repo, projectName }) {
  const direct = validWebsite(apiHomepage);
  if (direct && homepageLooksLikeResource(direct, projectName, repo)) return direct;
  const labeledCandidates = [extractLabeledWebsite(readme), extractLabeledWebsite(html)].map(validWebsite).filter(Boolean).filter(url => homepageLooksLikeResource(url, projectName, repo));
  if (labeledCandidates.length) return labeledCandidates[0];
  const candidates = [...extractUrls(readme), ...extractUrls(html)].map(validWebsite).filter(Boolean).filter(url => homepageLooksLikeResource(url, projectName, repo));
  const scored = unique(candidates).map(url => ({ url, score: homepageScore(url, repo, projectName) })).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 140 ? scored[0].url : '';
}
function extractName(api, html, readme, repo) {
  const slug = repo.split('/').pop() || '';
  const apiName = normalizeProjectName(api?.name, slug);
  const apiCompact = apiName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const candidates = [];
  const add = (value, score, source='') => {
    const x = normalizeProjectName(value, slug).replace(/^#+\s*/, '').replace(/\s*[ÃÂ·|Ã¢ÂÂ-]\s*GitHub\s*$/i, '').trim();
    if (!x || x.length > 80) return;
    const low = x.toLowerCase();
    if (/^(install|installation|getting started|quick start|quickstart|one[- ]click deployment|deployment|deploy|setup|prerequisites|usage|configuration|configuration guide|documentation|docs|license|changelog|roadmap|contributing|credits|screenshot|ui|features|core features|tech stack|community|contact|support)\b/i.test(x)) return;
    if (/^(published time|updated time|created time|release time|commit time|view raw|raw|source|image|download|home|homepage|website|menu|navigation)$/i.test(x)) return;
    let finalScore = score;
    if (apiCompact && low.replace(/[^a-z0-9]+/g, '') === apiCompact) finalScore += 80;
    if (source === 'api') finalScore += 40;
    candidates.push({ x, score: finalScore, source });
  };
  if (apiName) add(apiName, 500, 'api');
  if (apiName) {
    const escaped = apiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'i');
    const hit = String(readme || '').match(re);
    if (hit?.[0]) add(hit[0], 560, 'brand');
  }
  const h1Matches = String(readme || '').match(/^#\s+(.+)$/gm) || [];
  for (const line of h1Matches.slice(0, 8)) add(line.replace(/^#\s+/, ''), 420, 'readme-h1');
  const og = String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i); if (og) add(og[1], 300, 'og:title');
  const title = String(html || '').match(/<title[^>]*>([^<]+)/i); if (title) add(title[1], 280, 'title');
  if (slug) add(slug, 180, 'slug');
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return normalizeProjectName(best?.x || apiName || slug, slug);
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

  // 1) GitHub APIÃ¯Â¼ÂÃ¥ÂÂ¯Ã§ÂÂ¨Ã¦ÂÂ¶Ã¨ÂÂ·Ã¥ÂÂÃ©Â«ÂÃ¨Â´Â¨Ã©ÂÂÃ¥ÂÂÃ©ÂÂÃ¯Â¼Â403/429Ã¤Â¸ÂÃ©ÂÂ»Ã¦ÂÂ­Ã¥ÂÂÃ§Â»Â­Ã§Â½ÂÃ©Â¡ÂµÃ¦ÂÂÃ§Â´Â¢Ã£ÂÂ
  await Promise.all(terms.map(async term => {
    const api = await readJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(term)}&per_page=10`, headers, 9000);
    const items = Array.isArray(api.data?.items) ? api.data.items : [];
    for (const item of items) addCandidate(item?.html_url, 0, item?.homepage, item?.description);
  }));

  // 2) GitHubÃ¥ÂÂ¬Ã¥Â¼ÂÃ¦ÂÂÃ§Â´Â¢Ã©Â¡ÂµÃ¯Â¼ÂAPIÃ¥ÂÂÃ©ÂÂÃ¦ÂÂ¶Ã¤Â»ÂÃ¨ÂÂ½Ã¥ÂÂÃ§ÂÂ°Ã¤Â»ÂÃ¥ÂºÂÃ£ÂÂ
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

  // 3) Ã¥Â¯Â¹Ã¦ÂÂÃ©Â«ÂÃ§ÂÂ¸Ã¥ÂÂ³Ã¥ÂÂÃ©ÂÂÃ¥ÂÂÃ¤Â¸ÂÃ¦Â¬Â¡Ã¨Â½Â»Ã©ÂÂÃ¤ÂºÂ¤Ã¥ÂÂÃ©ÂªÂÃ¨Â¯ÂÃ¯Â¼ÂÃ¨Â¯Â»Ã¥ÂÂÃ¤Â»ÂÃ¥ÂºÂÃ©Â¡Âµ/READMEÃ¯Â¼ÂÃ§Â¡Â®Ã¨Â®Â¤Ã¥Â®ÂÃ§Â½ÂÃ¦ÂÂ¯Ã¥ÂÂ¦Ã§ÂÂÃ¦Â­Â£Ã¥Â¯Â¹Ã¥ÂºÂÃ¨Â¾ÂÃ¥ÂÂ¥Ã¥Â®ÂÃ§Â½ÂÃ£ÂÂ
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

  // Ã¦ÂÂÃ¥Â®ÂÃ§Â½ÂÃ¨Â¾ÂÃ¥ÂÂ¥Ã¦ÂÂ¶Ã¯Â¼ÂÃ¤Â¼ÂÃ¥ÂÂÃ¨Â¦ÂÃ¦Â±ÂÃ¥ÂÂÃ©ÂÂÃ¤Â»ÂÃ¥ÂºÂÃ¨ÂÂ½Ã¨Â¯ÂÃ¦ÂÂÃ¤Â¸ÂÃ¨Â¯Â¥Ã¥Â®ÂÃ§Â½ÂÃ¥Â­ÂÃ¥ÂÂ¨Ã¥Â¯Â¹Ã¥ÂºÂÃ¥ÂÂ³Ã§Â³Â»Ã¯Â¼ÂÃ¥ÂÂ¦Ã¥ÂÂÃ©ÂÂÃ¥ÂÂÃ¥ÂÂÃ§Â§Â°Ã©Â«ÂÃ§Â½Â®Ã¤Â¿Â¡Ã¥ÂÂ¹Ã©ÂÂÃ£ÂÂ
  if (host) {
    const sameSite = ranked.find(x => x.homepage && (() => { try { const h = new URL(x.homepage).hostname.replace(/^www\./, '').toLowerCase(); return h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`); } catch { return false; } })() && x.score >= 500);
    if (sameSite) return sameSite.repo;
  }
  const best = ranked[0];
  return best && best.score >= 260 ? best.repo : '';
}

export async function onRequestOptions({ request }) { const origin=request.headers.get('Origin')||'https://xph.asia'; return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':sameOrigin(request)?origin:'https://xph.asia','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}}); }
export async function onRequestGet({ request, env }) {
  if (!sameOrigin(request) || !(await requireAdmin(request, env))) return fail(XPH_RESOURCE_CONTRACT.errors.UNAUTHORIZED, 'Ã¦ÂÂªÃ§ÂÂ»Ã¥Â½ÂÃ§Â®Â¡Ã§ÂÂÃ¥ÂÂÃ¤Â¼ÂÃ¨Â¯Â', 401);
  const url = new URL(request.url);
  let repo = normalizeRepo(url.searchParams.get('repo'));
  const discoverName = clean(url.searchParams.get('discoverName'));
  const discoverWebsite = clean(url.searchParams.get('discoverWebsite'));
  if (!repo && discoverName) repo = await discoverRepo(discoverName, discoverWebsite);
  if (!repo) return fail(XPH_RESOURCE_CONTRACT.errors.SOURCE_READ_FAILED, 'Ã¦ÂÂªÃ¦ÂÂ¾Ã¥ÂÂ°Ã¥ÂÂ¯Ã©ÂªÂÃ¨Â¯ÂÃ§ÂÂÃ¥Â®ÂÃ¦ÂÂ¹ GitHub Ã¤Â»ÂÃ¥ÂºÂ', 404);
  const path = repoPath(repo);
  if (!path) return fail(XPH_RESOURCE_CONTRACT.errors.INVALID_REQUEST, 'GitHub Ã¤Â»ÂÃ¥ÂºÂÃ¥ÂÂ°Ã¥ÂÂÃ¦ÂÂ Ã¦ÂÂ', 400);

  const api = await readJson(`https://api.github.com/repos/${path}`, { Accept: 'application/vnd.github+json', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 10000);
  const html = await readText(repo, { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 15000);
  const readme = await readText(`https://raw.githubusercontent.com/${path}/HEAD/README.md`, { Accept: 'text/plain', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 12000);
  const d = api.data || {};
  const name = extractName(d, html.text, readme.text, repo);
  const website = pickHomepage({ apiHomepage: typeof d.homepage === 'string' ? d.homepage : '', readme: readme.text, html: html.text, repo, projectName: name });
  const description = cleanText(d.description || '');
  const readmeText = cleanText(readme.text).slice(0, 16000);
  const htmlText = stripHtml(html.text).slice(0, 10000);
  const content = [`GitHubÃ¤Â»ÂÃ¥ÂºÂÃ¯Â¼Â${repo}`, `Ã©Â¡Â¹Ã§ÂÂ®Ã¥ÂÂÃ§Â§Â°Ã¯Â¼Â${name}`, description ? `Ã©Â¡Â¹Ã§ÂÂ®Ã¦ÂÂÃ¨Â¿Â°Ã¯Â¼Â${description}` : '', website ? `Ã¥Â®ÂÃ¦ÂÂ¹Ã¤Â¸Â»Ã©Â¡ÂµÃ¯Â¼Â${website}` : '', readmeText ? `READMEÃ¯Â¼Â${readmeText}` : '', htmlText ? `GitHubÃ©Â¡ÂµÃ©ÂÂ¢Ã¯Â¼Â${htmlText}` : ''].filter(Boolean).join('\n\n').slice(0, 24000);
  if (!content || content.length < 30) return fail(XPH_RESOURCE_CONTRACT.errors.SOURCE_READ_FAILED, 'GitHubÃ§ÂÂÃ¥Â®ÂÃ¥ÂÂÃ¥Â®Â¹Ã¨Â¯Â»Ã¥ÂÂÃ¥Â¤Â±Ã¨Â´Â¥', 502, 'reading_source', { apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status });
  return ok({ github: repo, name, website: website || '', seoTitle: name, seoDescription: description, thumbnail: '', content, keywords: Array.isArray(d.topics) ? d.topics : [], apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status });
}