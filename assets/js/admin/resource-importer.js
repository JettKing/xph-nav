/**
 * 徐胖虎资源社 V5.3.10.5-FIX5-TEST 智能资源录入系统
 * - 只从 V5.2 标准词库中选择标签
 * - 本地规则推断，不调用第三方 AI API，不暴露密钥
 * - 支持网页元信息读取、智能分类、人工审核、JSON/JS 导出
 */
(function(){
  "use strict";

  const KEY = "xph_v52_resource_drafts";
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc = v => String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const uniq = arr => [...new Set((arr||[]).map(v=>String(v).trim()).filter(Boolean))];
  const text = v => String(v||"").trim();

  const CATEGORIES = window.categories || {};
  const TAGS = window.tags || {capabilities:[],scenarios:[],attributes:{pricing:[],platform:[],language:[],audience:[]}};
  const ALL = window.ResourceEngine?.getAllResources?.() || [];

  const state = {
    draft:null,
    meta:{},
    warnings:[],
    auto:{id:"",name:"",description:"",github:"",thumbnail:"",url:""},
    autoUrl:"",
    descriptionMode:"manual"
  };

  // 自动读取字段的“来源身份”。只有仍然等于自动读取结果的字段，
  // 在 URL 发生变化时才允许被清空；人工改过的字段必须保留。
  function resetAutoState(){
    state.auto={id:"",name:"",description:"",github:"",thumbnail:"",url:""};
    state.autoUrl="";
    state.descriptionMode="manual";
  }
  function markAutoField(key,value){
    state.auto[key]=text(value);
  }
  function isAutoFieldCurrent(key,fieldId){
    const autoValue=text(state.auto[key]);
    return !!autoValue && text($("#"+fieldId)?.value)===autoValue;
  }
  function invalidateForUrlChange(nextUrl){
    const fields=[["resourceId","id"],["resourceName","name"],["resourceDescription","description"],["resourceGithub","github"],["resourceThumbnail","thumbnail"],["resourceUrl","url"]];
    fields.forEach(([field,key])=>{
      const input=$("#"+field);
      if(input && isAutoFieldCurrent(key,field)) input.value="";
    });
    resetAutoState();
    state.autoUrl="";
    state.draft=null;
    $("#reviewPanel").hidden=true;
    $("#jsonPreview").textContent="等待智能分析生成。";
    $("#pageMeta").textContent="";
  }

  function prepareForReadUrl(nextUrl){
    const url=text(nextUrl);
    if(!url)return;
    // 每次点击“读取网页信息/智能分析并生成”都重新建立一次读取会话。
    // 自动字段若仍等于上一次自动结果则清空；人工改过的字段保留。
    const fields=[
      ["resourceId","id"],["resourceName","name"],["resourceDescription","description"],
      ["resourceGithub","github"],["resourceThumbnail","thumbnail"]
    ];
    fields.forEach(([field,key])=>{
      const input=$("#"+field);
      if(input && isAutoFieldCurrent(key,field))input.value="";
    });
    state.auto={id:"",name:"",description:"",github:"",thumbnail:"",url:""};
    state.autoUrl="";
    state.descriptionMode="manual";
    state.draft=null;
    $("#reviewPanel").hidden=true;
    $("#jsonPreview").textContent="等待智能分析生成。";
    $("#pageMeta").textContent="";
  }

  const stopWords = new Set("the a an and or of to in on for with from by is are ai tool app platform official online free pro com www https http www io co".split(/\s+/));
  const norm = s => text(s).toLowerCase().replace(/[\s_\-./:：，。！!？?（）()【】\[\],，]/g," ");
  const tokens = s => uniq(norm(s).split(/\s+/).filter(x=>x && x.length>1 && !stopWords.has(x)));

  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function makeId(name,url){
    const base=text(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"resource";
    const canonical=text(url).toLowerCase().replace(/#.*$/,"").replace(/\/+$/,"");
    return `${base}-${hash(canonical||name).slice(0,6)}`;
  }
  function canonicalUrl(value){
    try{
      const u=new URL(text(value));
      const host=u.hostname.toLowerCase().replace(/^www\./,"");
      const path=(u.pathname||"/").replace(/\/+$/g,"")||"/";
      return `${host}${path}`;
    }catch(e){return text(value).toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/#.*$/g,"").replace(/\/+$/g,"");}
  }
  function sameFetchedResource(requested,fetched){
    const a=canonicalUrl(requested),b=canonicalUrl(fetched);
    return !!a && !!b && a===b;
  }
  function categoryList(){
    return Object.entries(CATEGORIES).flatMap(([key,g])=>Object.entries(g.children||{}).map(([child,label])=>({parent:key,parentName:g.name,child,label})));
  }
  function vocab(kind){return kind==="capabilities"?TAGS.capabilities:kind==="scenarios"?TAGS.scenarios:TAGS.attributes?.[kind]||[];}

  const rules = {
    category:[
      {k:["chatgpt","claude","gemini","gpt","llm","对话","聊天","assistant","copilot"],cat:"ai",sub:"ai_chat"},
      {k:["写作","writing","writer","文章","文案","copywriting"],cat:"ai",sub:"ai_write"},
      {k:["midjourney","stable diffusion","flux","dalle","image","图片生成","绘图","绘画"],cat:"ai",sub:"ai_image"},
      {k:["video","视频","runway","kling","sora","剪辑"],cat:"ai",sub:"ai_video"},
      {k:["audio","音乐","music","sound","语音","voice","elevenlabs"],cat:"ai",sub:"ai_audio"},
      {k:["code","coding","github copilot","cursor","编程","开发","ide"],cat:"ai",sub:"ai_code"},
      {k:["search","搜索","perplexity","research","检索"],cat:"ai",sub:"ai_search"},
      {k:["translate","翻译","translation"],cat:"ai",sub:"ai_translate"},
      {k:["agent","智能体","autonomous"],cat:"ai",sub:"ai_agent"},
      {k:["model","模型","hugging face","ollama"],cat:"ai",sub:"ai_model"},
      {k:["office","word","excel","powerpoint","ppt","办公"],cat:"ai",sub:"ai_office"},
      {k:["gitdesktop","git desktop","git client","desktop app","desktop application","安装包","installer","download app","version control"],cat:"software",sub:"software_dev"},
      {k:["telegram","tg","频道","群组","机器人"],cat:"solution",sub:"solution_telegram"},
      {k:["course","课程","教程","学习"],cat:"digital",sub:"digital_course"},
      {k:["ebook","电子书","book","书籍"],cat:"digital",sub:"digital_book"},
      {k:["template","模板","素材"],cat:"digital",sub:"digital_template"},
      {k:["plugin","extension","插件","扩展"],cat:"digital",sub:"digital_plugin"},
      {k:["dataset","数据集"],cat:"digital",sub:"digital_dataset"},
      {k:["browser","浏览器"],cat:"software",sub:"software_browser"},
      {k:["pdf","PDF"],cat:"software",sub:"software_pdf"},
      {k:["remote","远程控制"],cat:"software",sub:"software_remote"},
      {k:["screenshot","录屏","截图"],cat:"software",sub:"software_screen"},
      {k:["automation","自动化","zapier","make.com","workflow","工作流"],cat:"productivity",sub:"productivity_automation"},
      {k:["notion","note","笔记"],cat:"productivity",sub:"productivity_note"},
      {k:["todo","task","任务"],cat:"productivity",sub:"productivity_task"},
      {k:["calendar","日历","schedule","日程"],cat:"productivity",sub:"productivity_calendar"},
      {k:["email","邮件"],cat:"productivity",sub:"productivity_email"},
      {k:["mindmap","思维导图"],cat:"productivity",sub:"productivity_mindmap"},
      {k:["api","developer platform","API平台"],cat:"website",sub:"website_api"},
      {k:["search engine","搜索引擎"],cat:"website",sub:"website_search"},
      {k:["design website","设计网站"],cat:"website",sub:"website_design"}
    ],
    capabilities:{
      "文本生成":["写作","writer","writing","text","文本","文案","文章","chat","对话"],
      "文本总结":["总结","summary","summarize","长文本","摘要"],
      "翻译":["translate","translation","翻译"],
      "联网搜索":["search","搜索","perplexity","research","检索","browse"],
      "知识问答":["问答","qa","question","answer","chat"],
      "图片生成":["image","图片生成","绘图","绘画","midjourney","stable diffusion","flux","dall e"],
      "图片编辑":["image edit","图片编辑","修图","inpaint"],
      "视频生成":["video generation","视频生成","runway","kling","sora","text to video"],
      "视频编辑":["video edit","视频编辑","剪辑","editor"],
      "音频生成":["audio","music","音乐生成","音频生成"],
      "语音合成":["tts","text to speech","语音合成","elevenlabs"],
      "语音识别":["speech to text","stt","语音识别","transcription"],
      "代码生成":["code","coding","编程","开发","copilot","cursor","代码生成"],
      "代码补全":["autocomplete","代码补全","copilot","cursor"],
      "代码调试":["debug","调试","debugging"],
      "API调用":["api","API","sdk","developer platform"],
      "数据分析":["data analysis","数据分析","analytics","csv","excel"],
      "数据可视化":["visualization","可视化","dashboard","chart"],
      "OCR":["ocr","文字识别","扫描识别"],
      "文档处理":["document","文档","pdf","docx"],
      "PPT生成":["ppt","powerpoint","presentation","演示文稿"],
      "自动化":["automation","自动化","zapier","make.com","workflow","工作流"],
      "工作流":["workflow","工作流","pipeline"],
      "智能体":["agent","智能体","autonomous"],
      "任务管理":["task","任务管理","todo"],
      "项目管理":["project management","项目管理","jira","asana"],
      "知识管理":["knowledge management","知识库","knowledge base","notion"],
      "文件管理":["file management","文件管理","drive"],
      "搜索":["search","搜索","find"],
      "教育学习":["education","learning","学习","课程","tutorial"],
      "研究辅助":["research","研究","论文","academic"],
      "营销策划":["marketing","营销","campaign"],
      "广告创作":["ad","广告","advertising"],
      "SEO优化":["seo","搜索引擎优化"],
      "社交媒体运营":["social media","社交媒体","instagram","tiktok","telegram"],
      "模型部署":["deployment","部署","inference"],
      "模型训练":["training","训练","train model"],
      "本地部署":["local","本地部署","ollama","self hosted","self-hosted"],
      "开源协作":["github","gitlab","open source","开源"]
    },
    scenarios:{
      "办公":["office","办公","word","excel","powerpoint","document"],
      "内容创作":["writing","写作","文案","文章","content","内容创作"],
      "自媒体":["creator","自媒体","blog","youtube","tiktok","social media"],
      "短视频":["short video","短视频","tiktok","reels","video"],
      "设计":["design","设计","image","绘图","logo"],
      "UI/UX":["ui","ux","界面设计","prototype","figma"],
      "营销":["marketing","营销","广告","campaign"],
      "编程开发":["code","coding","编程","developer","开发"],
      "网站开发":["website","web development","网站开发","frontend"],
      "学习":["learning","学习","课程","tutorial","student"],
      "研究":["research","研究","academic","论文"],
      "个人效率":["productivity","效率","task","todo","calendar","note"],
      "自动化":["automation","自动化","zapier","workflow"],
      "企业管理":["enterprise","企业","business","team"],
      "产品开发":["product","产品开发","prototype"],
      "创业":["startup","创业","founder"],
      "科技资讯":["news","资讯","technology"],
      "工具选型":["compare","comparison","工具选型"],
      "Telegram运营":["telegram","tg","频道","bot"],
      "社群运营":["community","社群","discord","telegram"],
      "出海":["global","overseas","出海","international"]
    }
  };

  function scoreRule(hay, keys){return keys.reduce((n,k)=>n+(hay.includes(norm(k))?1:0),0);}
  function inferCategory(hay){
    // 分类必须“宁可保守，也不要把普通网站误判成 AI”。
    // AI 只有出现明确 AI/模型/具体产品信号时才允许进入 AI 类；
    // 普通网站若只有 search/code/design 等通用词，默认保留在网页导航。
    const strongAi=/(?:\b(?:chatgpt|claude|gemini|gpt-\d*|midjourney|stable\s*diffusion|dall[· -]?e|runway|kling|sora|copilot|cursor|hugging\s*face|ollama)\b|\b(?:llm|ai\s+assistant|ai\s+agent|artificial\s+intelligence)\b|人工智能|生成式人工智能|大语言模型|智能体)/i.test(hay);
    const aiCandidates=rules.category.filter(r=>r.cat==="ai");
    const nonAiCandidates=rules.category.filter(r=>r.cat!=="ai");
    let best={score:0,cat:"website",sub:"website_tool"};
    const candidates=strongAi?rules.category:nonAiCandidates;
    candidates.forEach(r=>{
      const s=scoreRule(hay,r.k);
      if(s>best.score)best={score:s,cat:r.cat,sub:r.sub};
    });
    // 无明确高置信信号时，永远不要仅凭“search/code/api/design”等通用词跳到 AI。
    if(!strongAi && best.score<2)return {score:best.score,cat:"website",sub:"website_tool"};
    if(strongAi){
      let aiBest={score:0,cat:"ai",sub:"ai_chat"};
      aiCandidates.forEach(r=>{const s=scoreRule(hay,r.k);if(s>aiBest.score)aiBest={score:s,cat:r.cat,sub:r.sub};});
      if(aiBest.score>0 && (best.cat!=="website" || aiBest.score>=2))return aiBest;
    }
    return best;
  }
  function inferMulti(hay,map,limit=8){
    return Object.entries(map).map(([label,keys])=>({label,score:scoreRule(hay,keys)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label,"zh-CN")).slice(0,limit).map(x=>x.label);
  }
  function canonical(list,allowed){const set=new Set(allowed.map(x=>String(x).toLowerCase()));return uniq(list).filter(x=>set.has(String(x).toLowerCase())).map(x=>allowed.find(a=>String(a).toLowerCase()===String(x).toLowerCase())||x);}

  function inferAttributes(hay,url){
    const platform=[];
    if(/ios|iphone|ipad|app store/.test(hay))platform.push("iOS");
    if(/android|google play/.test(hay))platform.push("Android");
    if(/windows/.test(hay))platform.push("Windows");
    if(/macos|mac os|mac app/.test(hay))platform.push("macOS");
    if(/linux/.test(hay))platform.push("Linux");
    if(/discord/.test(hay))platform.push("Discord");
    if(!platform.length || /https?:\/\//.test(url))platform.push("Web");

    const language=[];
    if(/中文|chinese|zh-cn|zh_cn|mandarin/.test(hay))language.push("中文");
    if(/英文|english|en-us|en_us/.test(hay))language.push("英文");
    if(!language.length)language.push("多语言");

    let pricing="增值";
    if(/完全免费|永久免费|100% free|free forever|open source|开源免费/.test(hay))pricing="免费";
    else if(/pricing|pro plan|subscription|付费|premium|paid/.test(hay) && !/free/.test(hay))pricing="付费";

    const audience=[];
    if(/developer|programmer|程序员|开发者|coding|api/.test(hay))audience.push("开发者");
    if(/designer|design|设计师/.test(hay))audience.push("设计师");
    if(/student|学生|education|学习/.test(hay))audience.push("学生");
    if(/creator|创作者|自媒体|content creator/.test(hay))audience.push("创作者");
    if(/marketing|运营|social media|telegram/.test(hay))audience.push("运营");
    if(/enterprise|企业|business|team/.test(hay))audience.push("企业");
    if(!audience.length)audience.push("所有用户");

    return {platform:canonical(platform,TAGS.attributes.platform),pricing:canonical([pricing],TAGS.attributes.pricing)[0]||"增值",language:canonical(language,TAGS.attributes.language),audience:canonical(audience,TAGS.attributes.audience)};
  }

  function currentHay(extra={}){return norm([extra.name,extra.url,extra.description,extra.content,extra.title,extra.keywords].filter(Boolean).join(" "));}

  function charCount(value){return Array.from(text(value)).length;}
  function limit32(value){return Array.from(text(value)).slice(0,32).join("");}

  // Description Reader Architecture Reset:
  // 自动简介只允许来自“当前 URL 明确声明的结构化描述”，禁止从整页正文、关键词或站点模板猜测。
  const DESCRIPTION_NOISE=/^(home|homepage|welcome|about|contact|privacy|terms|login|sign\s*(?:in|up)|learn\s+more|read\s+more|get\s+started|start\s+now|official\s+website|menu|navigation|features?|pricing|faq|frequently\s+asked\s+questions?|why\s+choose|how\s+it\s+works?)$/i;
  const DESCRIPTION_BAD_PATTERNS=/(privacy policy|terms of (?:use|service)|cookie policy|all rights reserved|免责声明|隐私政策|服务条款|用户协议|常见问题|faq|主观偏差|联系我们|登录|注册|导航|价格方案|立即开始|为什么选择|工作原理)/i;

  function normalizeSourceText(value){
    return text(value).replace(/https?:\/\/\S+/gi," ").replace(/\[[^\]]*\]\([^)]*\)/g," ")
      .replace(/[`*_>#|{}]/g," ").replace(/[\r\n]+/g,"。 ").replace(/\s+/g," ").trim();
  }
  function cleanDescriptionCandidate(value){
    return text(value).replace(/\s+/g,"").replace(/[。！？!?.,，、；：:;“”‘’"'()（）\[\]{}<>《》\-–—]/g,"");
  }
  function validDescriptionSource(value,source=""){
    const raw=normalizeSourceText(value);
    if(!raw||DESCRIPTION_NOISE.test(raw)||DESCRIPTION_BAD_PATTERNS.test(raw))return false;
    if(/^https?:\/\//i.test(raw)||raw.length<6)return false;
    // 仅允许明确的结构化来源进入自动简介：正文段落不再是候选源。
    const allowed=/^(meta-description|og-description|twitter-description|meta-item-description|jsonld-description|jsonld-offer-description|frontmatter-description|markdown-description|github-readme|github-api-description|secondary-description)$/i;
    if(source&&!allowed.test(source))return false;
    return true;
  }

  function sourceCandidates(input){
    const candidates=[];
    const add=(value,source,priority)=>{
      const raw=normalizeSourceText(value);
      if(!validDescriptionSource(raw,source))return;
      const key=cleanDescriptionCandidate(raw).toLowerCase();
      if(!key||candidates.some(x=>cleanDescriptionCandidate(x.value).toLowerCase()===key))return;
      candidates.push({value:raw,source,priority});
    };
    (input.descriptionCandidates||[]).forEach(x=>add(x?.value||x,x?.source||"unknown",Number(x?.priority||90)));
    // 仅兼容已明确标记为 meta-description 的旧状态，禁止普通 description 偷渡。
    if(input.description)add(input.description,"meta-description",10);
    return candidates.sort((a,b)=>a.priority-b.priority);
  }

  function toChineseCore16(value){
    const raw=cleanDescriptionCandidate(value);
    if(!raw)return "";
    // 来源本身已经是16字符时直接保留，避免为了“中文化”破坏 AI / Git / SVG 等产品术语。
    if(charCount(raw)===16&&/[\u4e00-\u9fff]/.test(raw))return raw;
    let s=raw;
    // 只做语言清洗，不做 URL/网站/关键词模板推断。
    s=s.replace(/^(欢迎来到|欢迎使用|这是|这里是|我们提供|我们为你|专为|一款|一个|一种|基于|致力于|帮助用户|为用户|让你|让您)/,"" );
    s=s.replace(/(最佳|免费|在线|官方|全新|现代|简单|轻松|立即|开始使用|了解更多)$/g,"");
    if(charCount(s)!==16){
      // 优先选择原始描述中的自然语义句，而不是从正文随机取句或机械填充。
      const parts=String(value).split(/[。！？!?；;]/).map(x=>cleanDescriptionCandidate(x)).filter(x=>charCount(x)>=16&&charCount(x)<=32&&/[\u4e00-\u9fff]/.test(x));
      const natural=parts.find(x=>charCount(x)===16)||parts[0];
      if(natural)s=natural;
    }
    s=cleanDescriptionCandidate(s);
    if(charCount(s)===16&&/[\u4e00-\u9fff]/.test(s))return s;
    // 若来源明确为中文描述但超过16字，只保留前16字；不追加虚构词。
    if(/^[\u4e00-\u9fffA-Za-z0-9]+$/.test(s)&&charCount(s)>16&&/[\u4e00-\u9fff]/.test(s))return Array.from(s).slice(0,16).join("");
    return "";
  }

  async function translateToChinese(value){
    const raw=text(value);
    if(!raw||/^[\u4e00-\u9fff\s0-9A-Za-z]+$/.test(raw)&&/[\u4e00-\u9fff]/.test(raw))return raw;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),5000);
    try{
      const q=encodeURIComponent(raw.slice(0,900));
      const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`,{mode:"cors",cache:"no-store",signal:controller.signal,headers:{"X-XPH-Reader":"1"}});
      if(!r.ok)return "";
      const data=await r.json();
      const out=Array.isArray(data?.[0])?data[0].map(x=>Array.isArray(x)?x[0]:"").join(""):"";
      return text(out);
    }catch(e){return "";}finally{clearTimeout(timer);}
  }

  async function exact16FromSourceAsync(input){
    const candidates=sourceCandidates(input);
    for(const c of candidates){
      let value=toChineseCore16(c.value);
      if(value&&charCount(value)===16)return value;
      const translated=await translateToChinese(c.value);
      if(translated){
        value=toChineseCore16(translated);
        if(value&&charCount(value)===16)return value;
        const pieces=String(translated).split(/[。！？!?；;]/).map(x=>cleanDescriptionCandidate(x)).filter(x=>charCount(x)>=16&&/[\u4e00-\u9fff]/.test(x));
        const exact=pieces.find(x=>charCount(x)===16);
        if(exact)return exact;
        if(pieces[0]&&charCount(pieces[0])>16)return Array.from(pieces[0]).slice(0,16).join("");
      }
    }
    return "";
  }

  function exact16FromSource(input){
    const candidates=sourceCandidates(input);
    for(const c of candidates){
      const value=toChineseCore16(c.value);
      if(value&&charCount(value)===16)return value;
    }
    // 没有可靠结构化来源时保持空白，交给人工审核；禁止猜测。
    return "";
  }
  function autoDescription16(input){return exact16FromSource(input);}
  function chineseDescription(input){return autoDescription16(input);}
  function isLikelyGenericTitle(value){
    const s=text(value).toLowerCase();
    return !s||s.length>30||/^(your next|welcome|home|homepage|untitled|coming soon|the future|we are|we're|won.?t be|will be|github|gitlab|bitbucket|cloudflare|wordpress)$/i.test(s);
  }
  function nameFromTitle(title,url){
    const t=text(title).replace(/\s+/g," ").trim(); if(!t)return "";
    const first=t.split(/\s*[|｜—–-]\s*/)[0].trim();
    const ghRepo=t.match(/github\.com\s*[-:]?\s*[^\/\s]+\/([^\s:|]+)/i)?.[1]?.replace(/[).,]+$/g,"");
    if(ghRepo&&ghRepo.length<=28&&!isLikelyGenericTitle(ghRepo))return ghRepo;
    if(first&&!isLikelyGenericTitle(first)&&first.length<=28)return first;
    if(!isLikelyGenericTitle(t)&&t.length<=24)return t;
    try{const host=new URL(url).hostname.replace(/^www\./i,"");const brand=host.split(".")[0].replace(/[-_]+/g," ").trim();return brand?brand.charAt(0).toUpperCase()+brand.slice(1):"";}catch(e){return "";}
  }
  function decodeHtmlEntities(value){
    return text(value).replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x2F;/gi,"/").replace(/&#47;/gi,"/");
  }
  function normalizeGithubUrl(value){
    const decoded=decodeHtmlEntities(value).replace(/\\\//g,"/");
    const m=decoded.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
    if(!m)return ""; return `https://github.com/${m[1]}/${m[2].replace(/\.git$/i,"")}`;
  }
  function extractGithub(raw){
    const decoded=decodeHtmlEntities(raw).replace(/\\\//g,"/");
    const direct=normalizeGithubUrl(decoded); if(direct)return direct;
    const href=decoded.match(/(?:href|url|repository|source)\s*[:=]\s*["']([^"']*github\.com\/[^"']+)["']/i)?.[1]||"";
    return normalizeGithubUrl(href);
  }
  function extractStructuredName(doc){
    try{const scripts=[...doc.querySelectorAll('script[type="application/ld+json"]')];
      for(const s of scripts){const data=JSON.parse(s.textContent||"");const list=Array.isArray(data)?data:(Array.isArray(data?.["@graph"])?data["@graph"]:[data]);
        for(const item of list){const type=String(item?.["@type"]||"").toLowerCase();if(/website|organization|softwareapplication|product|brand/.test(type)&&text(item?.name))return text(item.name);}}
    }catch(e){} return "";
  }

  function defaultIcon(category){
    const map={ai:"🤖",software:"💻",productivity:"⚡",website:"🌐",digital:"📚",solution:"💎"};
    return map[text(category)]||"🌐";
  }

  function analyze(input){
    const hay=currentHay(input);
    const c=inferCategory(hay);
    const group=CATEGORIES[c.cat]||{};
    const sub=group.children?.[c.sub]?c.sub:Object.keys(group.children||{})[0]||"";
    const caps=canonical(inferMulti(hay,rules.capabilities,8),TAGS.capabilities);
    const scs=canonical(inferMulti(hay,rules.scenarios,6),TAGS.scenarios);
    const attrs=inferAttributes(hay,input.url||"");
    if(!caps.length)caps.push("文本生成");
    if(!scs.length)scs.push("个人效率");
    const id=makeId(input.name,input.url);
    const existing=ALL.find(x=>String(x.id)===id||String(x.website||"").replace(/\/$/,"")===String(input.url||"").replace(/\/$/,""));
    const warnings=[];
    if(!text(input.name))warnings.push("缺少资源名称");
    if(!/^https?:\/\//i.test(text(input.url)))warnings.push("URL 必须以 http:// 或 https:// 开头");
    if(existing)warnings.push(`可能重复：已存在「${existing.name}」`);
    if(c.score<1)warnings.push("分类置信度较低，请人工确认分类/子分类");
    if(attrs.pricing==="增值")warnings.push("价格为规则推断值，发布前建议人工确认");
    return {
      id,name:text(input.name),description:text(input.description)||exact16FromSource(input),
      icon:defaultIcon(c.cat),thumbnail:text(input.thumbnail),category:c.cat,subcategory:sub,website:text(input.url),github:text(input.github||input.githubUrl),
      features:[],capabilities:caps,scenarios:scs,attributes:attrs,official:false,recommend:false,status:"active",
      _meta:{categoryScore:c.score,warnings}
    };
  }

  function extractDescriptionCandidatesFromDoc(doc){
    const out=[]; const seen=new Set();
    const add=(value,source,priority)=>{
      const raw=normalizeSourceText(value); const key=cleanDescriptionCandidate(raw).toLowerCase();
      if(!validDescriptionSource(raw)||!key||seen.has(key))return;
      seen.add(key); out.push({value:raw,source,priority});
    };
    const getMeta=(selector,source,priority)=>{
      const node=doc.querySelector(selector); if(node)add(node.getAttribute("content")||node.textContent,source,priority);
    };
    getMeta('meta[name="description"]','meta-description',10);
    getMeta('meta[property="og:description"]','og-description',20);
    getMeta('meta[name="twitter:description"]','twitter-description',25);
    getMeta('meta[itemprop="description"]','meta-item-description',25);

    try{
      const data=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent||"")).flatMap(x=>Array.isArray(x)?x:(Array.isArray(x?.["@graph"])?x["@graph"]:[x]));
      for(const item of data){
        add(item?.description,"jsonld-description",30);
        if(item?.offers?.description)add(item.offers.description,"jsonld-offer-description",32);
      }
    }catch(e){}

    // 不再读取 .description / .subtitle / .intro / 首屏正文等通用节点。
    // 页面结构化描述之外的内容一律不能直接成为自动简介候选。
    return out.sort((a,b)=>a.priority-b.priority);
  }

  async function fetchTextSource(url){
    const clean=text(url);
    if(!/^https?:\/\//i.test(clean))throw new Error("请输入有效网址");
    const cacheBust=`xph_reader=${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const directUrl=clean+(clean.includes("?")?"&":"?")+cacheBust;
    try{
      const r=await fetch(directUrl,{mode:"cors",redirect:"follow",cache:"no-store",headers:{"Cache-Control":"no-cache","Pragma":"no-cache","X-XPH-Reader":"1"}});
      if(!r.ok)throw new Error("HTTP "+r.status);
      return {raw:await r.text(),source:"direct",fetchedUrl:r.url||clean};
    }catch(e){
      const proxy="https://r.jina.ai/"+clean;
      const r=await fetch(proxy,{cache:"no-store",headers:{Accept:"text/plain","x-no-cache":"true","x-cache-tolerance":"0","DNT":"1","X-XPH-Reader":"1"}});
      if(!r.ok)throw new Error("网页读取失败："+r.status);
      return {raw:await r.text(),source:"jina",fetchedUrl:clean};
    }
  }

  async function fetchGithubApi(github){
    const normalized=normalizeGithubUrl(github); if(!normalized)return null;
    const m=normalized.match(/github\.com\/([^/]+)\/([^/]+)/i); if(!m)return null;
    try{
      const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`,{
        cache:"no-store",headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","X-XPH-Reader":"1"}
      });
      if(!r.ok)return null;
      const data=await r.json();
      return {
        url:normalized,
        name:text(data.name),
        fullName:text(data.full_name),
        description:text(data.description),
        homepage:text(data.homepage),
        htmlUrl:text(data.html_url)||normalized,
        defaultBranch:text(data.default_branch),
        topics:Array.isArray(data.topics)?data.topics:[]
      };
    }catch(e){return null;}
  }

  function parseHtmlDocument(raw,url){
    const doc=new DOMParser().parseFromString(raw,"text/html");
    const get=(sel,attr)=>{const n=doc.querySelector(sel);return n?(attr?n.getAttribute(attr):n.textContent):""};
    const title=text(get("title"));
    const description=text(get('meta[name="description"]',"content")||get('meta[property="og:description"]',"content"));
    const descriptionCandidates=extractDescriptionCandidatesFromDoc(doc);
    const keywords=text(get('meta[name="keywords"]',"content"));
    const ogTitle=text(get('meta[property="og:title"]',"content"));
    const thumbnail=text(get('meta[property="og:image"]',"content")||get('meta[name="twitter:image"]',"content")||get('meta[name="twitter:image:src"]',"content"));
    const siteName=text(get('meta[property="og:site_name"]',"content")||get('meta[name="application-name"]',"content"));
    const canonical=text(get('link[rel="canonical"]',"href")||get('meta[property="og:url"]',"content"));
    const structuredName=extractStructuredName(doc);
    let github="";
    const websiteCandidates=[];
    try{
      const data=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent||"")).flatMap(x=>Array.isArray(x)?x:(Array.isArray(x?.["@graph"])?x["@graph"]:[x]));
      for(const item of data){
        const desc=text(item?.description); if(desc)descriptionCandidates.push({value:desc,source:"jsonld-description",priority:30});
        const same=Array.isArray(item?.sameAs)?item.sameAs:[item?.sameAs];
        const repos=[item?.codeRepository,item?.repository,...same].flatMap(v=>typeof v==="object"?[v?.url]:[v]);
        github=github||repos.map(normalizeGithubUrl).find(Boolean)||"";
      }
    }catch(e){}
    const links=[...doc.querySelectorAll('a[href]')].map(a=>({href:a.href||a.getAttribute('href')||"",text:text(a.textContent)}));
    github=github||links.map(x=>normalizeGithubUrl(x.href)).find(Boolean)||"";
    links.forEach(x=>{if(/^https?:\/\//i.test(x.href))websiteCandidates.push(x.href);});
    const body=text(doc.body?.innerText||"").slice(0,18000);
    const resourceName=nameFromTitle(structuredName||ogTitle||title,url)||siteName;
    return {doc,title,resourceName,description,descriptionCandidates,keywords,thumbnail,siteName,structuredName,canonical,github,websiteCandidates,body,sourceUrl:url};
  }

  function parseMarkdownSource(raw,url){
    const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const fmTitle=raw.match(/^---\s*\n(?:.*\n)*?title:\s*["']?(.+?)["']?\s*\n(?:.*\n)*?---/im)?.[1]||"";
    const fmDescription=raw.match(/^---\s*\n(?:.*\n)*?description:\s*["']?(.+?)["']?\s*\n(?:.*\n)*?---/im)?.[1]||"";
    const fmUrl=raw.match(/^---\s*\n(?:.*\n)*?url:\s*["']?(.+?)["']?\s*\n(?:.*\n)*?---/im)?.[1]||"";
    const heading=lines.find(x=>/^#{1,6}\s+/.test(x));
    const title=text(fmTitle||(heading||"").replace(/^#{1,6}\s+/i,""));
    const descriptionCandidates=[];
    if(fmDescription)descriptionCandidates.push({value:fmDescription,source:"frontmatter-description",priority:10});
    const metaMatch=raw.match(/(?:description|meta description)\s*[:：]\s*(.+)/i);
    if(metaMatch?.[1])descriptionCandidates.push({value:metaMatch[1],source:"markdown-description",priority:15});
    const blocks=[];
    for(const line of lines){
      if(/^---$/.test(line)||/^#{1,6}\s+/.test(line)||/^[-*]\s+/.test(line)||/^https?:\/\//i.test(line))continue;
      if(/^(title|description|url|source|homepage|website):\s*/i.test(line))continue;
      const cleaned=line.replace(/[`*_>#\[\]]/g," ").replace(/\s+/g," ").trim();
      if(cleaned.length>=12)blocks.push(cleaned);
    }
    const websiteCandidates=[];
    const urlRe=/https?:\/\/[^\s)\]>"']+/gi;
    for(const m of raw.matchAll(urlRe))websiteCandidates.push(m[0].replace(/[),.;]+$/g,""));
    const github=extractGithub(raw);
    const thumbnail=text(raw.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i)?.[1]||"");
    return {title,resourceName:nameFromTitle(title,url),description:text(fmDescription||metaMatch?.[1]||""),descriptionCandidates,keywords:text(raw.match(/(?:keywords?)\s*[:：]\s*(.+)/i)?.[1]||""),thumbnail,siteName:"",structuredName:"",canonical:fmUrl,github,websiteCandidates,body:blocks.join(" ").slice(0,18000),sourceUrl:url};
  }

  function isGithubUrl(url){return /(?:^|\.)github\.com\//i.test(text(url));}
  function isLikelyOfficialWebsite(url){
    try{
      const u=new URL(url); if(!/^https?:$/i.test(u.protocol))return false;
      const h=u.hostname.toLowerCase().replace(/^www\./,"");
      if(!h||h==="github.com"||isGithubUrl(h)||/^(raw\.|gist\.|api\.|objects\.)github\.com$/i.test(h))return false;
      if(/(?:facebook|instagram|twitter|x\.com|linkedin|youtube|discord|tiktok|reddit|telegram)\.com$/i.test(h))return false;
      if(/(?:shields\.io|img\.shields\.io|badge|cdn|cloudflareinsights)/i.test(h+u.pathname))return false;
      if(/\.(?:png|jpe?g|gif|svg|webp|ico|css|js|json|xml|txt)(?:$|\?)/i.test(u.pathname))return false;
      return true;
    }catch(e){return false;}
  }
  function chooseOfficialWebsite(candidates,github){
    const normalized=uniq((candidates||[]).map(x=>text(x).replace(/[),.;]+$/g,""))).filter(isLikelyOfficialWebsite);
    if(!normalized.length)return "";
    const gh=normalizeGithubUrl(github);
    let githubHost="";
    try{githubHost=new URL(gh).hostname.replace(/^www\./,"");}catch(e){}
    const scored=normalized.map(url=>{
      let score=0;
      try{
        const u=new URL(url),h=u.hostname.replace(/^www\./,"");
        if(u.pathname==="/"||u.pathname==="")score+=5;
        if(/\b(home|website|official|homepage|product|app|demo|docs?)\b/i.test(url))score+=1;
        if(githubHost&&h!==githubHost)score+=1;
      }catch(e){}
      return {url,score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0]?.url||"";
  }

  async function fetchPage(url){
    const requested=text(url);
    if(!/^https?:\/\//i.test(requested))throw new Error("请输入有效网址");
    const isGithub=isGithubUrl(requested);
    const primary=await fetchTextSource(requested);
    const looksLikeMarkdown=primary.source==="jina"||!/<html[\s>]/i.test(primary.raw);
    let first=looksLikeMarkdown?parseMarkdownSource(primary.raw,requested):parseHtmlDocument(primary.raw,requested);
    let github=normalizeGithubUrl(first.github||"");
    let website="";

    // 官网 → GitHub：官网页面优先发现官方 GitHub。
    if(!isGithub){
      github=github||extractGithub(primary.raw)||"";
    }

    let githubApi=null;
    if(github)githubApi=await fetchGithubApi(github);

    // GitHub → 官网：GitHub API 的 homepage 是第一权威来源；README/页面链接作为补充发现。
    if(isGithub){
      const ghLinks=[...(first.websiteCandidates||[])];
      if(githubApi?.homepage)ghLinks.unshift(githubApi.homepage);
      website=chooseOfficialWebsite(ghLinks,requested);
    }

    let second=null;
    if(website){
      try{
        const source=await fetchTextSource(website);
        const markdown=source.source==="jina"||!/<html[\s>]/i.test(source.raw);
        second=markdown?parseMarkdownSource(source.raw,website):parseHtmlDocument(source.raw,website);
      }catch(e){second=null;}
    }

    // 官网 → GitHub 发现后，再补一次 GitHub 官方仓库元数据。
    if(!github && second?.github)github=normalizeGithubUrl(second.github);
    if(github && !githubApi)githubApi=await fetchGithubApi(github);

    // 如果输入官网但页面没有直接写 GitHub，JSON-LD / links / GitHub API 发现仍可补全。
    if(!website && !isGithub && githubApi?.homepage)website=chooseOfficialWebsite([githubApi.homepage],github);

    const sources=[first,second].filter(Boolean);
    const descriptionCandidates=[];
    const push=(value,source,priority)=>{if(value)descriptionCandidates.push({value,source,priority});};
    sources.forEach((s,idx)=>{
      (s.descriptionCandidates||[]).forEach(c=>push(c.value,c.source,(c.priority||50)+(idx*5)));
      if(s.description)push(s.description,idx===0?"meta-description":"secondary-description",idx===0?12:18);
    });
    if(githubApi?.description)push(githubApi.description,"github-api-description",20);

    // GitHub README 作为真实页面描述补充，而不是模板来源。
    if(github){
      try{
        const gh=await fetchTextSource(github);
        const ghDoc=gh.source==="jina"||!/<html[\s>]/i.test(gh.raw)?parseMarkdownSource(gh.raw,github):parseHtmlDocument(gh.raw,github);
        (ghDoc.descriptionCandidates||[]).forEach(c=>push(c.value,"github-readme",50));
        if(ghDoc.description)push(ghDoc.description,"github-readme",52);
        if(!githubApi?.homepage){
          const discovered=chooseOfficialWebsite(ghDoc.websiteCandidates,github);
          if(discovered && !website)website=discovered;
        }
      }catch(e){}
    }

    descriptionCandidates.sort((a,b)=>(a.priority||90)-(b.priority||90));
    const dedup=[]; const seen=new Set();
    for(const c of descriptionCandidates){
      const key=cleanDescriptionCandidate(c.value).toLowerCase();
      if(!key||seen.has(key))continue;
      seen.add(key); if(validDescriptionSource(c.value,c.source))dedup.push(c);
    }

    const canonicalRequested=canonicalUrl(requested);
    const canonicalFetched=canonicalUrl(primary.fetchedUrl||requested);
    if(primary.source==="jina"&&canonicalRequested&&canonicalFetched&&canonicalRequested!==canonicalFetched){
      throw new Error("读取结果与当前 URL 不一致，已拒绝使用旧网页内容，请再次读取");
    }

    const mergedName=(isGithub?githubApi?.name:"" )||second?.resourceName||first.resourceName||githubApi?.name||nameFromTitle(first.title,requested)||nameFromTitle(second?.title||"",website||requested);
    const mergedThumbnail=second?.thumbnail||first.thumbnail||"";
    const mergedKeywords=uniq([first.keywords,second?.keywords,(githubApi?.topics||[]).join(" ")]).join(" ");
    const mergedBody=[first.body,second?.body].filter(Boolean).join(" ").slice(0,24000);
    return {
      title:second?.title||first.title||githubApi?.name||"",
      resourceName:text(mergedName),
      description:dedup[0]?.value||"",
      descriptionCandidates:dedup,
      keywords:mergedKeywords,
      content:mergedBody,
      github:normalizeGithubUrl(github||""),
      website:text(website||(!isGithub?requested:githubApi?.homepage||"")),
      thumbnail:mergedThumbnail,
      siteName:second?.siteName||first.siteName||"",
      structuredName:second?.structuredName||first.structuredName||"",
      source:isGithub?"github+website":(website?"website+github":"website"),
      fetchedUrl:primary.fetchedUrl||requested,
      discoveredWebsite:text(website),
      discoveredGithub:normalizeGithubUrl(github||""),
      githubDescription:text(githubApi?.description||""),
      githubHomepage:text(githubApi?.homepage||"")
    };
  }

  function renderChips(container,items,type){
    const allowed=vocab(type);
    container.innerHTML=allowed.map(v=>`<button type="button" class="chip ${items.includes(v)?"selected":""}" data-chip-type="${esc(type)}" data-chip-value="${esc(v)}">${esc(v)}</button>`).join("");
  }
  function renderCategoryOptions(sel,selected){
    const list=categoryList();
    sel.innerHTML=list.map(x=>`<option value="${esc(x.parent+"::"+x.child)}" ${x.child===selected?"selected":""}>${esc(x.parentName)} / ${esc(x.label)}</option>`).join("");
  }
  function syncExportTarget(parent){
    const sel=$("#exportTarget");
    if(sel && parent && [...sel.options].some(o=>o.value===parent))sel.value=parent;
  }
  function selectedChips(type){return $$(`.chip[data-chip-type="${type}"].selected`).map(x=>x.dataset.chipValue);}

  function renderDraft(resource){
    state.draft=resource;
    const meta=resource._meta||{};
    const catSel=$("#categorySelect");
    renderCategoryOptions(catSel,resource.subcategory);
    syncExportTarget(resource.category);
    $("#resourceName").value=resource.name;
    $("#resourceUrl").value=resource.website;
    $("#resourceGithub").value=resource.github||"";
    $("#resourceThumbnail").value=resource.thumbnail||"";
    $("#resourceDescription").value=resource.description||"";
    state.descriptionMode=meta.descriptionMode||"manual";
    state.auto={id:meta.autoId||"",name:meta.autoName||"",description:meta.autoDescription||"",github:meta.autoGithub||"",thumbnail:meta.autoThumbnail||"",url:meta.autoWebsite||""};
    state.autoUrl=meta.autoUrl||resource.website||"";
    $("#resourceId").value=resource.id;
    renderChips($("#capabilityChips"),resource.capabilities,"capabilities");
    renderChips($("#scenarioChips"),resource.scenarios,"scenarios");
    renderChips($("#pricingChips"),[resource.attributes.pricing],"pricing");
    renderChips($("#platformChips"),resource.attributes.platform,"platform");
    renderChips($("#languageChips"),resource.attributes.language,"language");
    renderChips($("#audienceChips"),resource.attributes.audience,"audience");
    $("#jsonPreview").textContent=JSON.stringify(cleanResource(resource),null,2);
    renderWarnings(resource._meta?.warnings||[]);
    $("#reviewPanel").hidden=false;
  }
  function cleanResource(r){const x=JSON.parse(JSON.stringify(r));delete x._meta;return x;}
  function readForm(){
    const [parent,sub]=text($("#categorySelect").value).split("::");
    const r=state.draft||{};
    const currentId=text($("#resourceId").value);
    r.id=currentId||makeId($("#resourceName").value,$("#resourceUrl").value);
    if(!currentId)state.auto.id=r.id;
    r.name=text($("#resourceName").value);
    r.website=text($("#resourceUrl").value);
    r.description=state.descriptionMode==="auto" ? charCount($("#resourceDescription").value)===16 ? text($("#resourceDescription").value) : exact16FromSource({name:r.name,url:r.website}) : limit32($("#resourceDescription").value);
    r.github=text($("#resourceGithub").value);
    r.thumbnail=text($("#resourceThumbnail").value);
    r.category=parent;r.subcategory=sub;
    r.capabilities=selectedChips("capabilities");r.scenarios=selectedChips("scenarios");
    r.attributes={pricing:selectedChips("pricing")[0]||"增值",platform:selectedChips("platform"),language:selectedChips("language"),audience:selectedChips("audience")};
    r.icon=r.icon||defaultIcon(r.category);r.thumbnail=r.thumbnail||"";r.github=r.github||"";r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||"active";
    // 每次读取表单时重建自动来源元数据，避免旧的 autoName/autoGithub/
    // autoThumbnail 残留到人工修改后的草稿中。
    r._meta={...(r._meta||{})};
    r._meta.descriptionMode=state.descriptionMode;
    r._meta.autoId=state.auto.id||"";
    r._meta.autoDescription=state.descriptionMode==="auto"?r.description:"";
    r._meta.autoName=state.auto.name||"";
    r._meta.autoGithub=state.auto.github||"";
    r._meta.autoThumbnail=state.auto.thumbnail||"";
    r._meta.autoWebsite=state.auto.url||"";
    r._meta.autoUrl=state.autoUrl||"";
    return r;
  }
  function renderWarnings(w){$("#warnings").innerHTML=w.length?w.map(x=>`<div class="warning">⚠️ ${esc(x)}</div>`).join(""):"<div class=\"success\">✓ 未发现结构性问题</div>";}
  function setStatus(msg,ok=false){const e=$("#status");e.textContent=msg;e.className=ok?"status ok":"status";}
  function saveDraft(){
    const r=readForm();
    const all=JSON.parse(localStorage.getItem(KEY)||"[]");
    const idx=all.findIndex(x=>x.id===r.id);
    // 草稿必须保留 _meta，因为这里保存的不只是最终资源数据，
    // 还包括“哪些字段由自动读取产生”的来源身份，用于恢复后继续防串台。
    const draft=JSON.parse(JSON.stringify(r));
    if(idx>=0)all[idx]=draft;else all.unshift(draft);
    localStorage.setItem(KEY,JSON.stringify(all));
    setStatus(`草稿已保存，共 ${all.length} 条`,true);
  }
  function loadDrafts(){const all=JSON.parse(localStorage.getItem(KEY)||"[]");const sel=$("#draftSelect");sel.innerHTML=`<option value="">选择已保存草稿…</option>`+all.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join("");}
  function exportJSON(){const r=cleanResource(readForm());download(`xph-resource-${r.id}.json`,JSON.stringify(r,null,2),"application/json");}

  // 生成与项目现有六类 data/*.js 完全一致的“资源对象片段”。
  // 该片段设计为直接粘贴到对应 window.xxxResources = [ ... ] 数组中。
  function buildNativeJS(){
    const r=cleanResource(readForm());
    const target=$("#exportTarget").value||r.category||"ai";
    const platform=Array.isArray(r.attributes?.platform)?r.attributes.platform.filter(Boolean):[];
    const language=Array.isArray(r.attributes?.language)?r.attributes.language.filter(Boolean):[];
    const pricing=text(r.attributes?.pricing)||"增值";
    const audience=Array.isArray(r.attributes?.audience)?(r.attributes.audience[0]||""):text(r.audience);
    const native={
      id:text(r.id),
      name:text(r.name),
      description:text(r.description),
      icon:text(r.icon)||defaultIcon(r.category),
      thumbnail:text(r.thumbnail),
      category:text(r.category)||target,
      subcategory:text(r.subcategory),
      website:text(r.website),
      github:text(r.github),
      platform:platform.join(" / "),
      pricing,
      language:language.join(" / "),
      features:Array.isArray(r.features)?r.features:[],
      capabilities:Array.isArray(r.capabilities)?r.capabilities:[],
      scenarios:Array.isArray(r.scenarios)?r.scenarios:[],
      attributes:{
        platform,
        pricing,
        language,
        audience:Array.isArray(r.attributes?.audience)?r.attributes.audience:[audience].filter(Boolean)
      },
      audience,
      official:!!r.official,
      recommend:!!r.recommend,
      status:text(r.status)||"active"
    };
    function jsString(v){return JSON.stringify(String(v??""));}
    function jsLiteral(v,level=0){
      const pad="    ".repeat(level),child="    ".repeat(level+1);
      if(Array.isArray(v)){
        if(!v.length)return "[]";
        return "[\n"+v.map(x=>child+jsLiteral(x,level+1)).join(",\n")+"\n"+pad+"]";
      }
      if(v&&typeof v==="object"){
        const entries=Object.entries(v);
        return "{\n"+entries.map(([k,x])=>child+k+":"+jsLiteral(x,level+1)).join(",\n")+"\n"+pad+"}";
      }
      if(typeof v==="boolean")return v?"true":"false";
      if(v==null)return "null";
      return jsString(v);
    }
    // 导出为数组内可直接插入的原生对象；首行逗号用于紧接已有最后一条资源。
    return ",\n"+jsLiteral(native,0)+"\n";
  }

  function exportJS(){const r=cleanResource(readForm());const target=$("#exportTarget").value||r.category||"ai";download(`xph-resource-${r.id}-${target}-native.js`,buildNativeJS(),"application/javascript");}
  function copyJSON(){const r=cleanResource(readForm());navigator.clipboard?.writeText(JSON.stringify(r,null,2)).then(()=>setStatus("JSON 已复制",true));}
  function copyJS(){navigator.clipboard?.writeText(buildNativeJS()).then(()=>setStatus("原生 JS 数据片段已复制",true));}
  function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  function getSourceUrl(){
    return text($("#resourceUrl")?.value)||text($("#resourceGithub")?.value);
  }

  async function init(){
    if(!$("#resourceImporter"))return;
    renderCategoryOptions($("#categorySelect"),"ai_chat");
    renderChips($("#capabilityChips"),[],"capabilities");renderChips($("#scenarioChips"),[],"scenarios");renderChips($("#pricingChips"),[],"pricing");renderChips($("#platformChips"),[],"platform");renderChips($("#languageChips"),[],"language");renderChips($("#audienceChips"),[],"audience");loadDrafts();

    $("#analyzeBtn").onclick=async()=>{
      const url=getSourceUrl();
      if(!url){setStatus("请填写官网 URL 或 GitHub URL");return;}

      // 必须先捕获旧自动字段身份，再清理读取状态。
      // 这样“修改 URL → 再读取”时，旧自动简介/GitHub/缩略图会被识别为旧资源字段，
      // 不会因为 prepareForReadUrl() 先重置状态而被误认为人工内容。
      const current={
        name:text($("#resourceName").value),
        description:text($("#resourceDescription").value),
        github:text($("#resourceGithub").value),
        thumbnail:text($("#resourceThumbnail").value),
        url:text($("#resourceUrl").value)
      };
      const previousAuto={...state.auto};
      const previousAutoUrl=state.autoUrl;
      prepareForReadUrl(url);

      setStatus("正在读取并分析…");
      let meta={};
      try{meta=await fetchPage(url);}
      catch(e){meta={};setStatus("网页读取失败，已使用 URL 进行本地分析");}

      const autoName=!!previousAuto.name&&current.name===previousAuto.name;
      const autoDescription=!!previousAuto.description&&current.description===previousAuto.description;
      const autoGithub=!!previousAuto.github&&current.github===previousAuto.github;
      const autoThumbnail=!!previousAuto.thumbnail&&current.thumbnail===previousAuto.thumbnail;

      const input={...current,url:(isGithubUrl(url)?(meta.website||""):url)};
      if(!current.name||autoName){
        input.name=meta.resourceName||nameFromTitle(meta.title,url)||current.name||"未命名资源";
        markAutoField("name",input.name);
      }else state.auto.name="";

      if(!current.description||autoDescription){
        input.description=await exact16FromSourceAsync({
          name:meta.resourceName||input.name,url,
          description:meta.description,descriptionCandidates:meta.descriptionCandidates,content:meta.content,title:meta.title,keywords:meta.keywords
        });
        state.descriptionMode="auto";
        markAutoField("description",input.description);
      }else{
        input.description=limit32(current.description);
        state.descriptionMode="manual";
        state.auto.description="";
      }

      if(!current.github||autoGithub){
        input.github=meta.github||isGithubUrl(url)?normalizeGithubUrl(meta.github||url):"";
        markAutoField("github",input.github);
      }else state.auto.github="";
      if(isGithubUrl(url)&&meta.website){
        input.url=meta.website;
        markAutoField("url",meta.website);
        $("#resourceUrl").value=meta.website;
      }

      if(!current.thumbnail||autoThumbnail){
        input.thumbnail=meta.thumbnail||"";
        markAutoField("thumbnail",input.thumbnail);
      }else state.auto.thumbnail="";

      state.autoUrl=url;
      state.auto.url=isGithubUrl(url)?text(meta.website||""):url;
      state.meta.lastFetchedUrl=url;
      state.meta.previousAutoUrl=previousAutoUrl||"";

      $("#resourceName").value=input.name;
      $("#resourceDescription").value=input.description;
      $("#resourceGithub").value=input.github;
      $("#resourceThumbnail").value=input.thumbnail;

      const r=analyze({...input,...meta});
      r._meta={...(r._meta||{}),
        fetchedUrl:meta.fetchedUrl||url,
        descriptionMode:state.descriptionMode,
        autoDescription:state.descriptionMode==="auto"?input.description:"",
        autoId:state.auto.id,autoName:state.auto.name,autoGithub:state.auto.github,
        autoThumbnail:state.auto.thumbnail,autoUrl:state.autoUrl,autoWebsite:state.auto.url
      };
      renderDraft(r);
      setStatus("分析完成，请人工审核后导出",true);
    };

    $("#fetchBtn").onclick=async()=>{
      const url=getSourceUrl();
      if(!url){setStatus("请填写官网 URL 或 GitHub URL");return;}

      const current={
        name:text($("#resourceName").value),
        description:text($("#resourceDescription").value),
        github:text($("#resourceGithub").value),
        thumbnail:text($("#resourceThumbnail").value),
        url:text($("#resourceUrl").value)
      };
      const previousAuto={...state.auto};
      const previousAutoUrl=state.autoUrl;
      prepareForReadUrl(url);

      setStatus("正在读取网页…");
      try{
        const m=await fetchPage(url);
        const autoName=!!previousAuto.name&&current.name===previousAuto.name;
        const autoDescription=!!previousAuto.description&&current.description===previousAuto.description;
        const autoGithub=!!previousAuto.github&&current.github===previousAuto.github;
        const autoThumbnail=!!previousAuto.thumbnail&&current.thumbnail===previousAuto.thumbnail;

        if(!current.name||autoName){
          const value=m.resourceName||nameFromTitle(m.title,url)||current.name||"";
          $("#resourceName").value=value;markAutoField("name",value);
        }else state.auto.name="";

        if(!current.description||autoDescription){
          const value=await exact16FromSourceAsync({
            name:m.resourceName||$("#resourceName").value,url,
            description:m.description,descriptionCandidates:m.descriptionCandidates,content:m.content,title:m.title,keywords:m.keywords
          });
          $("#resourceDescription").value=value;
          state.descriptionMode="auto";
          markAutoField("description",value);
        }else{
          state.descriptionMode="manual";
          state.auto.description="";
        }

        if(!current.github||autoGithub){
          const value=text(m.github||"");
          $("#resourceGithub").value=value;markAutoField("github",value);
        }else state.auto.github="";
        if(isGithubUrl(url)&&m.website){
          $("#resourceUrl").value=m.website;
          markAutoField("url",m.website);
        }

        if(!current.thumbnail||autoThumbnail){
          const value=text(m.thumbnail||"");
          $("#resourceThumbnail").value=value;markAutoField("thumbnail",value);
        }else state.auto.thumbnail="";

        state.autoUrl=url;
        state.auto.url=isGithubUrl(url)?text(m.website||""):url;
        state.meta.lastFetchedUrl=url;
        state.meta.previousAutoUrl=previousAutoUrl||"";
        state.draft=null;
        $("#reviewPanel").hidden=true;
        $("#pageMeta").textContent=`已读取：${m.resourceName||m.title||"无标题"}${m.website?" · 已发现官网":""}${m.github?" · 已发现 GitHub 项目":""}${m.thumbnail?" · 已读取缩略图":""}`;
        setStatus("网页信息读取完成",true);
      }catch(e){setStatus(e.message||"网页读取失败");}
    };

    $("#resetBtn").onclick=()=>{state.draft=null;resetAutoState();$("#reviewPanel").hidden=true;$("#resourceName").value="";$("#resourceUrl").value="";$("#resourceDescription").value="";$("#resourceGithub").value="";$("#resourceThumbnail").value="";setStatus("已清空");};
    $("#clearAllBtn").onclick=()=>{
      if(!window.confirm("确定全部清空当前录入内容吗？\n已保存的历史草稿不会删除。"))return;
      state.draft=null;
      resetAutoState();
      $("#reviewPanel").hidden=true;
      $("#resourceName").value="";
      $("#resourceUrl").value="";
      $("#resourceDescription").value="";
      $("#resourceGithub").value="";
      $("#resourceThumbnail").value="";
      $("#resourceId").value="";
      $("#pageMeta").textContent="";
      $("#status").textContent="当前录入已全部清空";
      $("#status").className="status";
      $("#jsonPreview").textContent="等待智能分析生成。";
      $("#warnings").innerHTML="";
      $("#capabilityChips").innerHTML="";
      $("#scenarioChips").innerHTML="";
      $("#pricingChips").innerHTML="";
      $("#platformChips").innerHTML="";
      $("#languageChips").innerHTML="";
      $("#audienceChips").innerHTML="";
      // 历史草稿 localStorage 保持不变。
    };
    $("#saveBtn").onclick=()=>{state.draft=readForm();saveDraft();loadDrafts();};
    $("#exportJsonBtn").onclick=exportJSON;$("#exportJsBtn").onclick=exportJS;$("#copyBtn").onclick=copyJSON;$("#copyJsBtn").onclick=copyJS;
    $("#loadDraftBtn").onclick=()=>{const id=$("#draftSelect").value;const all=JSON.parse(localStorage.getItem(KEY)||"[]");const r=all.find(x=>x.id===id);if(r)renderDraft(r);};
    $("#clearDraftsBtn").onclick=()=>{localStorage.removeItem(KEY);loadDrafts();setStatus("本机草稿已清空",true);};
    document.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;b.classList.toggle("selected");const r=readForm();$("#jsonPreview").textContent=JSON.stringify(cleanResource(r),null,2);});
    $("#categorySelect").addEventListener("change",()=>{const [parent,sub]=$("#categorySelect").value.split("::");syncExportTarget(parent);if(state.draft){state.draft.category=parent;state.draft.subcategory=sub;state.draft.icon=defaultIcon(parent);}});
    $("#exportTarget").addEventListener("change",()=>{
      const parent=text($("#exportTarget").value);
      if(!parent)return;
      const current=text($("#categorySelect").value);
      const currentParts=current.split("::");
      let sub=currentParts[0]===parent?currentParts[1]:"";
      const group=CATEGORIES[parent];
      const children=group?.children||{};
      if(!sub || !Object.prototype.hasOwnProperty.call(children,sub)) sub=Object.keys(children)[0]||"";
      renderCategoryOptions($("#categorySelect"),sub);
      const categoryValue=sub?`${parent}::${sub}`:parent;
      $("#categorySelect").value=categoryValue;
      if(state.draft){
        state.draft.category=parent;
        state.draft.subcategory=sub;
        state.draft.icon=defaultIcon(parent);
        $("#jsonPreview").textContent=JSON.stringify(cleanResource(readForm()),null,2);
      }
      setStatus(`已人工切换分类：${group?.name||parent}`,true);
    });
    ["resourceName","resourceUrl","resourceDescription","resourceGithub","resourceThumbnail","resourceId"].forEach(id=>$("#"+id).addEventListener("input",()=>{
      const el=$("#"+id);
      if(id==="resourceDescription")el.value=limit32(el.value);
      if(id==="resourceDescription" && state.descriptionMode==="auto" && el.value!==state.auto.description){
        state.descriptionMode="manual";
        state.auto.description="";
      }
      if(id==="resourceId" && el.value!==state.auto.id)state.auto.id="";
      if(id==="resourceName" && el.value!==state.auto.name)state.auto.name="";
      if(id==="resourceGithub" && el.value!==state.auto.github)state.auto.github="";
      if(id==="resourceThumbnail" && el.value!==state.auto.thumbnail)state.auto.thumbnail="";
      if(id==="resourceUrl"){
        const nextUrl=text(el.value);
        if(state.autoUrl && nextUrl!==state.autoUrl)invalidateForUrlChange(nextUrl);
      }
      if(state.draft){const r=readForm();$("#jsonPreview").textContent=JSON.stringify(cleanResource(r),null,2);}
    }));
  }
  document.addEventListener("DOMContentLoaded",init);
})();