/**
 * 徐胖虎资源社 V5.2 智能资源录入系统
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

  const state = { draft:null, meta:{}, warnings:[] };

  const stopWords = new Set("the a an and or of to in on for with from by is are ai tool app platform official online free pro com www https http www io co".split(/\s+/));
  const norm = s => text(s).toLowerCase().replace(/[\s_\-./:：，。！!？?（）()【】\[\],，]/g," ");
  const tokens = s => uniq(norm(s).split(/\s+/).filter(x=>x && x.length>1 && !stopWords.has(x)));

  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function makeId(name,url){
    const base=text(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"resource";
    return `${base}-${hash(text(url)||name).slice(0,6)}`;
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
      id,name:text(input.name),description:text(input.description)||text(input.title)||"",
      icon:"🔗",thumbnail:"",category:c.cat,subcategory:sub,website:text(input.url),github:"",
      features:[],capabilities:caps,scenarios:scs,attributes:attrs,official:false,recommend:false,status:"active",
      _meta:{categoryScore:c.score,warnings}
    };
  }

  async function fetchPage(url){
    const clean=text(url);if(!/^https?:\/\//i.test(clean))throw new Error("请输入有效网址");
    let html="";
    try{const r=await fetch(clean,{mode:"cors",redirect:"follow"});if(!r.ok)throw new Error("HTTP "+r.status);html=await r.text();}
    catch(e){
      const proxy="https://r.jina.ai/"+clean;
      const r=await fetch(proxy,{headers:{Accept:"text/plain"}});if(!r.ok)throw new Error("网页读取失败："+r.status);html=await r.text();
    }
    const doc=new DOMParser().parseFromString(html,"text/html");
    const get=(sel,attr)=>{const n=doc.querySelector(sel);return n?(attr?n.getAttribute(attr):n.textContent):""};
    const title=text(get("title"));
    const description=text(get('meta[name="description"]',"content")||get('meta[property="og:description"]',"content"));
    const keywords=text(get('meta[name="keywords"]',"content"));
    const og=text(get('meta[property="og:title"]',"content"));
    const body=text(doc.body?.innerText||"").slice(0,18000);
    return {title:title||og,description,keywords,content:body};
  }

  function renderChips(container,items,type){
    const allowed=vocab(type);
    container.innerHTML=allowed.map(v=>`<button type="button" class="chip ${items.includes(v)?"selected":""}" data-chip-type="${esc(type)}" data-chip-value="${esc(v)}">${esc(v)}</button>`).join("");
  }
  function renderCategoryOptions(sel,selected){
    const list=categoryList();
    sel.innerHTML=list.map(x=>`<option value="${esc(x.parent+"::"+x.child)}" ${x.child===selected?"selected":""}>${esc(x.parentName)} / ${esc(x.label)}</option>`).join("");
  }
  function selectedChips(type){return $$(`.chip[data-chip-type="${type}"].selected`).map(x=>x.dataset.chipValue);}

  function renderDraft(resource){
    state.draft=resource;
    const catSel=$("#categorySelect");
    renderCategoryOptions(catSel,resource.subcategory);
    $("#resourceName").value=resource.name;
    $("#resourceUrl").value=resource.website;
    $("#resourceDescription").value=resource.description;
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
    r.id=text($("#resourceId").value)||makeId($("#resourceName").value,$("#resourceUrl").value);
    r.name=text($("#resourceName").value);r.website=text($("#resourceUrl").value);r.description=text($("#resourceDescription").value);
    r.category=parent;r.subcategory=sub;
    r.capabilities=selectedChips("capabilities");r.scenarios=selectedChips("scenarios");
    r.attributes={pricing:selectedChips("pricing")[0]||"增值",platform:selectedChips("platform"),language:selectedChips("language"),audience:selectedChips("audience")};
    r.icon=r.icon||"🔗";r.thumbnail=r.thumbnail||"";r.github=r.github||"";r.features=r.features||[];r.official=!!r.official;r.recommend=!!r.recommend;r.status=r.status||"active";
    r._meta=r._meta||{};return r;
  }
  function renderWarnings(w){$("#warnings").innerHTML=w.length?w.map(x=>`<div class="warning">⚠️ ${esc(x)}</div>`).join(""):"<div class=\"success\">✓ 未发现结构性问题</div>";}
  function setStatus(msg,ok=false){const e=$("#status");e.textContent=msg;e.className=ok?"status ok":"status";}
  function saveDraft(){const r=readForm();const all=JSON.parse(localStorage.getItem(KEY)||"[]");const idx=all.findIndex(x=>x.id===r.id);const clean=cleanResource(r);if(idx>=0)all[idx]=clean;else all.unshift(clean);localStorage.setItem(KEY,JSON.stringify(all));setStatus(`草稿已保存，共 ${all.length} 条`,true);}
  function loadDrafts(){const all=JSON.parse(localStorage.getItem(KEY)||"[]");const sel=$("#draftSelect");sel.innerHTML=`<option value="">选择已保存草稿…</option>`+all.map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join("");}
  function exportJSON(){const r=cleanResource(readForm());download(`xph-resource-${r.id}.json`,JSON.stringify(r,null,2),"application/json");}
  function exportJS(){const r=cleanResource(readForm());const target=$("#exportTarget").value||"ai";const code=`/* XPH V5.2 Resource Importer Export */\nwindow.${target}Resources = window.${target}Resources || [];\nwindow.${target}Resources.push(${JSON.stringify(r,null,2)});\n`;download(`xph-resource-${r.id}.js`,code,"application/javascript");}
  function copyJSON(){const r=cleanResource(readForm());navigator.clipboard?.writeText(JSON.stringify(r,null,2)).then(()=>setStatus("JSON 已复制",true));}
  function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  async function init(){
    if(!$("#resourceImporter"))return;
    renderCategoryOptions($("#categorySelect"),"ai_chat");
    renderChips($("#capabilityChips"),[],"capabilities");renderChips($("#scenarioChips"),[],"scenarios");renderChips($("#pricingChips"),[],"pricing");renderChips($("#platformChips"),[],"platform");renderChips($("#languageChips"),[],"language");renderChips($("#audienceChips"),[],"audience");loadDrafts();

    $("#analyzeBtn").onclick=async()=>{
      const input={name:$("#resourceName").value,url:$("#resourceUrl").value,description:$("#resourceDescription").value};
      if(!input.name||!input.url){setStatus("请先填写名称和 URL");return;}
      setStatus("正在读取并分析…");
      let meta={};try{meta=await fetchPage(input.url);if(meta.title&&!input.name)input.name=meta.title;}catch(e){meta={};setStatus("网页读取失败，已使用名称/URL进行本地分析");}
      const r=analyze({...input,...meta});renderDraft(r);setStatus("分析完成，请人工审核后导出",true);
    };
    $("#fetchBtn").onclick=async()=>{const url=$("#resourceUrl").value;if(!url){setStatus("请先填写 URL");return;}setStatus("正在读取网页…");try{const m=await fetchPage(url);if(m.title&&!$("#resourceName").value)$("#resourceName").value=m.title;if(m.description)$("#resourceDescription").value=m.description;$("#pageMeta").textContent=`已读取：${m.title||"无标题"}`;setStatus("网页信息读取完成",true);}catch(e){setStatus(e.message||"网页读取失败");}};
    $("#resetBtn").onclick=()=>{state.draft=null;$("#reviewPanel").hidden=true;$("#resourceName").value="";$("#resourceUrl").value="";$("#resourceDescription").value="";setStatus("已清空");};
    $("#saveBtn").onclick=()=>{state.draft=readForm();saveDraft();loadDrafts();};
    $("#exportJsonBtn").onclick=exportJSON;$("#exportJsBtn").onclick=exportJS;$("#copyBtn").onclick=copyJSON;
    $("#loadDraftBtn").onclick=()=>{const id=$("#draftSelect").value;const all=JSON.parse(localStorage.getItem(KEY)||"[]");const r=all.find(x=>x.id===id);if(r)renderDraft(r);};
    $("#clearDraftsBtn").onclick=()=>{localStorage.removeItem(KEY);loadDrafts();setStatus("本机草稿已清空",true);};
    $(document).onchange?.();
    document.addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;b.classList.toggle("selected");const r=readForm();$("#jsonPreview").textContent=JSON.stringify(cleanResource(r),null,2);});
    $("#categorySelect").addEventListener("change",()=>{const [parent,sub]=$("#categorySelect").value.split("::");if(state.draft){state.draft.category=parent;state.draft.subcategory=sub;}});
    ["resourceName","resourceUrl","resourceDescription","resourceId"].forEach(id=>$("#"+id).addEventListener("input",()=>{if(state.draft){const r=readForm();$("#jsonPreview").textContent=JSON.stringify(cleanResource(r),null,2);}}));
  }
  document.addEventListener("DOMContentLoaded",init);
})();