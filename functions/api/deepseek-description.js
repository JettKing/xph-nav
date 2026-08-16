const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-pro';
const SEMANTIC_TIMEOUT_MS = 45000;
const CANDIDATE_TIMEOUT_MS = 45000;
const JUDGE_TIMEOUT_MS = 45000;
const ROUNDS = 5;
const CANDIDATES_PER_ROUND = 5;
const count = value => Array.from(String(value ?? '').trim()).length;
const clean = value => String(value ?? '').trim().replace(/[\r\n]+/g, ' ').replace(/^['"“”‘’]+|['"“”‘’]+$/g, '').trim();
const bannedQuality = /(专业|强大|超强|顶级|领先|完美|神器|极速|优质|爆款|必备)/;
const emptyPadding = /(工具|平台|软件|资源|应用|专业|强大|实用)$/;

function valid16(value){
  const v=clean(value);
  if(count(v)!==16 || !/[\u3400-\u9fff]/.test(v) || /^[A-Za-z0-9\s.,!?;:()\[\]{}+\-_/&%#]+$/.test(v)) return false;
  const cjk=count(v.replace(/[^\u3400-\u9fff]/g,''));
  if(cjk<6 || bannedQuality.test(v) || emptyPadding.test(v)) return false;
  return !/[\r\n]/.test(v);
}
const validManual = value => { const v=clean(value); return count(v)>=1 && count(v)<=16 && !/[\r\n]/.test(v); };
function corsHeaders(origin){
  const allowed=new Set(['https://xph.asia','https://www.xph.asia']);
  return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://xph.asia','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
}
function taxonomy(input){
  if(!Array.isArray(input)) return [];
  return input.map(x=>({category:clean(x?.category),categoryName:clean(x?.categoryName),subcategory:clean(x?.subcategory),subcategoryName:clean(x?.subcategoryName)}))
    .filter(x=>x.category&&x.categoryName&&x.subcategory&&x.subcategoryName);
}
function validClass(category,subcategory,tax){return tax.some(x=>x.category===category&&x.subcategory===subcategory);}
async function callDeepSeek(env,messages,{timeout=CANDIDATE_TIMEOUT_MS,temperature=0.4,maxTokens=512}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const upstream=await fetch(DEEPSEEK_API_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.DEEPSEEK_API_KEY}`},body:JSON.stringify({model:MODEL,messages,thinking:{type:'disabled'},max_tokens:maxTokens,temperature,response_format:{type:'json_object'},stream:false}),signal:controller.signal});
    const data=await upstream.json().catch(()=>({}));
    if(!upstream.ok) throw new Error(data?.error?.message||`DeepSeek HTTP ${upstream.status}`);
    const content=data?.choices?.[0]?.message?.content||'';
    if(!content) throw new Error('DeepSeek 返回内容为空');
    try{return {data,parsed:JSON.parse(content)}}catch{throw new Error('DeepSeek 返回 JSON 无法解析');}
  } finally { clearTimeout(timer); }
}
function buildSource(body){
  return `资源名称：${clean(body.name)}\n官网：${clean(body.website)}\nGitHub：${clean(body.github)}\nGitHub项目名称：${clean(body.githubName)}\nSEO标题：${clean(body.seoTitle)}\nSEO描述：${clean(body.seoDescription)}\n真实网页/GitHub内容：\n${clean(body.content).slice(0,24000)}`;
}
function uniqueCandidates(items){return [...new Map(items.map(x=>[x.description,x])).values()];}

export async function onRequestOptions({request}){return new Response(null,{status:204,headers:corsHeaders(request.headers.get('Origin')||'')});}
export async function onRequestPost({request,env}){
  const headers=corsHeaders(request.headers.get('Origin')||'');
  if(!env.DEEPSEEK_API_KEY) return new Response(JSON.stringify({error:'Cloudflare 未配置 DEEPSEEK_API_KEY'}),{status:500,headers});
  let body;
  try{body=await request.json();}catch{return new Response(JSON.stringify({error:'请求 JSON 无效'}),{status:400,headers});}

  const name=clean(body?.name), manual=clean(body?.manualDescription), content=clean(body?.content);
  const tax=taxonomy(body?.taxonomy);
  if(!name||!content) return new Response(JSON.stringify({error:'缺少真实资源名称或真实读取内容'}),{status:400,headers});
  if(!tax.length) return new Response(JSON.stringify({error:'缺少合法分类词库，无法进行标准分类'}),{status:400,headers});
  if(manual&&!validManual(manual)) return new Response(JSON.stringify({error:'人工简介必须为1-16个字符且不能换行'}),{status:400,headers});

  const sourceBlock=buildSource(body);
  const taxText=tax.map(x=>`${x.category}/${x.subcategory}=${x.categoryName}/${x.subcategoryName}`).join('\n');

  // 第一阶段：只做语义理解和分类。这里禁止生成简介，避免AI在理解阶段污染简介决策。
  const semanticSystem=`你是资源库的事实理解器。先判断资源第一核心用途，再确定标准分类。\n只输出JSON：{"core":"...","facts":["..."],"category":"...","subcategory":"...","secondary":[]}。\n规则：\n1. core只描述第一核心用途，不写营销词。\n2. facts只写原始资料明确支持的事实，最多5条。\n3. secondary列出最多5个次要功能，用于防止简介把次要功能塞进去。\n4. category/subcategory必须逐字复制合法词库key。\n5. 依据真实产品用途分类，不依据网址形式分类。\n合法分类：\n${taxText}`;
  let semantic;
  try{
    const r=await callDeepSeek(env,[{role:'system',content:semanticSystem},{role:'user',content:`${sourceBlock}\n\n只做事实理解与分类，不生成简介。`}],{timeout:SEMANTIC_TIMEOUT_MS,temperature:0.1,maxTokens:768});
    semantic=r.parsed;
  }catch(e){return new Response(JSON.stringify({error:e?.message||'DeepSeek 语义分析失败'}),{status:422,headers});}

  const category=clean(semantic?.category), subcategory=clean(semantic?.subcategory);
  if(!validClass(category,subcategory,tax)) return new Response(JSON.stringify({error:'DeepSeek 返回的分类不在现有合法分类词库中'}),{status:422,headers});
  if(manual) return new Response(JSON.stringify({description:manual,category,subcategory,model:MODEL}),{status:200,headers});

  const core=clean(semantic?.core);
  const facts=Array.isArray(semantic?.facts)?semantic.facts.map(clean).filter(Boolean).slice(0,5):[];
  const secondary=Array.isArray(semantic?.secondary)?semantic.secondary.map(clean).filter(Boolean).slice(0,5):[];
  const context=`原始资料：\n${sourceBlock}\n\n第一核心用途：${core}\n核心事实：${facts.join('；')}\n次要功能（除非它本身就是第一核心用途，否则禁止写入简介）：${secondary.join('；')}\n标准分类：${category}/${subcategory}`;

  const system=`你是资源卡片简介生成器。只生成一个16字符候选。\n硬规则：\n1. 必须恰好16字符，中文、英文字母、数字、标点各计1字符。\n2. 中文为主体；允许自然出现Git、AI、API、RSS、PR、CI等英文，但禁止整句全英文。\n3. 只表达第一核心用途，禁止功能清单。\n4. 不得为了凑16字加入次要功能。\n5. 不复制名称、SEO标题或原句。\n6. 禁止营销词：专业、强大、超强、顶级、领先、完美、神器、极速、优质、爆款、必备。\n7. 不要用“工具、平台、软件、资源、应用、专业、强大、实用”等空泛词机械凑长度。\n8. 只输出JSON：{"description":"..."}。`;
  const strategies=[
    '从第一核心用途直接压缩，优先核心对象和核心动作。',
    '从用户最主要的使用动作表达第一核心用途，不罗列能力。',
    '从产品定位出发重写，只保留定义该资源的最重要信息。',
    '换一种自然中文表达，但不能改变第一核心用途。',
    '按人工资源库审核标准重写，宁可舍弃次要信息，也不要凑字。'
  ];

  const candidates=[];
  let lastError='';
  // 5轮 × 5次：每个请求独立，5个请求并行；不因第一个16字候选出现就提前返回。
  for(let round=0;round<ROUNDS;round++){
    const jobs=Array.from({length:CANDIDATES_PER_ROUND},(_,i)=>{
      const prompt=`${context}\n\n第${round+1}轮第${i+1}个独立候选。策略：${strategies[round]}\n这是独立请求，不存在其它候选可供参考。先在内部逐字符计数，最终只输出一个恰好16字符的description。`;
      return callDeepSeek(env,[{role:'system',content:system},{role:'user',content:prompt}],{timeout:CANDIDATE_TIMEOUT_MS,temperature:0.65,maxTokens:128})
        .then(r=>({r,round:round+1,index:i+1})).catch(error=>({error,round:round+1,index:i+1}));
    });
    const results=await Promise.all(jobs);
    for(const item of results){
      if(item.error){lastError=item.error.message||String(item.error);continue;}
      const description=clean(item.r?.parsed?.description);
      if(valid16(description)) candidates.push({description,round:item.round,candidateIndex:item.index});
      else lastError=`第${item.round}轮第${item.index}个候选未通过16字符验收：${count(description)}字符`;
    }
  }

  const unique=uniqueCandidates(candidates);
  if(!unique.length) return new Response(JSON.stringify({error:`5轮×5个独立候选全部未通过16字符质量验收。${lastError?`（${lastError}）`:''}`}),{status:422,headers});

  // 第二阶段：只在已经通过程序硬验收的候选中做语义选择，禁止改写候选。
  const judgeSystem=`你是最终简介审核器。只能从候选中选择，绝对不能改写。\n优先级：\n1. 第一核心用途准确；\n2. 忠实真实资料；\n3. 自然易懂；\n4. 信息密度高但不罗列次要功能；\n5. 没有凑字痕迹。\n如果候选把PR、CI、AI或其它次要能力硬塞进去，应淘汰。\n只输出JSON：{"index":整数}。`;
  const judgeUser=`${context}\n\n通过程序硬验收的候选：\n${unique.map((x,i)=>`${i+1}. ${x.description}`).join('\n')}\n\n只选择最佳候选序号。`;
  try{
    const judged=await callDeepSeek(env,[{role:'system',content:judgeSystem},{role:'user',content:judgeUser}],{timeout:JUDGE_TIMEOUT_MS,temperature:0.1,maxTokens:64});
    const index=Number(judged.parsed?.index);
    if(Number.isInteger(index)&&index>=1&&index<=unique.length){
      const winner=unique[index-1];
      return new Response(JSON.stringify({description:winner.description,category,subcategory,model:judged.data?.model||MODEL,round:winner.round,candidateIndex:winner.candidateIndex,candidateCount:unique.length}),{status:200,headers});
    }
  }catch(e){lastError=e.message||String(e);}

  // 最终裁决服务失败时，不再启用旧的“关键词打分/补词”逻辑；只返回通过硬验收且最早出现的候选。
  const winner=unique[0];
  return new Response(JSON.stringify({description:winner.description,category,subcategory,model:MODEL,round:winner.round,candidateIndex:winner.candidateIndex,candidateCount:unique.length,judgeFallback:true}),{status:200,headers});
}