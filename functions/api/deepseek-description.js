const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]/g, '').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const isValid16 = value => { const v = clean(value); return count(v) === 16 && /[\u3400-\u9fff]/.test(v) && !/^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v) && !/[\r\n]/.test(v); };

function corsHeaders(origin) {
  const allowed = new Set([
    'https://xph.asia',
    'https://www.xph.asia'
  ]);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://xph.asia',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request.headers.get('Origin') || '') };
  if (!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: 'Cloudflare 未配置 DEEPSEEK_API_KEY' }), { status: 500, headers });

  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: '请求 JSON 无效' }), { status: 400, headers }); }

  const name = String(body?.name || '').trim();
  const website = String(body?.website || '').trim();
  const github = String(body?.github || '').trim();
  const content = String(body?.content || '').trim().slice(0, 24000);
  if (!name || !content) return new Response(JSON.stringify({ error: '缺少真实资源名称或真实读取内容' }), { status: 400, headers });

  const system = `你是“徐胖虎资源社”的资源核心简介生成器。你的任务不是凑字数，而是先真正理解资源，再把最核心、最有价值的功能压缩成一条可直接放在资源卡片上的16字符简介。
严格规则：
1. 只输出 JSON，格式必须是 {"description":"..."}。
2. description 必须恰好16个字符；字符数按 JavaScript Array.from 逐字符计算。
3. 中文为主体，可以自然使用少量英文字母或数字，例如“AI”“K线”；不能整句全英文。
4. 简介必须来自真实网页/GitHub内容，优先表达“核心对象 + 核心功能/用途 + 结果”，不要写空话。
5. 不要把资源名称、品牌名、域名、网址、官网、GitHub、工具等当成主要简介内容。
6. 禁止营销口号、夸张评价、无依据功能、重复堆词、为了凑16字硬塞英文或数字。
7. 不要修改、翻译或中文化资源名称；资源名称不是你的输出字段。
8. 如果原始信息很多，先在内部判断这个资源最核心的一个功能，再进行压缩。
9. 生成后必须在内部逐字符检查：长度必须正好16；必须包含中文；语义必须完整自然。若不满足，重新改写后再输出。
JSON示例：{"description":"AI结合八字生成个人的运势K线图"}`;

  const baseUser = `资源真实名称：${name}
官网：${website}
GitHub：${github}

以下是系统已经读取并缓存的真实网页/GitHub内容。不要再次访问 URL，也不要假设没有提供的内容：
${content}

请先理解这个资源真正解决什么问题、最核心的功能是什么，再把这个核心卖点压缩成一条严格16字符、中文为主体的资源卡片简介。只返回 JSON。`;

  let lastError = null;
  let previous = '';
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const retryHint = previous
        ? `\n上一次生成结果为：“${previous}”。它没有通过最终校验。请不要机械增删一个字，而是重新理解原始内容后重写一条更自然、更准确的16字符核心简介。失败原因：${count(previous)}个字符${/[\u3400-\u9fff]/.test(previous) ? '' : '，缺少中文'}。`
        : '';
      const upstream = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: baseUser + retryHint }
          ],
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
          max_tokens: 128,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          stream: false
        })
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        lastError = new Error(data?.error?.message || `DeepSeek HTTP ${upstream.status}`);
        continue;
      }
      const contentText = data?.choices?.[0]?.message?.content || '';
      let parsed;
      try { parsed = JSON.parse(contentText); } catch { lastError = new Error('DeepSeek 返回 JSON 无法解析'); continue; }
      const description = clean(parsed?.description);
      previous = description;
      if (isValid16(description)) return new Response(JSON.stringify({ description, model: data.model || MODEL }), { status: 200, headers });
      lastError = new Error(`DeepSeek 返回简介长度/格式不合格：${count(description)} 字符`);
    } catch (error) { lastError = error; }
  }

  return new Response(JSON.stringify({ error: lastError?.message || 'DeepSeek 简介生成失败' }), { status: 422, headers });
}