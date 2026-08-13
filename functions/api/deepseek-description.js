const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-flash';
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]/g, '').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const isValid16 = value => /^[\u3400-\u9fff]{16}$/.test(clean(value));

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

  const system = `你是“徐胖虎资源社”的资源简介生成器。你只能根据用户提供的真实网页/GitHub读取内容生成简介。
严格规则：
1. 只输出 JSON，格式必须是 {"description":"16个中文字符"}。
2. description 必须恰好16个字符，并且只能由中文汉字组成。
3. 必须概括真实内容，不能凭资源名称臆测功能。
4. 禁止输出网址、域名、品牌名、英文、数字、emoji、营销口号、夸张评价。
5. 禁止修改、翻译、中文化资源名称；资源名称不是你的输出字段。
6. 不要引用“官网”“GitHub”“工具”等空泛词作为主要内容，必须体现真实功能/用途。
7. 如果内容不足以可靠概括，仍只能从已提供内容中选择最明确的真实用途，不得编造。
JSON 示例：{"description":"用于自动整理和分析数据内容"}`;

  const user = `资源真实名称：${name}
官网：${website}
GitHub：${github}

以下是系统已经读取并缓存的真实网页/GitHub内容。不要再次访问 URL，也不要假设没有提供的内容：
${content}

请根据以上真实内容生成严格16个中文字符的核心简介，并只返回 JSON。`;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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
            { role: 'user', content: user + (attempt > 1 ? `\n上一次结果不合格，请重新生成。必须通过正则 ^[\\u3400-\\u9fff]{16}$。` : '') }
          ],
          thinking: { type: 'disabled' },
          max_tokens: 64,
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
      if (isValid16(description)) return new Response(JSON.stringify({ description, model: data.model || MODEL }), { status: 200, headers });
      lastError = new Error(`DeepSeek 返回简介长度/格式不合格：${count(description)} 字符`);
    } catch (error) { lastError = error; }
  }

  return new Response(JSON.stringify({ error: lastError?.message || 'DeepSeek 简介生成失败' }), { status: 422, headers });
}