const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const REQUEST_TIMEOUT_MS = 45000;
const clean = value => String(value ?? '').trim().replace(/[\r\n]+/g, ' ').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const count = value => Array.from(clean(value)).length;
const cjkCount = value => Array.from(clean(value)).filter(ch => /[\u3400-\u9fff]/.test(ch)).length;
const banned = /(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备|一站式)/;
const emptyPadding = /(工具|平台|软件|资源|应用|专业|强大|实用|便捷)$/;
const isValid16 = value => {
  const v = clean(value);
  if (count(v) !== 16 || cjkCount(v) < 6) return false;
  if (/^[A-Za-z0-9\s.,!?;:()[\]{}+\-_/&%#]+$/.test(v)) return false;
  if (banned.test(v) || emptyPadding.test(v)) return false;
  return true;
};
const normalizeTaxonomy = input => Array.isArray(input)
  ? input.map(x => ({ category: clean(x?.category), categoryName: clean(x?.categoryName), subcategory: clean(x?.subcategory), subcategoryName: clean(x?.subcategoryName) })).filter(x => x.category && x.subcategory && x.categoryName && x.subcategoryName)
  : [];
const classificationIsValid = (category, subcategory, taxonomy) => taxonomy.some(x => x.category === category && x.subcategory === subcategory);
const resolveClassification = (category, subcategory, taxonomy) => {
  const c = clean(category), sc = clean(subcategory);
  const exact = taxonomy.find(x => x.category === c && x.subcategory === sc);
  if (exact) return exact;
  const byLabel = taxonomy.find(x =>
    (x.categoryName === c || x.category === c) &&
    (x.subcategoryName === sc || x.subcategory === sc)
  );
  if (byLabel) return byLabel;
  const bySubLabel = taxonomy.find(x => x.subcategoryName === sc);
  if (bySubLabel) return bySubLabel;
  return null;
};
const cors = origin => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': ['https://xph.asia', 'https://www.xph.asia'].includes(origin) ? origin : 'https://xph.asia',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin'
});
async function callDeepSeek(env, messages, maxTokens = 700) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, thinking: { type: 'disabled' }, max_tokens: maxTokens, temperature: 0.15, response_format: { type: 'json_object' }, stream: false }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `DeepSeek HTTP ${response.status}`);
    const raw = data?.choices?.[0]?.message?.content || '';
    if (!raw) throw new Error('DeepSeek 返回内容为空');
    try { return { model: data?.model || MODEL, value: JSON.parse(raw) }; }
    catch { throw new Error('DeepSeek 返回 JSON 无法解析'); }
  } finally { clearTimeout(timer); }
}
function sourceBlock(body) {
  return [
    `资源名称：${clean(body.name)}`,
    `官网：${clean(body.website)}`,
    `GitHub：${clean(body.github)}`,
    `GitHub项目名称：${clean(body.githubName)}`,
    `SEO标题：${clean(body.seoTitle)}`,
    `SEO描述：${clean(body.seoDescription)}`,
    '真实来源内容：', clean(body.content).slice(0, 24000)
  ].filter(Boolean).join('\n');
}
export async function onRequestOptions({ request }) { return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') }); }
export async function onRequestPost({ request, env }) {
  const headers = cors(request.headers.get('Origin') || '');
  if (!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: 'Cloudflare 未配置 DEEPSEEK_API_KEY' }), { status: 500, headers });
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: '请求 JSON 无效' }), { status: 400, headers }); }
  const taxonomy = normalizeTaxonomy(body?.taxonomy);
  const manualDescription = clean(body?.manualDescription);
  if (!clean(body?.name) || !clean(body?.content)) return new Response(JSON.stringify({ error: '缺少真实资源名称或真实读取内容' }), { status: 400, headers });
  if (!taxonomy.length) return new Response(JSON.stringify({ error: '缺少合法分类词库' }), { status: 400, headers });
  if (manualDescription && (count(manualDescription) > 16 || /[\r\n]/.test(manualDescription))) return new Response(JSON.stringify({ error: '人工简介超过16字符或包含换行' }), { status: 400, headers });

  const source = sourceBlock(body);
  const taxonomyText = taxonomy.map(x => `${x.category}/${x.subcategory} = ${x.categoryName}/${x.subcategoryName}`).join('\n');

  // 第1次AI调用：只做语义理解和标准分类，不生成简介。
  const semanticSystem = `你是徐胖虎资源社的“资源事实分析器”。你只负责理解真实资料和标准分类，不写营销文案，不生成16字简介。
输出JSON：{"core":"...","facts":["..."],"category":"...","subcategory":"..."}
规则：
1. core只概括第一核心用途，不罗列次要功能。
2. facts只写原始资料明确支持的事实，最多5条。
3. category/subcategory只能逐字复制合法词库。
4. 按资源真正用途分类，不按URL类型分类。
5. 禁止根据名字猜测不存在的功能。
合法词库：\n${taxonomyText}`;
  let semantic;
  try {
    semantic = (await callDeepSeek(env, [{ role: 'system', content: semanticSystem }, { role: 'user', content: `${source}\n\n只返回语义分析JSON。` }], 650)).value;
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || 'DeepSeek语义分析失败' }), { status: 422, headers });
  }
  const core = clean(semantic?.core);
  const resolved = resolveClassification(semantic?.category, semantic?.subcategory, taxonomy);
  if (!resolved) return new Response(JSON.stringify({ error: 'AI返回的分类不在现有合法分类词库中' }), { status: 422, headers });
  const category = resolved.category, subcategory = resolved.subcategory;
  const facts = Array.isArray(semantic?.facts) ? semantic.facts.map(clean).filter(Boolean).slice(0, 5) : [];
  if (!classificationIsValid(category, subcategory, taxonomy)) return new Response(JSON.stringify({ error: 'AI返回的分类不在现有合法分类词库中' }), { status: 422, headers });
  if (manualDescription) return new Response(JSON.stringify({ description: manualDescription, category, subcategory, model: MODEL, calls: 1 }), { status: 200, headers });

  // 第2阶段：唯一简介决策。禁止候选池、禁止5×5、禁止让AI从多个候选中再挑一个。
  // AI先给出唯一答案；若程序验收失败，只把“失败原因”反馈给AI做定向修正。
  const descriptionSystem = `你是徐胖虎资源社的“核心简介决策器”。
你的任务：根据真实来源内容和第一核心用途，生成一条自然、准确、恰好16字符的中文为主简介。
只输出JSON：{"description":"..."}。
规则：
1. description必须恰好16字符；中文、英文、数字、标点均各计1字符。
2. 必须以中文为主体；允许AI、Git、GitHub、API、RSS、CI、PR等必要英文缩写，但禁止整句纯英文。
3. 只表达第一核心用途，不罗列次要功能，不把名称或SEO标题改写成简介。
4. 简介必须来自真实资料，不得猜测不存在的功能。
5. 禁止营销词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备、一站式。
6. 禁止使用“工具、平台、软件、资源、应用、实用、便捷”等空泛词凑长度；只有它们本身就是核心用途且不可替代时才允许使用。
7. 英文可以出现在中文简介中，例如“AI结合八字生成个人运势K线图”，但全英文简介不允许。
8. 先在内部逐字符计数，再返回唯一结果；不要解释，不要返回候选数组。`;
  const descriptionUser = `${source}\n\nAI事实分析：\n核心用途：${core}\n事实：${facts.join('；')}\n分类：${category}/${subcategory}\n\n请生成唯一的16字符核心简介。`;

  const validationReason = value => {
    const v = clean(value);
    if (!v) return '简介为空。';
    const n = count(v), cjk = cjkCount(v);
    const reasons = [];
    if (n !== 16) reasons.push(`当前为${n}字符，必须恰好16字符。`);
    if (cjk < 6) reasons.push(`当前中文字符仅${cjk}个，必须以中文为主体。`);
    if (/^[A-Za-z0-9\\s.,!?;:()[\\]{}+\\-_/&%#]+$/.test(v)) reasons.push('不能是全英文/数字/符号。');
    if (banned.test(v)) reasons.push('包含禁止的营销词。');
    if (emptyPadding.test(v)) reasons.push('存在用于凑长度的空泛结尾词。');
    return reasons.join(' ');
  };

  let description = '';
  let descriptionCalls = 0;
  let lastFailure = '';
  const maxDescriptionAttempts = 4; // 1次初稿 + 最多3次定向修正，不形成候选池。
  for (let attempt = 1; attempt <= maxDescriptionAttempts; attempt++) {
    const prompt = attempt === 1
      ? descriptionUser
      : `${descriptionUser}\n\n上一次唯一简介：${description}\n程序验收失败原因：${lastFailure}\n请只针对上述失败原因修正这一条简介。不要生成候选列表，不要解释，仍然只返回 {"description":"..."}。`;
    try {
      const result = await callDeepSeek(env, [
        { role: 'system', content: descriptionSystem },
        { role: 'user', content: prompt }
      ], 260);
      descriptionCalls++;
      description = clean(result.value?.description);
      lastFailure = validationReason(description);
      if (!lastFailure) {
        return new Response(JSON.stringify({
          description,
          category,
          subcategory,
          model: MODEL,
          calls: 1 + descriptionCalls,
          descriptionAttempts: attempt
        }), { status: 200, headers });
      }
    } catch (error) {
      descriptionCalls++;
      lastFailure = error?.message || '简介生成请求失败。';
    }
  }

  return new Response(JSON.stringify({
    error: `简介最终验收失败：${lastFailure || '未生成有效简介'}（已进行${descriptionCalls}次简介决策/修正，不生成候选池）`,
    category,
    subcategory,
    model: MODEL,
    calls: 1 + descriptionCalls,
    descriptionAttempts: descriptionCalls
  }), { status: 422, headers });