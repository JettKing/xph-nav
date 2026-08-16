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
function chooseName(html, url) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
  const bad = /^(home|homepage|official website|website|welcome|login|sign in|sign up|menu|navigation|search|untitled|首页|主页|登录|注册)$/i;
  const candidates = [[extractMeta(html, 'og:site_name'), 140], [extractMeta(html, 'application-name'), 135], [extractMeta(html, 'og:title'), 125], [extractTitle(html), 110], [extractH1(html), 90]].filter(x => x[0]);
  return candidates.map(([value, score]) => {
    const x = cleanText(value).replace(/^[-–—|:：]+|[-–—|:：]+$/g, '').trim(); let s = score;
    if (!x || bad.test(x)) s -= 200;
    if (host && x.toLowerCase().replace(/\s+/g, '') === host.replace(/\s+/g, '')) s -= 100;
    if (x.length > 80) s -= 50;
    if (/^(best|free|official|the official|open source|open-source)\b/i.test(x)) s -= 30;
    return { x, s };
  }).sort((a, b) => b.s - a.s)[0]?.x || '';
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
  if (!input) return new Response(JSON.stringify({ error: '官网 URL 无效' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  try { if (isGithubHost(new URL(input).hostname)) throw new Error('GitHub URL 应走 GitHub 专用读取层'); } catch (e) { return new Response(JSON.stringify({ error: e.message || '官网 URL 无效' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
  let response;
  try { response = await fetchText(input); } catch (e) { return new Response(JSON.stringify({ error: e?.name === 'AbortError' ? '官网读取超时' : '官网读取失败' }), { status: 504, headers: { 'Content-Type': 'application/json' } }); }
  if (!response.ok || !response.text) return new Response(JSON.stringify({ error: `官网读取失败：HTTP ${response.status || 0}` }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  const raw = response.text;
  const name = chooseName(raw, input);
  const title = extractTitle(raw);
  const description = extractDescription(raw);
  const canonical = extractCanonical(raw);
  const thumbnail = extractThumbnail(raw);
  const githubCandidates = extractGithubCandidates(raw);
  const content = [`官方网站：${normalizeUrl(response.url) || input}`, name ? `真实名称候选：${name}` : '', title ? `网页标题：${title}` : '', description ? `SEO描述：${description}` : '', canonical ? `Canonical：${canonical}` : '', githubCandidates.length ? `GitHub候选：${githubCandidates.join(' | ')}` : '', `网页真实内容：${stripHtml(raw).slice(0, 22000)}`].filter(Boolean).join('\n\n').slice(0, 26000);
  return new Response(JSON.stringify({ website: normalizeUrl(response.url) || input, name, seoTitle: title, seoDescription: description, canonical, github: githubCandidates[0] || '', githubCandidates, thumbnail, content, source: 'official-web-server' }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}