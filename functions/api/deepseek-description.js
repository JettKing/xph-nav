const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const DEEPSEEK_TIMEOUT_MS = 45000;
const MAX_ATTEMPTS = 5;
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]+/g, ' ').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const genericPattern = /(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备)/;
const bannedPadding = /(工具|平台|软件|资源|应用|专业|强大|实用)$/;
const isValid16 = value => {
  const v=clean(value);
  if(count(v)!==16 || !/[\u3400-\u9fff]/.test(v) || /^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v) || /[\r\n]/.test(v)) return false;
  const cjk=count(v.replace(/[^\u3400-\u9fff]/g,''));
  return cjk>=6 && !genericPattern.test(v) && !bannedPadding.test(v);
};
const isValidManual = value => { const v=clean(value); return count(v)>=1 && count(v)<=16 && !/[\r\n]/.test(v); };
function corsHeaders(origin){
  const allowed=new Set(['https://xph.asia','https://www.xph.asia']);
  return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://xph.asia','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
}
function normalizeTaxonomy(input){
  if(!Array.isArray(input))return [];
  return input.map(item=>({category:clean(item?.category),categoryName:clean(item?.categoryName),subcategory:clean(item?.subcategory),subcategoryName:clean(item?.subcategoryName)})).filter(x=>x.category&&x.subcategory&&x.categoryName&&x.subcategoryName);
}
function classificationIsValid(category,subcategory,taxonomy){return taxonomy.some(x=>x.category===category&&x.subcategory===subcategory);}
async function callDeepSeek(env,messages){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),DEEPSEEK_TIMEOUT_MS);
  try{
    const upstream=await fetch(DEEPSEEK_API_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.DEEPSEEK_API_KEY}`},body:JSON.stringify({model:MODEL,messages,thinking:{type:'disabled'},max_tokens:768,temperature:0.1,response_format:{type:'json_object'},stream:false}),signal:controller.signal});
    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok)throw new Error(data?.error?.message||`DeepSeek HTTP ${upstream.status}`);
    const content=data?.choices?.[0]?.message?.content||'';
    if(!content)throw new Error('DeepSeek 返回内容为空');
    try{return{data,parsed:JSON.parse(content)}}catch{throw new Error('DeepSeek 返回 JSON 无法解析');}
  }finally{clearTimeout(timer);}
}
export async function onRequestOptions({request}){return new Response(null,{status:204,headers:corsHeaders(request.headers.get('Origin')||'')});}
export async function onRequestPost({request,env}){
  const headers=corsHeaders(request.headers.get('Origin')||'');
  if(!env.DEEPSEEK_API_KEY)return new Response(JSON.stringify({error:'Cloudflare 未配置 DEEPSEEK_API_KEY'}),{status:500,headers});
  let body; try{body=await request.json()}catch{return new Response(JSON.stringify({error:'请求 JSON 无效'}),{status:400,headers});}
  const name=clean(body?.name), website=clean(body?.website), github=clean(body?.github), seoTitle=clean(body?.seoTitle), seoDescription=clean(body?.seoDescription), githubName=clean(body?.githubName), manualDescription=clean(body?.manualDescription), content=clean(body?.content).slice(0,24000), taxonomy=normalizeTaxonomy(body?.taxonomy);
  if(!name||!content)return new Response(JSON.stringify({error:'缺少真实资源名称或真实读取内容'}),{status:400,headers});
  if(!taxonomy.length)return new Response(JSON.stringify({error:'缺少合法分类词库，无法进行标准分类'}),{status:400,headers});
  if(manualDescription&&!isValidManual(manualDescription))return new Response(JSON.stringify({error:'人工简介必须为1-16个字符且不能换行'}),{status:400,headers});
  if(manualDescription){
    // 人工简介只需保留原文；分类仍由独立语义分析完成。
  }
  const taxonomyText=taxonomy.map(x=>`${x.category} / ${x.subcategory} = ${x.categoryName} / ${x.subcategoryName}`).join('\n');
  const semanticSystem=`你是“徐胖虎资源社”的资源语义分析器。当前任务不是写16字简介，而是先准确理解真实资源，并确定唯一标准分类。只输出JSON：{"core":"...","facts":["..."],"category":"...","subcategory":"..."}。\n严格规则：\n1. core用一句简短中文说明资源真正解决的问题和核心能力，不追求16字。\n2. facts只提取真实资料明确出现的核心功能，最多5条，禁止臆测。\n3. category和subcategory只能逐字复制合法词库key，禁止自造。\n4. 按资源主要用途分类，不按网址类型分类。\n5. 如果AI产品是核心用途产品，应归AI工具对应子类；普通软件按软件工具/效率工具等真实用途归类。\n合法分类词库：\n${taxonomyText}`;
  const sourceBlock=`资源名称：${name}\n官网：${website}\nGitHub：${github}\nGitHub项目名称：${githubName}\nSEO标题：${seoTitle}\nSEO描述：${seoDescription}\n真实网页/GitHub内容：\n${content}`;
  let semantic=null,lastError=null;
  try{
    const result=await callDeepSeek(env,[{role:'system',content:semanticSystem},{role:'user',content:`${sourceBlock}\n\n先完成语义理解与标准分类。不要生成16字简介。`}]);
    semantic=result.parsed;
  }catch(e){lastError=e;}
  if(!semantic)return new Response(JSON.stringify({error:lastError?.message||'DeepSeek 语义分析失败'}),{status:422,headers});
  const category=clean(semantic.category),subcategory=clean(semantic.subcategory);
  if(!classificationIsValid(category,subcategory,taxonomy))return new Response(JSON.stringify({error:'DeepSeek 返回的分类不在现有合法分类词库中'}),{status:422,headers});
  if(manualDescription)return new Response(JSON.stringify({description:manualDescription,category,subcategory,model:MODEL}),{status:200,headers});
  const facts=Array.isArray(semantic.facts)?semantic.facts.map(clean).filter(Boolean).slice(0,5):[];
  const core=clean(semantic.core);
  const exactSystem=`你是“徐胖虎资源社”的16字符核心简介生成器。你已经得到另一个模型完成的语义分析，但你仍必须以原始真实资料为准。你的唯一任务：从真实资料中提炼一个自然、准确、信息密度高的中文核心简介。\n严格要求：\n1. 必须返回JSON：{"candidates":["...","...","...","...","..."]}。\n2. 每个candidate都必须恰好16个字符。中文、英文字母、数字、标点各计1字符。\n3. 每个candidate都必须中文为主体，可自然包含少量AI、Git、API、RSS等英文字母；禁止整句全英文。\n4. 不允许复制资源名称作为简介，不允许把SEO标题整句照抄。\n5. 必须来自真实功能，不得添加资料中没有的功能。\n6. 禁止营销词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备。\n7. 禁止为了凑长度在末尾机械添加“工具、平台、软件、资源、应用、专业、强大、实用”等空泛词。\n8. 优先表达“核心对象 + 核心功能 + 用途/结果”。\n9. 先在内部生成多条，再逐字符计数；最终JSON里的每一条都必须已经是16字符。`;
  const exactBase=`原始资料：\n${sourceBlock}\n\n独立语义分析：\n核心：${core}\n事实：${facts.join('；')}\n标准分类：${category}/${subcategory}`;
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    const strategy=[
      '从资源最核心功能出发，优先表达“对象+核心功能+结果”，不要复制标题。',
      '完全重新理解真实资料，优先选择最具体、最有信息量的功能词，避免泛化。',
      '换一种自然中文句式重新表达核心功能；允许少量真实英文缩写，但不要为了凑长度添加空泛词。',
      '从用户实际使用结果出发重新提炼，不写营销词，不写产品定位口号。',
      '最后一次独立重写，只保留最准确、最自然、最像资源简介的16字符表达。'
    ][attempt-1];
    for(let candidateIndex=1;candidateIndex<=5;candidateIndex++){
      try{
        const candidatePrompt=`${exactBase}

这是第${attempt}轮、第${candidateIndex}个完全独立候选。${strategy}

请只生成一个候选，格式必须是：{"description":"..."}。
先在内部完成语义压缩与逐字符计数，最终description必须已经恰好16个字符；不要输出解释，不要输出字符数，不要输出第二个候选。`;
        const result=await callDeepSeek(env,[{role:'system',content:exactSystem.replace('必须返回JSON：{"candidates":["...","...","...","...","..."]}。','必须返回JSON：{"description":"..."}。')},{role:'user',content:candidatePrompt}]);
        const candidate=clean(result.parsed?.description);
        if(isValid16(candidate)){
          return new Response(JSON.stringify({description:candidate,category,subcategory,model:result.data?.model||MODEL,attempt,candidateIndex,candidateCount:1}),{status:200,headers});
        }
        lastError=new Error(`第${attempt}轮第${candidateIndex}个候选未通过16字符质量校验：${count(candidate)}字符`);
      }catch(e){lastError=e;}
    }
  }
  return new Response(JSON.stringify({error:`DeepSeek完成${MAX_ATTEMPTS}轮、${MAX_ATTEMPTS*5}个完全独立候选后仍未生成合格的16字符简介，请重试。${lastError?.message?`（${lastError.message}）`:''}`}),{status:422,headers});
}