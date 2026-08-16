import { XPH_RESOURCE_CONTRACT } from '../../shared/resource-contract.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const REQUEST_TIMEOUT_MS = 45000;
const POLICY = XPH_RESOURCE_CONTRACT.candidatePolicy;
const ERR = XPH_RESOURCE_CONTRACT.errors;

const clean = value => String(value ?? '').trim().replace(/[\r\n]+/g, ' ').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const count = value => Array.from(clean(value)).length;
const cjkCount = value => Array.from(clean(value)).filter(ch => /[\u3400-\u9fff]/.test(ch)).length;
const banned = /(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备|一站式)/;
const filler = /(工具|平台|软件|资源|应用|实用|便捷)$/;

function validation(value) {
  const v = clean(value), reasons = [];
  if (count(v) !== 16) reasons.push(`长度${count(v)}`);
  if (cjkCount(v) < 6) reasons.push(`中文${cjkCount(v)}`);
  if (/^[A-Za-z0-9\s.,!?;:()[\]{}+\-_/&%#]+$/.test(v)) reasons.push('纯英文/数字');
  if (banned.test(v)) reasons.push('营销词');
  if (filler.test(v)) reasons.push('空泛结尾');
  return { value: v, valid: reasons.length === 0, reasons };
}
const isValid16 = value => validation(value).valid;

const normalizeTaxonomy = input => Array.isArray(input)
  ? input.map(x => ({ category: clean(x?.category), categoryName: clean(x?.categoryName), subcategory: clean(x?.subcategory), subcategoryName: clean(x?.subcategoryName) }))
    .filter(x => x.category && x.subcategory && x.categoryName && x.subcategoryName)
  : [];
const normalizeIconMap = input => input && typeof input === 'object' && !Array.isArray(input)
  ? Object.fromEntries(Object.entries(input).map(([k,v]) => [clean(k), clean(v)]).filter(([k,v]) => k && v))
  : {};
const norm = value => clean(value).toLowerCase().replace(/[\s_\-–—·•/|｜:：]+/g, '');
const resolveClassification = (category, subcategory, taxonomy) => {
  const c = norm(category), sc = norm(subcategory);
  if (!c && !sc) return null;
  const exact = taxonomy.find(x => norm(x.category) === c && norm(x.subcategory) === sc);
  if (exact) return exact;
  const labelPair = taxonomy.find(x => (norm(x.category) === c || norm(x.categoryName) === c) && (norm(x.subcategory) === sc || norm(x.subcategoryName) === sc));
  if (labelPair) return labelPair;
  const subOnly = taxonomy.filter(x => norm(x.subcategory) === sc || norm(x.subcategoryName) === sc);
  if (subOnly.length === 1) return subOnly[0];
  const catOnly = taxonomy.filter(x => norm(x.category) === c || norm(x.categoryName) === c);
  if (catOnly.length === 1) return catOnly[0];
  return null;
};

const cors = origin => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': ['https://xph.asia', 'https://www.xph.asia'].includes(origin) ? origin : 'https://xph.asia',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
  'Cache-Control': 'no-store'
});

function responseEnvelope({ ok, status, stage, data = null, code = '', message = '', details = null }, headers, httpStatus) {
  return new Response(JSON.stringify({
    ok, status, stage, data,
    error: ok ? null : { code, message, details }
  }), { status: httpStatus, headers });
}

