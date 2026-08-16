const clean = value => typeof value === 'string' ? value.trim() : '';
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
    /(?:official\s+(?:website|site)|homepage|home\s*page|website|官网|项目主页|官方网站)[^\n]{0,260}?(https?:\/\/[^\s<>)"']+)/i,
    /(?:https?:\/\/[^\s<>)"']+)[^\n]{0,100}(?:official\s+(?:website|site)|homepage|website|官网)/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    const candidate = m?.[1] || '';
    const valid = validWebsite(candidate);
    if (valid) return valid;
  }
  return '';
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
    const x = cleanText(value).replace(/^#+\s*/, '').replace(/\s*[·|—-]\s*GitHub\s*$/i, '').trim();
    if (x && x.length <= 80) candidates.push({ x, score });
  };
  if (api?.name) add(api.name, 400);
  const og = String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i); if (og) add(og[1], 320);
  const title = String(html || '').match(/<title[^>]*>([^<]+)/i); if (title) add(title[1], 300);
  const h1 = String(readme || '').match(/^#\s+(.+)$/m); if (h1) add(h1[1], 260);
  const slug = repo.split('/').pop() || ''; if (slug) add(slug, 180);
  const bad = /^(published time|updated time|created time|release time|commit time|view raw|raw|source|image|download|home|homepage|website|menu|navigation)$/i;
  const best = candidates.filter(x => !bad.test(x.x)).sort((a, b) => b.score - a.score)[0];
  return best?.x || slug;
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
  const q = clean(name) || (() => { try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  if (!q) return '';
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'XPH-Resource-Importer/5.3' };
  const api = await readJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=8`, headers, 10000);
  const items = Array.isArray(api.data?.items) ? api.data.items : [];
  const target = q.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const scored = items.map(item => {
    const repoName = clean(item?.name).toLowerCase().replace(/[^a-z0-9]+/g, '');
    let score = 0;
    if (repoName === target) score += 220;
    if (repoName.includes(target) || target.includes(repoName)) score += 90;
    if (item?.homepage) score += 20;
    if (item?.fork === false) score += 15;
    return { repo: normalizeRepo(item?.html_url), score };
  }).filter(x => x.repo).sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 220) return scored[0].repo;
  // API search may be rate-limited; HTML search is a last-resort discovery layer.
  const html = await readText(`https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`, { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 12000);
  const links = [...String(html.text || '').matchAll(/href=["'](\/[^/\s"']+\/[^/\s"']+)["']/gi)].map(m => normalizeRepo(`https://github.com${m[1]}`)).filter(Boolean);
  const uniqueLinks = unique(links);
  return uniqueLinks.find(repo => repo.split('/').pop().toLowerCase().replace(/[^a-z0-9]+/g, '') === target) || '';
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
  if (!repo) return new Response(JSON.stringify({ error: '未找到可验证的官方 GitHub 仓库' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const path = repoPath(repo);
  if (!path) return new Response(JSON.stringify({ error: 'GitHub 仓库地址无效' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const api = await readJson(`https://api.github.com/repos/${path}`, { Accept: 'application/vnd.github+json', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 10000);
  const html = await readText(repo, { Accept: 'text/html', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 15000);
  const readme = await readText(`https://raw.githubusercontent.com/${path}/HEAD/README.md`, { Accept: 'text/plain', 'User-Agent': 'XPH-Resource-Importer/5.3' }, 12000);
  const d = api.data || {};
  const name = extractName(d, html.text, readme.text, repo);
  const website = pickHomepage({ apiHomepage: typeof d.homepage === 'string' ? d.homepage : '', readme: readme.text, html: html.text, repo, projectName: name });
  const description = cleanText(d.description || '');
  const readmeText = cleanText(readme.text).slice(0, 16000);
  const htmlText = stripHtml(html.text).slice(0, 10000);
  const content = [`GitHub仓库：${repo}`, `项目名称：${name}`, description ? `项目描述：${description}` : '', website ? `官方主页：${website}` : '', readmeText ? `README：${readmeText}` : '', htmlText ? `GitHub页面：${htmlText}` : ''].filter(Boolean).join('\n\n').slice(0, 24000);
  if (!content || content.length < 30) return new Response(JSON.stringify({ error: 'GitHub真实内容读取失败', apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ github: repo, name, website: website || '', seoTitle: name, seoDescription: description, thumbnail: '', content, keywords: Array.isArray(d.topics) ? d.topics : [], apiStatus: api.status, htmlStatus: html.status, readmeStatus: readme.status }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}