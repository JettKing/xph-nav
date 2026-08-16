const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const DEEPSEEK_TIMEOUT_MS = 30000;
const MAX_ROUNDS = 5;
const CANDIDATES_PER_ROUND = 5;
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
async function callDeepSeek(env,messages,{maxTokens=256,temperature=0.15}={}){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),DEEPSEEK_TIMEOUT_MS);
  try{
    const upstream=await fetch(DEEPSEEK_API_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.DEEPSEEK_API_KEY}`},body:JSON.stringify({model:MODEL,messages,thinking:{type:'disabled'},max_tokens:maxTokens,temperature,response_format:{type:'json_object'},stream:false}),signal:controller.signal});
    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok)throw new Error(data?.error?.message||`DeepSeek HTTP ${upstream.status}`);
    const content=data?.choices?.[0]?.message?.content||'';
    if(!content)throw new Error('DeepSeek 返回内容为空');
    try{return{data,parsed:JSON.parse(content)}}catch{throw new Error('DeepSeek 返回 JSON 无法解析');}
  }catch(e){if(e?.name==='AbortError')throw new Error('DeepSeek 请求超时');throw e}
  finally{clearTimeout(timer);}
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
  const taxonomyText=taxonomy.map(x=>`${x.category} / ${x.subcategory} = ${x.categoryName} / ${x.subcategoryName}`).join('\n');
  const sourceBlock=`资源名称：${name}\n官网：${website}\nGitHub：${github}\nGitHub项目名称：${githubName}\nSEO标题：${seoTitle}\nSEO描述：${seoDescription}\n真实网页/GitHub内容：\n${content}`;
  const semanticSystem=`你是“徐胖虎资源社”的资源语义分析器。当前任务不是写16字简介，而是准确理解真实资源并确定唯一标准分类。只输出JSON：{"core":"...","facts":["..."],"category":"...","subcategory":"..."}。\n严格规则：\n1. core用一句简短中文说明资源真正解决的问题和核心能力，不追求16字。\n2. facts只提取真实资料明确出现的核心功能，最多5条，禁止臆测。\n3. category和subcategory只能逐字复制合法词库key，禁止自造。\n4. 按资源主要用途分类，不按网址类型分类。\n5. 如果资源核心用途属于AI，应选择对应AI子类；普通软件按真实用途归类。\n合法分类词库：\n${taxonomyText}`;
  let semantic=null,lastError=null;
  for(let i=0;i<2&&!semantic;i++){
    try{
      const result=await callDeepSeek(env,[{role:'system',content:semanticSystem},{role:'user',content:`${sourceBlock}\n\n这是语义分析第${i+1}次。只完成真实内容理解和标准分类，不生成16字简介。`}],{maxTokens:512,temperature:0.1});
      if(result?.parsed?.category&&result?.parsed?.subcategory&&classificationIsValid(clean(result.parsed.category),clean(result.parsed.subcategory),taxonomy)) semantic=result.parsed;
      else lastError=new Error('语义分析返回的分类不合法');
    }catch(e){lastError=e;}
  }
  if(!semantic)return new Response(JSON.stringify({error:lastError?.message||'DeepSeek 语义分析失败'}),{status:422,headers});
  const category=clean(semantic.category),subcategory=clean(semantic.subcategory),facts=Array.isArray(semantic.facts)?semantic.facts.map(clean).filter(Boolean).slice(0,5):[],core=clean(semantic.core);
  if(manualDescription)return new Response(JSON.stringify({description:manualDescription,category,subcategory,model:MODEL,round:0,candidateCount:0}),{status:200,headers});

  const compactFacts=facts.join('；');
  const exactBase=`真实资源名称：${name}\n官网：${website}\nGitHub：${github}\n核心理解：${core}\n真实事实：${compactFacts}\n标准分类：${category}/${subcategory}\n原始资料：${content}`;
  const strategies=[
    '从最核心的功能本身出发，使用最具体的信息词表达。',
    '从用户最直接得到的结果/用途出发，重新独立表达。',
    '从核心对象 + 核心动作出发，避免泛化描述。',
    '从真实使用场景出发，但必须保留最核心功能。',
    '完全重新理解资料，选择信息密度最高且最自然的一种表达。'
  ];
  const candidateSystem=`你是“徐胖虎资源社”的16字符核心简介生成器。每次请求只生成1条最终候选。\n严格要求：\n1. 只输出JSON：{"description":"..."}。\n2. description必须恰好16个字符；中文、英文字母、数字、标点各计1字符。\n3. 中文为主体，可以自然包含少量AI、Git、GitHub、API、RSS等英文。\n4. 禁止整句全英文。\n5. 必须来自真实资料，不得编造功能。\n6. 不复制资源名称，不照搬SEO标题。\n7. 禁止营销词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备。\n8. 禁止为了凑长度在末尾机械添加“工具、平台、软件、资源、应用、专业、强大、实用”等空泛词。\n9. 内部先写自然完整语义，再逐字符计数；不足或超出时重新改写，直到恰好16字符后才输出。\n10. 不要解释，不要输出第二条候选。`;

  for(let round=1;round<=MAX_ROUNDS;round++){
    const prompts=strategies.map((strategy,index)=>({role:'user',content:`${exactBase}\n\n这是第${round}轮中的第${index+1}个独立候选。${strategy}\n不要参考其他候选，也不要参考上一轮输出。重新理解原始资料后，只返回一条最终16字符简介。`}));
    const results=await Promise.allSettled(prompts.map(message=>callDeepSeek(env,[{role:'system',content:candidateSystem},message],{maxTokens:96,temperature:0.2})));
    const candidates=[];
    for(const result of results){
      if(result.status==='fulfilled'){
        const value=clean(result.value?.parsed?.description);
        if(value)candidates.push(value);
        if(isValid16(value)){
          return new Response(JSON.stringify({description:value,category,subcategory,model:result.value.data?.model||MODEL,round,candidateCount:candidates.length}),{status:200,headers});
        }
      }
    }
    lastError=new Error(`第${round}轮5个独立候选均未通过16字符质量校验`);
  }
  return new Response(JSON.stringify({error:`DeepSeek已完成${MAX_ROUNDS}轮独立生成，共${MAX_ROUNDS*CANDIDATES_PER_ROUND}个候选，仍未找到符合严格16字符标准的简介。${lastError?.message?`（${lastError.message}）`:''}`}),{status:422,headers});
}