const clean = value => typeof value === 'string' ? value.trim() : '';
const normalizeUrl = value => {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return '';
    u.hash = '';
    return u.href.replace(/\/$/, '') || u.href;
  } catch { return ''; }
};
const normalizeGithub = value => {
  const raw = clean(value).replace(/[)\]}>.,;]+$/g, '');
  const m = raw.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);
  return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, '')}` : '';
};
const stripHtml = html => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();
const cleanText = value => String(value || '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/[`*_>#~]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const isGithubHost = host => /(?:^|\.)github\.com$/i.test(host) || /(?:^|\.)githubusercontent\.com$/i.test(host);
const isBadExternalHost = host => /(?:^|\.)(?:githubusercontent\.com|githubassets\.com)$/i.test(host) || /^(?:github\.com|gist\.github\.com)$/i.test(host);
const validExternal = value => {
  const u = normalizeUrl(value);
  if (!u) return '';
  try {
    const parsed = new URL(u);
    if (isBadExternalHost(parsed.hostname)) return '';
    if (isGithubHost(parsed.hostname)) return '';
    return u;
  } catch { return ''; }
};
const unique = values => [...new Set(values.map(clean).filter(Boolean))];

function extractGithubLinks(raw) {
  const text = String(raw || '').replace(/&amp;/gi, '&').replace(/\\\//g, '/');
  const found = [];
  const add = value => { const repo = normalizeGithub(value); if (repo) found.push(repo); };
  for (const m of text.matchAll(/(?:href|data-href|data-url|data-link|data-target|content)\s*=\s*["']([^"']*github\.com\/[^"']+)["']/gi)) add(m[1]);
  for (const m of text.matchAll(/\[[^\]]{0,160}\]\((https?:\/\/(?:www\.)?github\.com\/[^)\s]+)\)/gi)) add(m[1]);
  // é¡µé¢æºç ä¸­çæ®éç»å¯¹ GitHub URLãJSON/JS è½¬ä¹ URL ä¸å¹¶è¯å«ã
  for (const m of text.matchAll(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi)) add(m[0]);
  for (const m of text.matchAll(/(?:^|[\s(<"'=])((?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/gim)) add(m[1]);
  return unique(found);
}
function scoreGithub(repo, name, website) {
  let score = 0;
  const slug = String(repo).split('/').pop().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const baseName = cleanText(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '');
    if (baseName && slug === baseName) score += 120;
    if (baseName && (slug.includes(baseName) || baseName.includes(slug))) score += 55;
    if (host && slug && host.includes(slug)) score += 40;
  } catch {}
  if (/^(docs?|blog|support|status|community|awesome|demo)-/i.test(slug)) score -= 25;
  return score;
}
function chooseGithub(raw, name, website) {
  const links = extractGithubLinks(raw);
  return links.map(repo => ({repo, score: scoreGithub(repo, name, website)}))
    .sort((a,b)=>b.score-a.score)[0]?.repo || links[0] || '';
}

function extractMeta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const m = String(html || '').match(re);
  return clean(m?.[1] || m?.[2] || '');
}
function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(m?.[1] || '');
}
function extractCanonical(html) {
  const m = String(html || '').match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i) || String(html || '').match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  return validExternal(m?.[1] || '');
}
function extractH1(html) {
  const m = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return cleanText(stripHtml(m?.[1] || ''));
}
function chooseName(html, url) {
  const candidates = [
    [extractMeta(html, 'og:site_name'), 130],
    [extractMeta(html, 'application-name'), 125],
    [extractMeta(html, 'og:title'), 120],
    [extractTitle(html), 100],
    [extractH1(html), 90]
  ].filter(([v]) => v);
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return ''; } })();
  const bad = /^(home|homepage|official website|website|welcome|login|sign in|sign up|menu|navigation|search|untitled|é¦é¡µ|ä¸»é¡µ|ç»å½|æ³¨å)$/i;
  const scored = candidates.map(([value, score]) => {
    let s = score;
    const x = cleanText(value).replace(/^[-ââ|:ï¼]+|[-ââ|:ï¼]+$/g, '').trim();
    if (!x || bad.test(x)) s -= 200;
    if (host && x.toLowerCase().replace(/\s+/g, '') === host.toLowerCase().replace(/\s+/g, '')) s -= 100;
    if (x.length > 80) s -= 40;
    if (/^(best|free|official|the official|open source|open-source)\b/i.test(x)) s -= 30;
    return { value: x, score: s };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].value : '';
}
function extractDescription(html) {
  return cleanText(extractMeta(html, 'description') || extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description'));
}
function extractThumbnail(html) {
  return validExternal(extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'));
}
async function fetchText(url, ms = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'XPH-Resource-Importer/19'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    const text = response.ok ? await response.text() : '';
    return { status: response.status, ok: response.ok, text, url: response.url || url };
  } finally { clearTimeout(timer); }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }});
}
export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const input = normalizeUrl(requestUrl.searchParams.get('url'));
  if (!input) return new Response(JSON.stringify({ error: 'å®ç½ URL æ æ' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
  let parsed;
  try { parsed = new URL(input); } catch { return new Response(JSON.stringify({ error: 'å®ç½ URL æ æ' }), { status: 400, headers: { 'Content-Type': 'application/json' }}); }
  if (isGithubHost(parsed.hostname)) return new Response(JSON.stringify({ error: 'GitHub URL åºèµ° GitHub ä¸ç¨è¯»åå±' }), { status: 400, headers: { 'Content-Type': 'application/json' }});

  let response;
  try { response = await fetchText(input); } catch (error) {
    return new Response(JSON.stringify({ error: error?.name === 'AbortError' ? 'å®ç½è¯»åè¶æ¶' : 'å®ç½è¯»åå¤±è´¥' }), { status: 504, headers: { 'Content-Type': 'application/json' }});
  }
  if (!response.ok || !response.text) return new Response(JSON.stringify({ error: `å®ç½è¯»åå¤±è´¥ï¼HTTP ${response.status || 0}` }), { status: 502, headers: { 'Content-Type': 'application/json' }});

  const raw = response.text;
  const name = chooseName(raw, input);
  const title = extractTitle(raw);
  const description = extractDescription(raw);
  const canonical = extractCanonical(raw);
  const thumbnail = extractThumbnail(raw);
  const github = chooseGithub(raw, name, input);
  const content = [
    `å®æ¹ç½ç«ï¼${input}`,
    name ? `çå®åç§°åéï¼${name}` : '',
    title ? `ç½é¡µæ é¢ï¼${title}` : '',
    description ? `SEOæè¿°ï¼${description}` : '',
    canonical ? `Canonicalï¼${canonical}` : '',
    github ? `GitHubï¼${github}` : '',
    `ç½é¡µçå®åå®¹ï¼${stripHtml(raw).slice(0, 22000)}`
  ].filter(Boolean).join('\n\n').slice(0, 26000);

  return new Response(JSON.stringify({
    website: input,
    finalUrl: normalizeUrl(response.url) || input,
    name: typeof name === 'string' ? name : '',
    seoTitle: typeof title === 'string' ? title : '',
    seoDescription: typeof description === 'string' ? description : '',
    canonical: typeof canonical === 'string' ? canonical : '',
    github: typeof github === 'string' ? github : '',
    thumbnail: typeof thumbnail === 'string' ? thumbnail : '',
    content,
    source: 'official-web-server'
  }), { status: 200, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  }});
}