/**
 * 徐胖虎资源社 V5.3.10.5 Description Reader Clean Baseline
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

  const stopWords = new Set("the a an and or of to in on for with from by is are ai tool app platform official online free pro com www https http www io co".split(/\s+/));
  const norm = s => text(s).toLowerCase().replace(/[\s_\-./:：，。！!？?（）()【】\[\],，]/g," ");
  const tokens = s => uniq(norm(s).split(/\s+/).filter(x=>x && x.length>1 && !stopWords.has(x)));

  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function makeId(name,url){
    const base=text(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"resource";
    const canonical=text(url).toLowerCase().replace(/#.*$/,"").replace(/\/+$/,"");
    return `${base}-${hash(canonical||name).slice(0,6)}`;
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
    let best={score:0,cat:"website",sub:"website_tool"};
    rules.category.forEach(r=>{const s=scoreRule(hay,r.k);if(s>best.score)best={score:s,cat:r.cat,sub:r.sub};});
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
  function exact16(value){
    const s=text(value);
    return charCount(s)>16 ? Array.from(s).slice(0,16).join("") : s;
  }
  function isLikelyGenericTitle(value){
    const s=text(value).toLowerCase();
    return !s || s.length>30 || /^(your next|welcome|home|homepage|untitled|coming soon|the future|we are|we're|won.?t be|will be)/i.test(s);
  }
  function nameFromTitle(title,url){
    const t=text(title).replace(/\s+/g," ").trim();
    if(!t)return "";
    const first=t.split(/\s*[|｜—–-]\s*/)[0].trim();
    if(first && !isLikelyGenericTitle(first) && first.length<=28)return first;
    if(!isLikelyGenericTitle(t) && t.length<=24)return t;
    try{
      const host=new URL(url).hostname.replace(/^www\./i,"");
      const brand=host.split(".")[0].replace(/[-_]+/g," ").trim();
      return brand?brand.charAt(0).toUpperCase()+brand.slice(1):"";
    }catch(e){return "";}
  }
  function asArray(value){
    if(Array.isArray(value)) return value;
    if(value==null) return [];
    return [value];
  }
  function safeJson(value){
    try{return JSON.parse(value);}catch(e){return null;}
  }
  function flattenJsonLd(value){
    const out=[];
    for(const item of asArray(value)){
      if(!item || typeof item!=='object') continue;
      out.push(item);
      if(Array.isArray(item['@graph'])) out.push(...flattenJsonLd(item['@graph']));
    }
    return out;
  }
  function normalizeGithubUrl(value){
    const m=text(value).match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
    if(!m)return '';
    return `https://github.com/${m[1]}/${m[2].replace(/\.git$/i,'')}`;
  }
  function normalizeUrl(value){
    const v=text(value); if(!v)return '';
    try{const u=new URL(v);u.hash='';return u.href.replace(/\/$/,'')||u.href;}catch(e){return v.replace(/#.*$/,'').replace(/\/+$/,'');}
  }
  function extractGithub(raw){
    const m=text(raw).match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i);
    return normalizeGithubUrl(m?m[0]:'');
  }
  function cleanDescriptionCandidate(value){
    let s=text(value)
      .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
      .replace(/\[[^\]]+\]\([^)]*\)/g,'$1')
      .replace(/[`*_>#~]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!s || s.length<8 || s.length>1000)return '';
    // Description Reader 严禁把 URL、来源提示、导航/页脚文本当成简介来源。
    if(/https?:\/\/|www\.|(?:地址|网址|链接)?来源\s*[:：]|(?:source|url|link)\s*[:：]/i.test(s))return '';
    if(/^(home|homepage|welcome|about|contact|privacy|terms|login|sign in|sign up|learn more|read more|get started|menu|navigation|features|pricing|faq)$/i.test(s))return '';
    return s;
  }
  function pushDescriptionCandidate(list,value,source,priority){
    const clean=cleanDescriptionCandidate(value);
    if(!clean)return;
    const key=clean.toLowerCase();
    if(list.some(x=>x.key===key))return;
    list.push({value:clean,source,priority,key});
  }
  function extractDescriptionCandidatesFromDoc(doc){
    const list=[];
    const meta=(sel,source,priority)=>{const n=doc.querySelector(sel);pushDescriptionCandidate(list,n?.getAttribute('content'),source,priority);};
    meta('meta[name="description"]','meta-description',10);
    meta('meta[property="og:description"]','og-description',20);
    meta('meta[name="twitter:description"]','twitter-description',25);
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
      const data=safeJson(script.textContent||'');
      for(const item of flattenJsonLd(data)){
        pushDescriptionCandidate(list,item.description,'jsonld-description',30);
      }
    });
    const visible=Array.from(doc.querySelectorAll('main p,article p,section p,p')).map(n=>n.textContent).filter(Boolean);
    visible.slice(0,12).forEach((v,i)=>pushDescriptionCandidate(list,v,`visible-paragraph-${i+1}`,40));
    return list.sort((a,b)=>a.priority-b.priority);
  }
  function extractStructuredName(doc){
    try{
      const scripts=[...doc.querySelectorAll('script[type="application/ld+json"]')];
      for(const s of scripts){
        const data=flattenJsonLd(safeJson(s.textContent||''));
        for(const item of data){
          const type=String(item?.['@type']||'').toLowerCase();
          if(/website|organization|softwareapplication|product|brand/.test(type) && text(item?.name))return text(item.name);
        }
      }
    }catch(e){}
    return '';
  }
  function isChinese(value){return /[\u3400-\u9fff]/.test(text(value));}
  async function translateToChinese(value){
    const source=text(value); if(!source||isChinese(source))return source;
    const q=encodeURIComponent(source.slice(0,900));
    const endpoints=[
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`,
      `https://api.mymemory.translated.net/get?q=${q}&langpair=auto|zh-CN`
    ];
    for(const endpoint of endpoints){
      try{
        const r=await fetch(endpoint,{mode:'cors'}); if(!r.ok)continue;
        const data=await r.json();
        if(Array.isArray(data) && Array.isArray(data[0])){
          const out=data[0].map(x=>Array.isArray(x)?x[0]:'').filter(Boolean).join('');
          if(out)return text(out);
        }
        const out=text(data?.responseData?.translatedText||'');
        if(out)return out;
      }catch(e){}
    }
    return isChinese(source)?source:"";
  }
  async function exact16FromSource(input){
    // 只选择一个“真实来源”生成简介，禁止把多个候选句子拼接成伪简介。
    const candidates=[];
    for(const item of asArray(input?.descriptionCandidates)){
      if(typeof item==='string')pushDescriptionCandidate(candidates,item,'source',90);
      else if(item)pushDescriptionCandidate(candidates,item.value,item.source||'source',Number(item.priority||90));
    }
    pushDescriptionCandidate(candidates,input?.description,'provided-description',15);

    const ordered=candidates.sort((a,b)=>a.priority-b.priority);
    for(const item of ordered){
      const translated=cleanDescriptionCandidate(await translateToChinese(item.value));
      if(charCount(translated)>=16)return Array.from(translated).slice(0,16).join('');
    }

    const title=cleanDescriptionCandidate(await translateToChinese(input?.title||input?.name||''));
    if(charCount(title)>=16)return Array.from(title).slice(0,16).join('');
    return '';
  }

  async function fetchGithubInfo(githubUrl){
    const github=normalizeGithubUrl(githubUrl); if(!github)throw new Error('无效 GitHub URL');
    const m=github.match(/github\.com\/([^/]+)\/([^/]+)/i); if(!m)throw new Error('无效 GitHub URL');
    const api=`https://api.github.com/repos/${m[1]}/${m[2]}`;
    const r=await fetch(api,{headers:{Accept:'application/vnd.github+json'}});
    if(!r.ok)throw new Error('GitHub 读取失败：HTTP '+r.status);
    const data=await r.json();
    return {github:normalizeGithubUrl(data.html_url||github),homepage:text(data.homepage),resourceName:text(data.name),title:text(data.name),description:text(data.description),descriptionCandidates:[],keywords:asArray(data.topics),content:text(data.description),thumbnail:'',siteName:'GitHub',structuredName:''};
  }

  async function fetchPage(url){
    const clean=normalizeUrl(url);
    if(!/^https?:\/\//i.test(clean))throw new Error('请输入有效网址');

    let githubInput=normalizeGithubUrl(clean);
    if(githubInput && /github\.com\//i.test(clean)){
      const gh=await fetchGithubInfo(githubInput);
      if(gh.homepage){
        try{
          const web=await fetchPage(gh.homepage);
          return {...web,github:gh.github||web.github,resourceName:web.resourceName||gh.resourceName,homepage:web.homepage||gh.homepage||gh.homepage||'',descriptionCandidates:[...asArray(web.descriptionCandidates),...(gh.description?[{value:gh.description,source:'github-repository-description',priority:35}]:[])]};
        }catch(e){
          gh.descriptionCandidates=gh.description?[{value:gh.description,source:'github-repository-description',priority:35}]:[];
          gh.description=await exact16FromSource(gh);
          return gh;
        }
      }
      gh.descriptionCandidates=gh.description?[{value:gh.description,source:'github-repository-description',priority:35}]:[];
      gh.description=await exact16FromSource(gh);
      return gh;
    }

    let raw='',source='direct';
    try{
      const r=await fetch(clean,{mode:'cors',redirect:'follow'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      raw=await r.text();
    }catch(e){
      const proxy='https://r.jina.ai/'+clean;
      const r=await fetch(proxy,{headers:{Accept:'text/plain'}});
      if(!r.ok)throw new Error('网页读取失败：'+r.status);
      raw=await r.text(); source='jina';
    }

    const looksLikeMarkdown=source==='jina'||!/<html[\s>]/i.test(raw);
    let title='',description='',keywords='',body='',siteName='',structuredName='',github=extractGithub(raw),thumbnail='',descriptionCandidates=[];
    let homepage='';

    if(looksLikeMarkdown){
      const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      const heading=lines.find(x=>/^#{1,6}\s+/.test(x));
      title=text((heading||'').replace(/^#{1,6}\s+/,'').replace(/\s+#*$/,''));
      for(const line of lines){
        if(/^#{1,6}\s+/.test(line)||/^[-*]\s+/.test(line)||/^https?:\/\//i.test(line))continue;
        const cleaned=cleanDescriptionCandidate(line);
        if(cleaned)pushDescriptionCandidate(descriptionCandidates,cleaned,'reader-paragraph',40);
      }
      body=lines.filter(x=>!/^#{1,6}\s+/.test(x)).join(' ').slice(0,18000);
      const metaMatch=raw.match(/(?:description|meta description)\s*[:：]\s*(.+)/i);
      if(metaMatch)pushDescriptionCandidate(descriptionCandidates,metaMatch[1],'reader-description',15);
      const fm=raw.match(/^---\s*[\s\S]*?description:\s*["']?(.+?)["']?\s*$/im);
      if(fm)pushDescriptionCandidate(descriptionCandidates,fm[1],'frontmatter-description',12);
      thumbnail=text(raw.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i)?.[1]||'');
    }else{
      const doc=new DOMParser().parseFromString(raw,'text/html');
      const get=(sel,attr)=>{const n=doc.querySelector(sel);return n?(attr?n.getAttribute(attr):n.textContent):''};
      title=text(get('title'));
      descriptionCandidates=extractDescriptionCandidatesFromDoc(doc);
      description=text(descriptionCandidates[0]?.value||'');
      keywords=text(get('meta[name="keywords"]','content'));
      const og=text(get('meta[property="og:title"]','content'));
      thumbnail=text(get('meta[property="og:image"]','content')||get('meta[name="twitter:image"]','content')||get('meta[name="twitter:image:src"]','content'));
      if(!thumbnail){
        for(const item of flattenJsonLd(Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(s=>safeJson(s.textContent||'')))){
          const img=item?.image;
          if(img){thumbnail=Array.isArray(img)?text(img[0]):typeof img==='object'?text(img.url):text(img);if(thumbnail)break;}
        }
      }
      siteName=text(get('meta[property="og:site_name"]','content')||get('meta[name="application-name"]','content'));
      structuredName=extractStructuredName(doc);
      title=title||og;
      body=text(doc.body?.innerText||'').slice(0,18000);
      github=github||[...doc.querySelectorAll('a[href*="github.com"]')].map(a=>normalizeGithubUrl(a.href)).find(Boolean)||'';
      homepage=clean;
    }

    if(github){
      try{
        const gh=await fetchGithubInfo(github);
        if(gh.description)pushDescriptionCandidate(descriptionCandidates,gh.description,'github-repository-description',35);
        homepage=homepage||gh.homepage||'';
        github=gh.github||github;
      }catch(e){}
    }

    const name=nameFromTitle(structuredName||siteName||title,clean);
    const description16=await exact16FromSource({name,url:clean,title,description,descriptionCandidates,content:body,keywords});
    return {title,resourceName:name,description:description16,descriptionCandidates,keywords,content:body,github,thumbnail,siteName,structuredName,source,fetchedUrl:clean,homepage:homepage||clean};
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
    r.description=state.descriptionMode==="auto" ? exact16($("#resourceDescription").value) : limit32($("#resourceDescription").value);
    r.github=text($("#resourceGithub").value);
    r.thumbnail=text($("#resourceThumbnail").value);
    r.category=parent;r.subcategory=sub;
    r.capabilities=selectedChips("capabilities");r.scenarios=selectedChips("scenarios");
    r.attributes={pricing:selectedChips("pricing")[0]||"增值",platform:selectedChips("platform"),language:selectedChips("language"),audience:selectedChips("audience")};
    r.icon=r.icon||"🔗";r.thumbnail=r.thumbnail||"";r.github=r.github||"";r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||"active";
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
      icon:text(r.icon)||"🔗",
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
    renderCategoryOptions($("#categorySelect"),"ai_chat");
    renderChips($("#capabilityChips"),[],"capabilities");renderChips($("#scenarioChips"),[],"scenarios");renderChips($("#pricingChips"),[],"pricing");renderChips($("#platformChips"),[],"platform");renderChips($("#languageChips"),[],"language");renderChips($("#audienceChips"),[],"audience");loadDrafts();

    $("#analyzeBtn").onclick=async()=>{
      const url=text($("#resourceUrl").value);
      if(!url){setStatus("请先填写 URL");return;}
      const current={
        name:text($("#resourceName").value),
        description:text($("#resourceDescription").value),
        github:text($("#resourceGithub").value),
        thumbnail:text($("#resourceThumbnail").value)
      };
      const sameAutoUrl=state.autoUrl===url;
      setStatus("正在读取并分析…");
      let meta={};
      try{meta=await fetchPage(url);
        if(normalizeGithubUrl(url) && meta.homepage){
          $("#resourceUrl").value=normalizeUrl(meta.homepage);
        }
      }catch(e){meta={};setStatus("网页读取失败，已使用 URL 进行本地分析");}

      // 同一 URL 重读时，刷新仍由自动读取产生的字段；人工改过的字段保持不动。
      const autoName=sameAutoUrl && current.name===state.auto.name;
      const autoDescription=sameAutoUrl && current.description===state.auto.description;
      const autoGithub=sameAutoUrl && current.github===state.auto.github;
      const autoThumbnail=sameAutoUrl && current.thumbnail===state.auto.thumbnail;

      const resolvedUrl=normalizeUrl($("#resourceUrl").value)||url;
      const input={...current,url:resolvedUrl};
      if(!current.name || autoName){
        input.name=meta.resourceName||nameFromTitle(meta.title,url)||current.name||"未命名资源";
        markAutoField("name",input.name);
      }else state.auto.name="";
      if(!current.description || autoDescription){
        input.description=exact16(meta.description||"");
        state.descriptionMode="auto";
        markAutoField("description",input.description);
      }else{
        input.description=limit32(current.description);
        state.descriptionMode="manual";
        state.auto.description="";
      }
      if(!current.github || autoGithub){
        input.github=meta.github||"";
        markAutoField("github",input.github);
      }else state.auto.github="";
      if(!current.thumbnail || autoThumbnail){
        input.thumbnail=meta.thumbnail||"";
        markAutoField("thumbnail",input.thumbnail);
      }else state.auto.thumbnail="";
      state.autoUrl=resolvedUrl;
      $("#resourceName").value=input.name;
      $("#resourceDescription").value=input.description;
      $("#resourceGithub").value=input.github;
      $("#resourceThumbnail").value=input.thumbnail;
      const r=analyze({...input,...meta});
      r._meta={...(r._meta||{}),descriptionMode:state.descriptionMode,autoDescription:state.descriptionMode==="auto"?exact16(input.description):"",autoId:state.auto.id,autoName:state.auto.name,autoGithub:state.auto.github,autoThumbnail:state.auto.thumbnail,autoUrl:state.autoUrl};
      renderDraft(r);setStatus("分析完成，请人工审核后导出",true);
    };
    $("#fetchBtn").onclick=async()=>{
      const url=text($("#resourceUrl").value);
      if(!url){setStatus("请先填写 URL");return;}
      const current={name:text($("#resourceName").value),description:text($("#resourceDescription").value),github:text($("#resourceGithub").value),thumbnail:text($("#resourceThumbnail").value)};
      const sameAutoUrl=state.autoUrl===url;
      setStatus("正在读取网页…");
      try{
        const m=await fetchPage(url);
        if(normalizeGithubUrl(url) && m.homepage){
          $("#resourceUrl").value=normalizeUrl(m.homepage);
        }
        const autoName=sameAutoUrl && current.name===state.auto.name;
        const autoDescription=sameAutoUrl && current.description===state.auto.description;
        const autoGithub=sameAutoUrl && current.github===state.auto.github;
        const autoThumbnail=sameAutoUrl && current.thumbnail===state.auto.thumbnail;
        if(!current.name || autoName){
          const value=m.resourceName||nameFromTitle(m.title,url)||current.name||"";
          $("#resourceName").value=value;markAutoField("name",value);
        }else state.auto.name="";
        if(!current.description || autoDescription){
          const value=exact16(m.description||"");
          $("#resourceDescription").value=value;state.descriptionMode="auto";markAutoField("description",value);
        }else{state.descriptionMode="manual";state.auto.description="";}
        if(!current.github || autoGithub){
          const value=text(m.github||"");$("#resourceGithub").value=value;markAutoField("github",value);
        }else state.auto.github="";
        if(!current.thumbnail || autoThumbnail){
          const value=text(m.thumbnail||"");$("#resourceThumbnail").value=value;markAutoField("thumbnail",value);
        }else state.auto.thumbnail="";
        state.autoUrl=normalizeUrl($("#resourceUrl").value)||url;
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
    $("#categorySelect").addEventListener("change",()=>{const [parent,sub]=$("#categorySelect").value.split("::");syncExportTarget(parent);if(state.draft){state.draft.category=parent;state.draft.subcategory=sub;}});
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