const clean = value => typeof value === 'string' ? value.trim() : '';
const normalizeUrl = value => {
  const raw = clean(value);
  if (!raw) return '';
  try { const u = new URL(raw); if (!/^https?:$/.test(u.protocol)) return ''; u.hash = ''; return u.href.replace(/\/$/, '') || u.href; } catch { return ''; }
};
const normalizeGithub = value => {
  const raw = clean(value).replace(/[)\]}>.,;]+$/g, '');
  const m = raw.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s)\]]+)\/([^/#?\s)\]]+)/i);
  return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, '')}` : '';
};
const isGithubHost = host => /(?:^|\.)(?:github\.com|githubusercontent\.com)$/i.test(host);
const validExternal = value => {
  const u = normalizeUrl(value);
  if (!u) return '';
  try { const host = new URL(u).hostname.toLowerCase(); if (isGithubHost(host) || /^(?:githubassets\.com|gist\.github\.com)$/.test(host)) return ''; return u; } catch { return ''; }
};
const unique = values => [...new Set((values || []).map(clean).filter(Boolean))];
const stripHtml = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
const cleanText = value => String(value || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_>#~]/g, ' ').replace(/\s+/g, ' ').trim();
function extractMeta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const m = String(html || '').match(re); return clean(m?.[1] || m?.[2] || '');
}
function extractTitle(html) { const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i); return cleanText(m?.[1] || ''); }
function extractH1(html) { const m = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); return cleanText(stripHtml(m?.[1] || '')); }
function extractCanonical(html) {
  const m = String(html || '').match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i) || String(html || '').match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i);
  return validExternal(m?.[1] || '');
}
function extractGithubCandidates(html) {
  const s = String(html || '').replace(/&amp;/gi, '&').replace(/\\\//g, '/');
  const found = [];
  const add = value => { const repo = normalizeGithub(value); if (repo) found.push(repo); };
  for (const m of s.matchAll(/(?:href|data-href|data-url|data-link|data-target)\s*=\s*["']([^"']*github\.com\/[^"']+)["']/gi)) add(m[1]);
  for (const m of s.matchAll(/\[[^\]]{0,160}\]\((https?:\/\/(?:www\.)?github\.com\/[^)\s]+)\)/gi)) add(m[1]);
  for (const m of s.matchAll(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/gi)) add(m[0]);
  return unique(found);
}

function normalizeProjectName(value) {
  let x = cleanText(value)
    .replace(/\s*(?:[|ï½]|â|â|-|Â·|â¢)\s*(?:the\s+)?(?:official\s+)?(?:website|github|gitlab|bitbucket)\s*$/i, '')
    .trim();
  // å¸¸è§ç½é¡µæ é¢ï¼åçå â ä¸å¥è¯å®ä½ / åçå: äº§åæè¿°ã
  // åªåç¬¬ä¸ä¸ªæç¡®çåç/é¡¹ç®æ®µï¼é¿åæSEOå¯æ é¢å¸¦è¿çå®åç§°ã
  const parts = x.split(/\s*(?:â|â|Â·|â¢|\s+-\s+|\||ï½)\s*|\s*:\s+/).map(v => v.trim()).filter(Boolean);
  if (parts.length > 1 && parts[0].length >= 2 && parts[0].length <= 48) x = parts[0];
  x = x.replace(/\s+(?:[-ââ|ï½:ï¼]\s*)?(?:your|the|a)\s+(?:private|open[- ]source|free|online)\b.*$/i, '').trim();
  return x;
}
function nameSignal(value) {
  const x = normalizeProjectName(value);
  if (!x) return { value: '', score: -999 };
  const bad = /^(home|homepage|official website|website|welcome|login|sign in|sign up|menu|navigation|search|untitled|é¦é¡µ|ä¸»é¡µ|ç»å½|æ³¨å)$/i;
  let score = 0;
  if (bad.test(x)) score -= 300;
  if (x.length > 80) score -= 100;
  if (/^(best|free|official|the official|open source|open-source)\b/i.test(x)) score -= 30;
  return { value: x, score };
}
function chooseName(html, url) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
  const candidates = [
    [extractMeta(html, 'og:site_name'), 180],
    [extractMeta(html, 'application-name'), 175],
    [extractMeta(html, 'og:title'), 160],
    [extractH1(html), 150],
    [extractTitle(html), 140]
  ].filter(x => x[0]).map(([value, base]) => {
    const signal = nameSignal(value);
    let score = base + signal.score;
    const compactHost = host.replace(/[^a-z0-9]+/g, '');
    const compactName = signal.value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (compactHost && compactName === compactHost) score += 40;
    if (compactName && compactHost.includes(compactName)) score += 20;
    return { x: signal.value, s: score };
  }).sort((a, b) => b.s - a.s);
  return candidates[0]?.x || '';
}
function extractDescription(html) { return cleanText(extractMeta(html, 'description') || extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description')); }
function extractThumbnail(html) { return validExternal(extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')); }
async function fetchText(url, ms = 18000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8', 'User-Agent': 'XPH-Resource-Importer/5.3' }, signal: c.signal, redirect: 'follow' }); return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '', url: r.url || url }; }
  finally { clearTimeout(t); }
}
export async function onRequestOptions() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }); }
export async function onRequestGet({ request }) {
  const input = normalizeUrl(new URL(request.url).searchParams.get('url'));
  if (!input) return new Response(JSON.stringify({ error: 'å®ç½ URL æ æ' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try { if (isGithubHost(new URL(input).hostname)) throw new Error('GitHub URL åºèµ° GitHub ä¸ç¨è¯»åå±'); } catch (e) { return new Response(JSON.stringify({ error: e.message || 'å®ç½ URL æ æ' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
  let response;
  try { response = await fetchText(input); } catch (e) { return new Response(JSON.stringify({ error: e?.name === 'AbortError' ? 'å®ç½è¯»åè¶æ¶' : 'å®ç½è¯»åå¤±è´¥' }), { status: 504, headers: { 'Content-Type': 'application/json' } }); }
  if (!response.ok || !response.text) return new Response(JSON.stringify({ error: `å®ç½è¯»åå¤±è´¥ï¼HTTP ${response.status || 0}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  const raw = response.text;
  const name = chooseName(raw, input);
  const title = extractTitle(raw);
  const description = extractDescription(raw);
  const canonical = extractCanonical(raw);
  const thumbnail = extractThumbnail(raw);
  const githubCandidates = extractGithubCandidates(raw);
  const content = [`å®æ¹ç½ç«ï¼${normalizeUrl(response.url) || input}`, name ? `çå®åç§°åéï¼${name}` : '', title ? `ç½é¡µæ é¢ï¼${title}` : '', description ? `SEOæè¿°ï¼${description}` : '', canonical ? `Canonicalï¼${canonical}` : '', githubCandidates.length ? `GitHubåéï¼${githubCandidates.join(' | ')}` : '', `ç½é¡µçå®åå®¹ï¼${stripHtml(raw).slice(0, 22000)}`].filter(Boolean).join('\n\n').slice(0, 26000);
  return new Response(JSON.stringify({ website: normalizeUrl(response.url) || input, name, seoTitle: title, seoDescription: description, canonical, github: githubCandidates[0] || '', githubCandidates, thumbnail, content, source: 'official-web-server' }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}