async function callDeepSeek(env, messages, maxTokens = 700, temperature = 0.35) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, thinking: { type: 'disabled' }, max_tokens: maxTokens, temperature, response_format: { type: 'json_object' }, stream: false }),
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
const taxonomyText = taxonomy => taxonomy.map(x => `${x.category} | ${x.categoryName} | ${x.subcategory} | ${x.subcategoryName}`).join('\n');

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const headers = cors(request.headers.get('Origin') || '');
  if (!env.DEEPSEEK_API_KEY) return responseEnvelope({ ok:false, status:'error', stage:'error', code:ERR.AI_NOT_CONFIGURED, message:'Cloudflare 未配置 DEEPSEEK_API_KEY' }, headers, 500);

  let body;
  try { body = await request.json(); }
  catch { return responseEnvelope({ ok:false, status:'error', stage:'error', code:ERR.INVALID_REQUEST, message:'请求 JSON 无效' }, headers, 400); }

  const taxonomy = normalizeTaxonomy(body?.taxonomy);
  const iconMap = normalizeIconMap(body?.iconMap);
  const manualDescription = clean(body?.manualDescription);
  if (!clean(body?.name) || !clean(body?.content)) return responseEnvelope({ ok:false, status:'error', stage:'error', code:ERR.MISSING_SOURCE, message:'缺少真实资源名称或真实读取内容' }, headers, 400);
  if (!taxonomy.length) return responseEnvelope({ ok:false, status:'error', stage:'error', code:ERR.MISSING_TAXONOMY, message:'缺少合法分类词库' }, headers, 400);
  if (manualDescription && (count(manualDescription) > 16 || /[\r\n]/.test(manualDescription))) return responseEnvelope({ ok:false, status:'error', stage:'error', code:ERR.INVALID_REQUEST, message:'人工简介超过16字符或包含换行' }, headers, 400);

  const source = sourceBlock(body);
  const taxonomyPrompt = taxonomyText(taxonomy);
  let semantic;
  try {
    const semanticSystem = `你是徐胖虎资源社资源事实分析器。只理解真实来源，不写营销文案。\n输出JSON：{"core":"...","facts":["..."],"category":"合法分类ID或分类名","subcategory":"合法子分类ID或子分类名"}\n规则：\n1. core只写第一核心用途。\n2. facts最多5条，只允许真实内容明确支持的事实。\n3. 分类必须从下方词库选择，不得创造新词。优先输出ID。\n4. 按真实用途分类，不按URL类型分类。\n合法词库：\n${taxonomyPrompt}`;
    semantic = (await callDeepSeek(env, [{ role:'system', content:semanticSystem }, { role:'user', content:`${source}\n\n只返回JSON。` }], 650, 0.15)).value;
  } catch (error) {
    return responseEnvelope({ ok:false, status:'error', stage:'understanding_content', code:ERR.AI_SEMANTIC_FAILED, message:error?.message || 'DeepSeek语义分析失败' }, headers, 422);
  }

  const core = clean(semantic?.core);
  const facts = Array.isArray(semantic?.facts) ? semantic.facts.map(clean).filter(Boolean).slice(0, 5) : [];
  let resolved = resolveClassification(semantic?.category, semantic?.subcategory, taxonomy);
  if (!resolved) {
    try {
      const classifySystem = `你是资源分类器。只能从给出的合法分类ID中选择一个。禁止创造任何新ID或名称。只返回JSON：{"category":"...","subcategory":"..."}`;
      const retry = (await callDeepSeek(env, [
        { role:'system', content:classifySystem },
        { role:'user', content:`${source}\n核心用途：${core}\n\n合法分类：\n${taxonomyPrompt}\n\n只返回一个合法category和subcategory。` }
      ], 180, 0.05)).value;
      resolved = resolveClassification(retry?.category, retry?.subcategory, taxonomy);
    } catch {}
  }
  if (!resolved) return responseEnvelope({ ok:false, status:'error', stage:'understanding_content', code:ERR.CLASSIFICATION_FAILED, message:'无法从合法分类词库中确定可靠分类，请检查分类词库或真实来源内容' }, headers, 422);

  const icon = iconMap[resolved.subcategory];
  if (!icon) return responseEnvelope({ ok:false, status:'error', stage:'finalizing', code:ERR.CLASSIFICATION_FAILED, message:`子分类 ${resolved.subcategory} 没有合法 Icon 映射` }, headers, 422);

  if (manualDescription) {
    return responseEnvelope({
      ok:true, status:'completed', stage:'completed',
      data:{ contractVersion:XPH_RESOURCE_CONTRACT.version, core, facts, category:resolved.category, categoryName:resolved.categoryName, subcategory:resolved.subcategory, subcategoryName:resolved.subcategoryName, icon, candidates:[], selectedIndex:null, description:manualDescription, model:MODEL, generationCalls:0, selectionCalls:0, validCandidates:0 }
    }, headers, 200);
  }

  const generationSystem = `你是徐胖虎资源社的16字简介候选生成器。\n一次只能生成1条候选。\n只返回JSON：{"candidate":"..."}\n严格规则：\n1. candidate恰好16字符；中文、英文、数字、标点均按1字符计算。\n2. 中文至少6个字符。\n3. 只表达第一核心用途，不写营销词，不写空泛凑字词。\n4. 不得编造真实来源没有的功能。\n5. 禁止解释，禁止返回其他字段。\n禁止词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备、一站式。`;
  const generationUser = `${source}\n\n核心用途：${core}\n事实：${facts.join('；')}\n分类：${resolved.categoryName}/${resolved.subcategoryName}\n\n这是一次独立生成，只生成1条候选。`;

  const allCandidates = [];
  const attemptReports = [];
  let generationCalls = 0;
  for (let attempt = 1; attempt <= POLICY.maxAttempts; attempt++) {
    try {
      const result = (await callDeepSeek(env, [
        { role:'system', content:generationSystem },
        { role:'user', content:`${generationUser}\n独立生成编号：${attempt}` }
      ], 160, 0.85)).value;
      generationCalls++;
      const raw = clean(result?.candidate);
      const checked = validation(raw);
      if (checked.valid && !allCandidates.includes(checked.value)) allCandidates.push(checked.value);
      attemptReports.push({ attempt, returned: raw ? 1 : 0, valid: checked.valid ? 1 : 0, reasons: checked.valid ? [] : checked.reasons });
    } catch (error) {
      generationCalls++;
      attemptReports.push({ attempt, returned:0, valid:0, error:error?.message || '生成失败' });
    }
  }

  if (!allCandidates.length) return responseEnvelope({
    ok:false, status:'error', stage:'validating_candidates', code:ERR.NO_VALID_CANDIDATE,
    message:`最多${POLICY.maxAttempts}次独立生成后没有候选通过严格16字程序验收`,
    details:{ generationCalls, maxAttempts:POLICY.maxAttempts, candidatesPerAttempt:POLICY.candidatesPerAttempt, attemptReports }
  }, headers, 422);

  let selectedIndex;
  try {
    const selectionSystem = `你是徐胖虎资源社简介最终选择器。\n你只能从候选列表中原样选择一条。\n禁止修改、润色、截断、合并、重写任何候选。\n只返回JSON：{"selectedIndex":1}\nselectedIndex必须是列表中的整数。`;
    const selectionUser = `真实核心用途：${core}\n真实事实：${facts.join('；')}\n\n合法候选（原样，不得修改）：\n${allCandidates.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n只能返回selectedIndex。`;
    const selected = (await callDeepSeek(env, [
      { role:'system', content:selectionSystem },
      { role:'user', content:selectionUser }
    ], 80, 0.05)).value;
    const idx = Number(selected?.selectedIndex);
    if (!Number.isInteger(idx) || idx < 1 || idx > allCandidates.length) throw new Error('selectedIndex无效');
    selectedIndex = idx;
  } catch (error) {
    return responseEnvelope({ ok:false, status:'error', stage:'selecting_candidate', code:ERR.INVALID_SELECTION, message:error?.message || 'AI最终选择失败', details:{ validCandidates:allCandidates.length } }, headers, 422);
  }

  const description = allCandidates[selectedIndex - 1];
  if (!isValid16(description)) return responseEnvelope({ ok:false, status:'error', stage:'finalizing', code:ERR.FINAL_VALIDATION_FAILED, message:'最终选择结果未通过程序验收', details:{ selectedIndex, validCandidates:allCandidates.length } }, headers, 422);

  return responseEnvelope({
    ok:true, status:'completed', stage:'completed',
    data:{
      contractVersion:XPH_RESOURCE_CONTRACT.version,
      core, facts,
      category:resolved.category, categoryName:resolved.categoryName,
      subcategory:resolved.subcategory, subcategoryName:resolved.subcategoryName,
      icon,
      candidates:allCandidates,
      selectedIndex,
      description,
      model:MODEL,
      generationCalls,
      selectionCalls:1,
      validCandidates:allCandidates.length,
      maxAttempts:POLICY.maxAttempts,
      candidatesPerAttempt:POLICY.candidatesPerAttempt,
      attemptReports
    }
  }, headers, 200);
}