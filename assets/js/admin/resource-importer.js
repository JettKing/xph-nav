/**
 * 徐胖虎资源社 V5.3.10.5 · Description Reader Architecture Reset
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
    auto:{id:"",name:"",description:"",github:"",thumbnail:""},
    autoUrl:"",
    descriptionMode:"manual"
  };

  // 自动读取字段的“来源身份”。只有仍然等于自动读取结果的字段，
  // 在 URL 发生变化时才允许被清空；人工改过的字段必须保留。
  function resetAutoState(){
    state.auto={id:"",name:"",description:"",github:"",thumbnail:""};
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
    const fields=[["resourceId","id"],["resourceName","name"],["resourceDescription","description"],["resourceGithub","github"],["resourceThumbnail","thumbnail"]];
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
    state.auto={id:"",name:"",description:"",github:"",thumbnail:""};
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

  function normalizeSourceText(value){
    return text(value).replace(/https?:\/\/\S+/gi," ").replace(/\[[^\]]*\]\([^)]*\)/g," ")
      .replace(/[`*_>#|{}]/g," ").replace(/[\r\n]+/g,"。 ").replace(/\s+/g," ").trim();
  }

  // 自动简介候选源：严格按“产品事实来源”优先级取值。
  // 禁止把整页正文、FAQ、营销对比、免责声明、导航等随机句子作为核心简介。
  function cleanDescriptionCandidate(value){
    return text(value).replace(/\s+/g,"").replace(/[。！？!?.,，、；：:;“”‘’"'()（）\[\]{}<>《》\-–—]/g,"");
  }
  function validDescriptionSource(value){
    const raw=normalizeSourceText(value);
    if(!raw)return false;
    if(/^https?:\/\//i.test(raw))return false;
    if(raw.length<6)return false;
    return true;
  }

  // 候选项必须携带来源等级；高等级来源永远优先于正文。
  // 自动简介只允许使用“网页明确声明的产品描述”来源。
  // 不扫描正文、不抽取段落、不使用 GitHub README、不使用营销/FAQ/免责声明。
  function sourceCandidates(input){
    const allowed=new Set([
      "meta-description",
      "og-description",
      "twitter-description",
      "meta-item-description",
      "jsonld-description",
      "github-repository-description"
    ]);
    const candidates=[];
    const add=(value,source,priority)=>{
      if(!allowed.has(source))return;
      const raw=normalizeSourceText(value);
      if(!validDescriptionSource(raw))return;
      const key=cleanDescriptionCandidate(raw).toLowerCase();
      if(!key||candidates.some(x=>cleanDescriptionCandidate(x.value).toLowerCase()===key))return;
      candidates.push({value:raw,source,priority:Number(priority||90)});
    };
    (input.descriptionCandidates||[]).forEach(x=>add(x?.value||x,x?.source||"unknown",x?.priority));
    // 兼容旧状态：只有明确标记为 description 的字段才可进入候选。
    if(input.description)add(input.description,"meta-description",10);
    return candidates.sort((a,b)=>a.priority-b.priority);
  }

  function exact16FromSource(input){
    const candidates=sourceCandidates(input);
    const cleanChinese=candidates
      .map(c=>({value:cleanDescriptionCandidate(c.value),source:c.source,priority:c.priority}))
      .filter(x=>/^[\u3400-\u9fff]{16,}$/.test(x.value))
      .sort((a,b)=>a.priority-b.priority||xLength(a.value)-xLength(b.value));
    if(!cleanChinese.length)return "";
    return Array.from(cleanChinese[0].value).slice(0,16).join("");
  }
  function xLength(v){return Array.from(String(v||"")).length;}
  function isMostlyChinese(value){
    const s=text(value).replace(/[\s\p{P}\p{S}]/gu,"");
    if(!s)return false;
    const zh=(s.match(/[\u3400-\u9fff]/g)||[]).length;
    return zh/Math.max(1,Array.from(s).length)>=0.45;
  }
  function compactChinese16(value){
    const s=normalizeSourceText(value).replace(/[\u3400-\u9fffA-Za-z0-9]/g,ch=>ch).replace(/[^\u3400-\u9fff]/g,"");
    if(Array.from(s).length<16)return "";
    return Array.from(s).slice(0,16).join("");
  }
  async function translateToChinese(value){
    const source=normalizeSourceText(value);
    if(!source||isMostlyChinese(source))return source;
    const endpoint="https://api.mymemory.translated.net/get?q="+encodeURIComponent(source.slice(0,1200))+"&langpair=auto|zh-CN";
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6500);
    try{
      const r=await fetch(endpoint,{cache:"no-store",signal:controller.signal,headers:{"Accept":"application/json"}});
      if(!r.ok)throw new Error("translation failed");
      const data=await r.json();
      const translated=text(data?.responseData?.translatedText||"");
      return translated||"";
    }catch(e){return "";}
    finally{clearTimeout(timer);}
  }
  async function exact16FromSourceTranslated(input){
    const candidates=sourceCandidates(input);
    for(const c of candidates){
      const raw=normalizeSourceText(c.value);
      if(!raw)continue;
      if(isMostlyChinese(raw)){
        const v=compactChinese16(raw);
        if(v)return v;
        continue;
      }
      const zh=await translateToChinese(raw);
      const v=compactChinese16(zh);
      if(v)return v;
    }
    return "";
  }
  function autoDescription16(input){return exact16FromSource(input);}
  async function chineseDescription(input){return exact16FromSourceTranslated(input);}
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

    return out.sort((a,b)=>a.priority-b.priority);
  }

  function withTimeout(promise,ms,message){
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))
    ]);
  }

  function isGithubRepoUrl(url){
    try{
      const u=new URL(text(url));
      return u.hostname.toLowerCase().replace(/^www\./,'')==='github.com' && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/)?$/.test(u.pathname);
    }catch(e){return false;}
  }

  function githubRepoParts(url){
    try{
      const u=new URL(text(url));
      const m=u.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      return m?{owner:m[1],repo:m[2]}:null;
    }catch(e){return null;}
  }

  function resolveUrl(base,href){
    try{return new URL(text(href),text(base)).href;}catch(e){return text(href);}
  }

  function extractHomepage(raw,baseUrl){
    const decoded=decodeHtmlEntities(raw).replace(/\\\//g,"/");
    const direct=decoded.match(/(?:homepage|website|home_page|url)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/i)?.[1]||"";
    if(direct&&!/github\.com/i.test(direct))return direct;
    const links=(decoded.match(/https?:\/\/[^\s"'<>]+/gi)||[]).map(x=>x.replace(/[),.;]+$/g,""));
    return links.find(x=>!/(?:github\.com|github\.io|gitlab\.com|bitbucket\.org)/i.test(x))||"";
  }

  function mergeCandidates(...lists){
    const out=[]; const seen=new Set();
    for(const list of lists.flat()){
      for(const x of (list||[])){
        const value=normalizeSourceText(x?.value||x);
        const source=text(x?.source||"unknown");
        const key=cleanDescriptionCandidate(value).toLowerCase();
        if(!validDescriptionSource(value)||!key||seen.has(key))continue;
        seen.add(key);
        out.push({value,source,priority:Number(x?.priority||90)});
      }
    }
    return out.sort((a,b)=>a.priority-b.priority);
  }

  async function fetchRawPage(url){
    const clean=text(url);
    if(!/^https?:\/\//i.test(clean))throw new Error("请输入有效网址");
    let raw="",source="direct",fetchedUrl=clean,directError=null;
    try{
      const r=await withTimeout(fetch(clean,{mode:"cors",redirect:"follow",cache:"no-store",headers:{"Cache-Control":"no-cache","Pragma":"no-cache"}}),6000,"网页读取超时");
      if(!r.ok)throw new Error("HTTP "+r.status);
      raw=await r.text(); fetchedUrl=r.url||clean;
    }catch(e){directError=e;}

    if(!raw){
      const proxy="https://r.jina.ai/"+clean;
      try{
        const r=await withTimeout(fetch(proxy,{cache:"no-store",headers:{Accept:"application/json","x-no-cache":"true","x-cache-tolerance":"0","DNT":"1"}}),14000,"网页代理读取超时");
        if(!r.ok)throw new Error("网页读取失败："+r.status);
        const ct=(r.headers.get("content-type")||"").toLowerCase();
        if(ct.includes("application/json")){
          const payload=await r.json(); const data=payload?.data||payload;
          raw=text(data?.content||""); fetchedUrl=text(data?.url||clean); source="jina-json";
          var jinaTitle=text(data?.title||"");
          if(!raw&&!jinaTitle)throw new Error("代理未返回有效内容");
        }else{
          raw=await r.text(); fetchedUrl=clean; source="jina";
        }
      }catch(e){throw new Error(directError?.message||e.message||"网页读取失败");}
    }

    if(fetchedUrl&&!sameFetchedResource(clean,fetchedUrl))throw new Error("读取结果与当前 URL 不一致，已拒绝使用");
    return {raw,source,fetchedUrl,clean};
  }

  function parseRawPage(raw,source,clean,fetchedUrl){
    const looksLikeMarkdown=source.startsWith("jina")||!/<html[\s>]/i.test(raw);
    let title="",description="",keywords="",body="",siteName="",structuredName="",github=extractGithub(raw),thumbnail="",descriptionCandidates=[];
    if(looksLikeMarkdown){
      const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      const fmTitle=raw.match(/^---\s*\n(?:.*\n)*?title:\s*["']?(.+?)["']?\s*\n(?:.*\n)*?---/im)?.[1]||"";
      const heading=lines.find(x=>/^#{1,6}\s+/.test(x));
      title=text(fmTitle||heading||"").replace(/^#{1,6}\s+/i,"").replace(/\s+#*$/g,"");
      const blocks=[];
      for(const line of lines){
        if(/^---$/.test(line)||/^#{1,6}\s+/.test(line)||/^[-*]\s+/.test(line)||/^https?:\/\//i.test(line))continue;
        const cleaned=line.replace(/[`*_>\[\]]/g," ").replace(/\s+/g," ").trim();
        if(cleaned.length>=12)blocks.push(cleaned);
      }
      body=blocks.join(" ").slice(0,18000);
    }else{
      const doc=new DOMParser().parseFromString(raw,"text/html");
      const get=(sel,attr)=>{const n=doc.querySelector(sel);return n?(attr?n.getAttribute(attr):n.textContent):""};
      title=text(get("title"));
      descriptionCandidates=extractDescriptionCandidatesFromDoc(doc);
      description=text(descriptionCandidates[0]?.value||"");
      keywords=text(get('meta[name="keywords"]',"content"));
      thumbnail=text(get('meta[property="og:image"]',"content")||get('meta[name="twitter:image"]',"content")||get('meta[name="twitter:image:src"]',"content"));
      siteName=text(get('meta[property="og:site_name"]',"content")||get('meta[name="application-name"]',"content"));
      structuredName=extractStructuredName(doc);
      try{
        const data=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent||"")).flatMap(x=>Array.isArray(x)?x:(Array.isArray(x?.["@graph"])?x["@graph"]:[x]));
        const repoCandidates=data.flatMap(x=>{const same=Array.isArray(x?.sameAs)?x.sameAs:[x?.sameAs];return [x?.codeRepository,x?.repository,...same].flatMap(v=>typeof v==="object"?[v?.url]:[v]);});
        github=github||repoCandidates.map(normalizeGithubUrl).find(Boolean)||"";
      }catch(e){}
      title=title||text(get('meta[property="og:title"]',"content"));
      body=text(doc.body?.innerText||"").slice(0,18000);
      const links=[...doc.querySelectorAll('a[href]')].map(a=>resolveUrl(clean,a.getAttribute('href')||a.href||""));
      github=github||links.map(normalizeGithubUrl).find(Boolean)||"";
    }
    return {title,description,descriptionCandidates,keywords,content:body,github:normalizeGithubUrl(github),thumbnail,siteName,structuredName,source,fetchedUrl};
  }

  async function fetchGithubRepository(url){
    const parts=githubRepoParts(url);
    if(!parts)throw new Error("GitHub URL 必须是 github.com/owner/repo");
    const api=`https://api.github.com/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}`;
    try{
      const r=await withTimeout(fetch(api,{cache:"no-store",headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}}),7000,"GitHub API 读取超时");
      if(!r.ok)throw new Error("GitHub API HTTP "+r.status);
      const d=await r.json();
      return {
        title:text(d.name),
        resourceName:text(d.name),
        description:text(d.description),
        descriptionCandidates:d.description?[{value:d.description,source:"github-repository-description",priority:40}]:[],
        keywords:Array.isArray(d.topics)?d.topics.join(" "):"",
        content:text(d.name+" "+d.description),
        github:text(d.html_url||url),
        thumbnail:"",
        siteName:"GitHub",
        structuredName:text(d.name),
        homepage:text(d.homepage),
        source:"github-api",
        fetchedUrl:text(d.html_url||url)
      };
    }catch(apiError){
      const rawPage=await fetchRawPage(url);
      const parsed=parseRawPage(rawPage.raw,rawPage.source,rawPage.clean,rawPage.fetchedUrl);
      const homepage=extractHomepage(rawPage.raw,url);
      return {...parsed,resourceName:nameFromTitle(parsed.structuredName, url)||nameFromTitle(parsed.title,url),homepage,github:normalizeGithubUrl(parsed.github)||text(url)};
    }
  }

  function chooseDescriptionCandidates(primary,secondary){
    // 真实来源优先：官网声明 > GitHub 仓库描述；不再使用正文、README 或名称模板生成候选。
    return mergeCandidates(
      (primary?.descriptionCandidates||[]).map(x=>({...x,priority:Number(x.priority||10)})),
      (secondary?.descriptionCandidates||[]).map(x=>({...x,priority:Number(x.priority||40)}))
    );
  }

  async function fetchPage(url,githubHint=""){
    const clean=text(url);
    if(!/^https?:\/\//i.test(clean))throw new Error("请输入有效网址");

    let website=null,github=null,websiteUrl="",githubUrl="";
    const inputIsGithub=isGithubRepoUrl(clean);

    if(inputIsGithub){
      github=await fetchGithubRepository(clean);
      githubUrl=normalizeGithubUrl(github.github)||clean;
      websiteUrl=text(github.homepage);
      if(websiteUrl&&/^https?:\/\//i.test(websiteUrl)&&!isGithubRepoUrl(websiteUrl)){
        try{const raw=await fetchRawPage(websiteUrl);website=parseRawPage(raw.raw,raw.source,raw.clean,raw.fetchedUrl);}
        catch(e){website=null;}
      }
    }else{
      const raw=await fetchRawPage(clean);
      website=parseRawPage(raw.raw,raw.source,raw.clean,raw.fetchedUrl);
      websiteUrl=clean;
      githubUrl=normalizeGithubUrl(website.github)||normalizeGithubUrl(githubHint);
      if(githubUrl){
        try{github=await fetchGithubRepository(githubUrl);}catch(e){github=null;}
      }
    }

    // 双向发现：官网 → GitHub、GitHub → 官网。只接受页面/API 明确提供的地址，不猜测。
    if(!githubUrl&&website?.github)githubUrl=normalizeGithubUrl(website.github);
    if(!websiteUrl&&github?.homepage)websiteUrl=text(github.homepage);

    const candidates=chooseDescriptionCandidates(website,github);
    const title=text(website?.title||github?.title||github?.resourceName||"");
    const structuredName=text(website?.structuredName||github?.structuredName||"");
    const siteName=text(website?.siteName||"");
    const name=nameFromTitle(structuredName,websiteUrl||clean)||nameFromTitle(title,websiteUrl||clean)||text(github?.resourceName)||nameFromTitle(siteName,websiteUrl||clean);
    const fetchedUrl=inputIsGithub?(github?.fetchedUrl||clean):(website?.fetchedUrl||clean);
    const thumbnail=text(website?.thumbnail||"");

    return {
      title,
      resourceName:name,
      description:text(candidates[0]?.value||""),
      descriptionCandidates:candidates,
      keywords:text([website?.keywords,github?.keywords].filter(Boolean).join(" ")),
      content:text([website?.content,github?.content].filter(Boolean).join(" ")).slice(0,18000),
      github:githubUrl,
      thumbnail,
      siteName,
      structuredName,
      source:inputIsGithub?"github+website":"website+github",
      fetchedUrl,
      websiteUrl:websiteUrl||"",
      githubUrl:githubUrl||""
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
    state.auto={id:meta.autoId||"",name:meta.autoName||"",description:meta.autoDescription||"",github:meta.autoGithub||"",thumbnail:meta.autoThumbnail||""};
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

  async function init(){
    if(!$("#resourceImporter"))return;

    // P0：初始化阶段必须与按钮事件绑定彻底隔离。
    // 任一分类/标签/草稿初始化异常，都不能阻断后续按钮绑定。
    const initErrors=[];
    const safeInit=(label,fn)=>{
      try{fn();}
      catch(e){
        console.error(`[ResourceImporter] ${label} 初始化失败`,e);
        initErrors.push(`${label}: ${e?.message||e}`);
      }
    };

    safeInit("分类",()=>renderCategoryOptions($("#categorySelect"),"ai_chat"));
    safeInit("能力标签",()=>renderChips($("#capabilityChips"),[],"capabilities"));
    safeInit("场景标签",()=>renderChips($("#scenarioChips"),[],"scenarios"));
    safeInit("价格标签",()=>renderChips($("#pricingChips"),[],"pricing"));
    safeInit("平台标签",()=>renderChips($("#platformChips"),[],"platform"));
    safeInit("语言标签",()=>renderChips($("#languageChips"),[],"language"));
    safeInit("受众标签",()=>renderChips($("#audienceChips"),[],"audience"));
    safeInit("草稿列表",loadDrafts);

    $("#analyzeBtn").onclick=async()=>{
      const url=text($("#resourceUrl").value);
      if(!url){setStatus("请先填写 URL");return;}

      // 必须先捕获旧自动字段身份，再清理读取状态。
      // 这样“修改 URL → 再读取”时，旧自动简介/GitHub/缩略图会被识别为旧资源字段，
      // 不会因为 prepareForReadUrl() 先重置状态而被误认为人工内容。
      const current={
        name:text($("#resourceName").value),
        description:text($("#resourceDescription").value),
        github:text($("#resourceGithub").value),
        thumbnail:text($("#resourceThumbnail").value)
      };
      const previousAuto={...state.auto};
      const previousAutoUrl=state.autoUrl;
      prepareForReadUrl(url);

      setStatus("正在读取并分析…");
      let meta={};
      try{meta=await fetchPage(url,current.github);}
      catch(e){meta={};setStatus("网页读取失败，已使用 URL 进行本地分析");}

      const autoName=!!previousAuto.name&&current.name===previousAuto.name;
      const autoDescription=!!previousAuto.description&&current.description===previousAuto.description;
      const autoGithub=!!previousAuto.github&&current.github===previousAuto.github;
      const autoThumbnail=!!previousAuto.thumbnail&&current.thumbnail===previousAuto.thumbnail;

      const input={...current,url};
      if(!current.name||autoName){
        input.name=meta.resourceName||nameFromTitle(meta.title,url)||current.name||"未命名资源";
        markAutoField("name",input.name);
      }else state.auto.name="";

      if(!current.description||autoDescription){
        input.description=await exact16FromSourceTranslated({
          name:meta.resourceName||input.name,url,
          description:meta.description,descriptionCandidates:meta.descriptionCandidates,title:meta.title,keywords:meta.keywords
        });
        state.descriptionMode="auto";
        markAutoField("description",input.description);
      }else{
        input.description=limit32(current.description);
        state.descriptionMode="manual";
        state.auto.description="";
      }

      if(!current.github||autoGithub){
        input.github=meta.github||"";
        markAutoField("github",input.github);
      }else state.auto.github="";

      if(!current.thumbnail||autoThumbnail){
        input.thumbnail=meta.thumbnail||"";
        markAutoField("thumbnail",input.thumbnail);
      }else state.auto.thumbnail="";

      state.autoUrl=url;
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
        autoThumbnail:state.auto.thumbnail,autoUrl:state.autoUrl
      };
      renderDraft(r);
      setStatus("分析完成，请人工审核后导出",true);
    };

    $("#fetchBtn").onclick=async()=>{
      const url=text($("#resourceUrl").value);
      if(!url){setStatus("请先填写 URL");return;}

      const current={
        name:text($("#resourceName").value),
        description:text($("#resourceDescription").value),
        github:text($("#resourceGithub").value),
        thumbnail:text($("#resourceThumbnail").value)
      };
      const previousAuto={...state.auto};
      const previousAutoUrl=state.autoUrl;
      prepareForReadUrl(url);

      setStatus("正在读取网页…");
      try{
        const m=await fetchPage(url,current.github);
        const autoName=!!previousAuto.name&&current.name===previousAuto.name;
        const autoDescription=!!previousAuto.description&&current.description===previousAuto.description;
        const autoGithub=!!previousAuto.github&&current.github===previousAuto.github;
        const autoThumbnail=!!previousAuto.thumbnail&&current.thumbnail===previousAuto.thumbnail;

        if(!current.name||autoName){
          const value=m.resourceName||nameFromTitle(m.title,url)||current.name||"";
          $("#resourceName").value=value;markAutoField("name",value);
        }else state.auto.name="";

        if(!current.description||autoDescription){
          const value=await exact16FromSourceTranslated({
            name:m.resourceName||$("#resourceName").value,url,
            description:m.description,descriptionCandidates:m.descriptionCandidates,title:m.title,keywords:m.keywords
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

        if(!current.thumbnail||autoThumbnail){
          const value=text(m.thumbnail||"");
          $("#resourceThumbnail").value=value;markAutoField("thumbnail",value);
        }else state.auto.thumbnail="";

        state.autoUrl=url;
        state.meta.lastFetchedUrl=url;
        state.meta.previousAutoUrl=previousAutoUrl||"";
        state.draft=null;
        $("#reviewPanel").hidden=true;
        $("#pageMeta").textContent=`已读取：${m.resourceName||m.title||"无标题"}${m.github?" · 已发现 GitHub 项目":""}${m.thumbnail?" · 已读取缩略图":""}`;
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

    // 初始化有局部问题时，只提示诊断，不影响已经绑定完成的按钮。
    if(initErrors.length){
      console.error("[ResourceImporter] partial initialization errors:",initErrors);
      setStatus(`界面初始化有 ${initErrors.length} 项异常，但按钮事件仍已绑定；请查看控制台诊断。`);
    }
  }
  document.addEventListener("DOMContentLoaded",init);
})();