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
  const category = clean(semantic?.category), subcategory = clean(semantic?.subcategory), core = clean(semantic?.core);
  const facts = Array.isArray(semantic?.facts) ? semantic.facts.map(clean).filter(Boolean).slice(0, 5) : [];
  if (!classificationIsValid(category, subcategory, taxonomy)) return new Response(JSON.stringify({ error: 'AI返回的分类不在现有合法分类词库中' }), { status: 422, headers });
  if (manualDescription) return new Response(JSON.stringify({ description: manualDescription, category, subcategory, model: MODEL, calls: 1 }), { status: 200, headers });

  // 第2次AI调用：一次生成多个候选；如果一个都没有通过程序硬校验，只允许再做一次独立生成。
  const candidateSystem = `你是徐胖虎资源社的“核心简介生成器”。
你的任务是把资源的第一核心用途压缩成自然、准确、恰好16字符的中文为主简介。
输出JSON：{"candidates":["...","..."]}。
规则：
1. 每条必须恰好16字符，中文、英文、数字、标点各计1字符。
2. 中文为主体；AI、Git、GitHub、API、RSS、CI、PR等只有在确属核心用途时才可出现。
3. 只表达第一核心用途，不把多个次要功能硬塞进一句话。
4. 不照搬名称、SEO标题或原句。
5. 禁止营销词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备、一站式。
6. 禁止机械用“工具、平台、软件、资源、应用、实用、便捷”凑长度。
7. 每条候选都必须可以直接作为资源卡片简介。
8. 先在内部逐字符计数，最终只返回JSON。`;
  const candidateUser = `${source}\n\nAI事实分析：\n核心：${core}\n事实：${facts.join('；')}\n分类：${category}/${subcategory}\n\n生成5条彼此独立、但都只围绕第一核心用途的候选。`;
  let candidates = [];
  let candidateCalls = 0;
  for (let round = 1; round <= 2 && !candidates.length; round++) {
    try {
      const result = await callDeepSeek(env, [{ role: 'system', content: candidateSystem }, { role: 'user', content: `${candidateUser}\n这是第${round}轮，请重新独立理解，不参考上一轮任何候选。` }], 650);
      candidateCalls++;
      candidates = [...new Set((Array.isArray(result.value?.candidates) ? result.value.candidates : []).map(clean).filter(isValid16))];
    } catch { candidateCalls++; }
  }
  if (!candidates.length) return new Response(JSON.stringify({ error: `简介生成未通过：已完成${candidateCalls}轮独立候选生成，但没有找到合格的16字符简介。` }), { status: 422, headers });

  // 第3次AI调用：只能选择，不允许改写候选。
  const judgeSystem = `你是徐胖虎资源社的最终简介审核器。只能从候选中选择，绝对不能改写。
选择标准：
1. 最准确表达第一核心用途；
2. 最忠实于真实资料；
3. 最自然易懂；
4. 没有功能堆砌；
5. 没有营销和凑字痕迹。
只输出JSON：{"index":1}，index必须对应候选序号。`;
  const judgeUser = `${source}\n\n核心：${core}\n事实：${facts.join('；')}\n\n候选：\n${candidates.map((x, i) => `${i + 1}. ${x}`).join('\n')}`;
  try {
    const judged = (await callDeepSeek(env, [{ role: 'system', content: judgeSystem }, { role: 'user', content: judgeUser }], 200)).value;
    const index = Number(judged?.index);
    if (Number.isInteger(index) && candidates[index - 1]) {
      return new Response(JSON.stringify({ description: candidates[index - 1], category, subcategory, model: MODEL, calls: 2 + candidateCalls, candidateCount: candidates.length }), { status: 200, headers });
    }
  } catch {}

  // 最终兜底只从已经通过程序严格验收的候选中选择；不再生成、不补字、不改写。
  return new Response(JSON.stringify({ description: candidates[0], category, subcategory, model: MODEL, calls: 2 + candidateCalls, candidateCount: candidates.length, judgeFallback: true }), { status: 200, headers });
}