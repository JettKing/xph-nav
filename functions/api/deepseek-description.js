const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]/g, '').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const isValid16 = value => {
  const text = clean(value);
  return count(text) === 16 && /[\u3400-\u9fff]/.test(text) && /^[\u3400-\u9fffA-Za-z0-9\u3000-\u303F\uFF00-\uFF65\-_/+#&%· ]+$/.test(text);
};

function corsHeaders(origin) {
  const allowed = new Set(['https://xph.asia', 'https://www.xph.asia']);
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

  const system = `你是“徐胖虎资源社”的资源简介生成器。你只能根据系统已经读取的真实网页/GitHub内容生成资源卡片核心简介。

严格规则：
1. description 必须恰好16个字符，按 JavaScript Array.from 计数，一个都不能多，一个都不能少。
2. 简介必须以中文为主，可以自然使用少量必要的英文字母、英文缩写或数字，例如“AI结合八字生成个人的运势K线图”。禁止输出全英文简介；至少必须包含一个中文汉字。
3. 允许中文、英文字母、数字以及必要的常用标点和符号；这些字符全部计入16字符长度。
4. 必须准确概括真实网页/GitHub内容中的功能、用途或核心能力，不得根据名称猜测，不得编造。
5. 不要营销口号、夸张评价、网址、域名，不要为了凑字数堆砌无意义词语。
6. 优先使用自然、准确、像资源库卡片的短句。
7. 只返回 JSON：{"description":"..."}，不要返回 Markdown、解释或其他字段。

生成前必须逐字符检查长度和字符类型。`;

  const user = `资源真实名称：${name}
官网：${website}
GitHub：${github}

以下是系统已经读取并缓存的真实网页/GitHub内容：
${content}

只根据以上真实内容生成一个严格16字符的核心简介。`;

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
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
            { role: 'user', content: user + (attempt > 1 ? `\n上一次输出未通过程序校验。请重新生成，严格满足：恰好16字符、中文为主、允许少量英文字母/数字、禁止全英文。` : '') }
          ],
          thinking: { type: 'enabled' },
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