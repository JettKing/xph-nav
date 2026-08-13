const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]+/g, ' ').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const DEEPSEEK_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 5;
const isValid16 = value => { const v = clean(value); return count(v) === 16 && /[\u3400-\u9fff]/.test(v) && !/^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v) && !/[\r\n]/.test(v); };
const isValidManual = value => { const v = clean(value); return count(v) >= 1 && count(v) <= 16 && !/[\r\n]/.test(v); };
const genericPattern = /(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备)/;

function corsHeaders(origin) {
  const allowed = new Set(['https://xph.asia', 'https://www.xph.asia']);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://xph.asia',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function normalizeTaxonomy(input) {
  if (!Array.isArray(input)) return [];
  return input.map(item => ({
    category: clean(item?.category),
    categoryName: clean(item?.categoryName),
    subcategory: clean(item?.subcategory),
    subcategoryName: clean(item?.subcategoryName)
  })).filter(item => item.category && item.subcategory && item.categoryName && item.subcategoryName);
}

function classificationIsValid(category, subcategory, taxonomy) {
  return taxonomy.some(item => item.category === category && item.subcategory === subcategory);
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request.headers.get('Origin') || '') };
  if (!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: 'Cloudflare 未配置 DEEPSEEK_API_KEY' }), { status: 500, headers });

  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: '请求 JSON 无效' }), { status: 400, headers }); }

  const name = clean(body?.name);
  const website = clean(body?.website);
  const github = clean(body?.github);
  const seoTitle = clean(body?.seoTitle);
  const seoDescription = clean(body?.seoDescription);
  const githubName = clean(body?.githubName);
  const manualDescription = clean(body?.manualDescription);
  const content = clean(body?.content).slice(0, 24000);
  const taxonomy = normalizeTaxonomy(body?.taxonomy);

  if (!name || !content) return new Response(JSON.stringify({ error: '缺少真实资源名称或真实读取内容' }), { status: 400, headers });
  if (!taxonomy.length) return new Response(JSON.stringify({ error: '缺少合法分类词库，无法进行标准分类' }), { status: 400, headers });
  if (manualDescription && !isValidManual(manualDescription)) return new Response(JSON.stringify({ error: '人工简介必须为1-16个字符且不能换行' }), { status: 400, headers });

  const taxonomyText = taxonomy.map(item => `${item.category} / ${item.subcategory} = ${item.categoryName} / ${item.subcategoryName}`).join('\n');
  const system = `你是“徐胖虎资源社”的资源标准化分析器。你必须先理解真实资源，再同时完成“16字符核心简介”和“现有分类词库中的唯一标准分类”。
严格规则：
1. 只输出 JSON，格式必须是 {"description":"...","category":"...","subcategory":"..."}。
2. category 和 subcategory 只能逐字复制下面合法词库中的 key，绝对禁止自造、改写、翻译、合并或创造新分类。
3. subcategory 必须属于所选 category；category/subcategory 必须形成词库中的真实组合。
4. 分类按资源本身的主要用途/产品类型判断，不按“用户输入的是官网还是GitHub”判断。一个AI产品应优先归入 AI工具，而不是因为它是网站就机械归入网页导航；只有主要价值就是网站导航、搜索、学习、社区、在线服务目录等时才使用网页导航。
5. 选择一个最核心、最主要的子分类，不要返回多个分类。
6. description 如果没有人工简介，必须恰好16个字符；中文为主体，可以自然使用少量英文字母或数字，例如“AI”“K线”，不能整句全英文；必须来自真实网页/GitHub内容；优先提炼“核心对象 + 核心功能/用途 + 结果”，不要写空话。
7. 如果提供了人工简介，description 必须原样返回，不得修改、翻译、补字或重写；人工简介优先级高于AI生成简介。
8. 简介禁止营销口号、夸张评价、无依据功能、重复堆词、为了凑16字硬塞英文或数字。AI生成简介禁止使用“专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备”等泛化营销词。
9. 资源名称只用于识别对象，不要把资源名称本身当成简介；不要把SEO整句直接复制成简介；不要把“工具、平台、官网、GitHub”等空泛词作为主要信息。
10. SEO标题、SEO描述、GitHub项目描述、README和网页正文都是有效真实信息。先综合这些资料理解资源，再做简介和分类。
11. 不能根据常识臆测资料中没有的功能；分类也必须以真实资料为依据。
12. 生成后在内部逐字符检查description；AI生成时必须正好16字符并包含中文。分类必须逐项检查是否存在于合法词库。

合法分类词库如下：
${taxonomyText}`;

  const baseUser = `资源真实名称：${name}
官网：${website}
GitHub：${github}
GitHub项目名称：${githubName}
网页SEO标题：${seoTitle}
网页SEO描述：${seoDescription}
人工简介：${manualDescription || '无，请生成16字符核心简介'}

以下是系统已经读取并缓存的真实网页/GitHub内容。不要再次访问 URL，也不要假设没有提供的内容：
${content}

请先判断资源真正解决什么问题、最核心的功能和主要用途，再从合法词库中选择唯一最匹配的 category + subcategory。
若没有人工简介：先在内部拟定候选简介并逐字符计数，最终只输出恰好16字符的核心简介。严禁为了凑16字在末尾添加“工具、平台、软件、资源、应用、专业、强大、实用”等空泛词。
若有人工简介，原样保留。
输出前再次检查：description 是否正好16字符、是否中文为主体、是否来自真实资料、是否自然完整；category/subcategory 是否是词库中的真实组合。
只返回 JSON。`;

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const retryHint = attempt > 1
        ? `\n这是第 ${attempt} 次生成。上一轮结果未通过最终校验。不要返回上一轮原文，也不要机械补字。
上一轮生成未通过最终校验。请完全重新根据原始资料独立生成，不要复用、续写或机械修改任何上一轮答案。
请重新判断资源核心用途、重新选择合法分类，并重新生成简介。
【简介硬性验收】AI生成简介必须恰好16个字符（中文、英文字母、数字均按1字符计），必须是自然完整的中文核心简介，中文为主体；不要通过加“工具、平台、软件、专业、强大、实用”等空泛词凑长度。生成后请在输出前自行逐字符计数。`
        : '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);
      let upstream;
      try {
        upstream = await fetch(DEEPSEEK_API_URL, {
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
            thinking: { type: 'disabled' },
            max_tokens: 320,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            stream: false
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }

      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        lastError = new Error(data?.error?.message || `DeepSeek HTTP ${upstream.status}`);
        if (upstream.status >= 400 && upstream.status < 500 && upstream.status !== 429) break;
        continue;
      }

      const choice = data?.choices?.[0];
      const contentText = choice?.message?.content || '';
      if (!contentText) { lastError = new Error('DeepSeek 返回内容为空'); continue; }

      let parsed;
      try { parsed = JSON.parse(contentText); }
      catch {
        const reason = choice?.finish_reason ? `（finish_reason=${choice.finish_reason}）` : '';
        lastError = new Error(`DeepSeek 返回 JSON 无法解析${reason}`);
        continue;
      }

      let description = clean(parsed?.description);
      // 兼容模型偶尔把简介放在 description_text / summary 字段。
      if (!description) description = clean(parsed?.description_text || parsed?.summary);
      const category = clean(parsed?.category);
      const subcategory = clean(parsed?.subcategory);

      const descriptionValid = manualDescription
        ? description === manualDescription
        : isValid16(description) && /[\u3400-\u9fff]/.test(description) && Array.from(description).filter(ch => /[\u3400-\u9fff]/.test(ch)).length >= 6 && !genericPattern.test(description);
      const classificationValid = classificationIsValid(category, subcategory, taxonomy);

      if (descriptionValid && classificationValid) {
        return new Response(JSON.stringify({ description, category, subcategory, model: data.model || MODEL }), { status: 200, headers });
      }

      const errors = [];
      if (!descriptionValid) errors.push(manualDescription ? '人工简介未原样保留' : `简介未通过16字符质量校验：${count(description)}字符（必须恰好16字符）`);
      if (!classificationValid) errors.push('分类不在合法词库或父子分类不匹配');
      lastError = new Error(`DeepSeek 返回结果未通过最终校验：${errors.join('；')}`);
    } catch (error) {
      lastError = error?.name === 'AbortError' ? new Error('DeepSeek 请求超时，请稍后重试') : error;
    }
  }

  const status = /超时/.test(lastError?.message || '') ? 504 : 422;
  return new Response(JSON.stringify({ error: lastError?.message || 'DeepSeek 分析失败' }), { status, headers });
}