/**
 * 徐胖虎资源社 App V5.3 FINAL
 * 资源筛选：场景 / 能力 / 价格；弹窗式、无数量标签。
 */
window.ResourceApp={
    version:"5.3",
    _timer:null,
    _bound:false,
    _modalOpen:false,
    _draft:{scenario:"all",capability:"all",pricing:"all"},

    init(){
        document.documentElement.dataset.xphVersion=this.version;
        const page=document.body.dataset.page;
        if(!page)return;
        if(page==="home"){window.ResourceHome?.init();return;}
        if(!window.ResourceStore||!window.ResourceRenderer||!window.ResourceEngine)return;
        ResourceStore.init(page);
        this.applyUrlState();
        this.injectStyles();
        this.renderFilterControl();
        this.bindEvents();
        this.render();
        this.exposeDiagnostics();
    },

    applyUrlState(){
        const p=new URLSearchParams(location.search);
        ResourceStore.setKeyword(p.get("q")||p.get("keyword")||"");
        // V5.3 前台不再使用分类/平台/语言/受众筛选；兼容旧 URL 时直接忽略这些条件。
        ResourceStore.setCategory("all");
        ResourceStore.setSubCategory("all");
        ResourceStore.setCapability(p.get("capability")||"all");
        ResourceStore.setScenario(p.get("scenario")||"all");
        ResourceStore.setPricing(p.get("pricing")||"all");
        ResourceStore.setPlatform("all");
        ResourceStore.setLanguage("all");
        ResourceStore.setAudience("all");
        ResourceStore.setPage(p.get("page")||1);
        this._draft={scenario:ResourceStore.getState().scenario,capability:ResourceStore.getState().capability,pricing:ResourceStore.getState().pricing};
    },

    updateUrl(){
        const s=ResourceStore.getState(),p=new URLSearchParams();
        if(s.keyword)p.set("q",s.keyword);
        if(s.capability!=="all")p.set("capability",s.capability);
        if(s.scenario!=="all")p.set("scenario",s.scenario);
        if(s.pricing!=="all")p.set("pricing",s.pricing);
        if(s.page>1)p.set("page",s.page);
        history.replaceState(null,"",location.pathname+(p.toString()?`?${p}`:""));
    },

    render(){
        ResourceRenderer.render({container:"#resource-list",data:ResourceStore.getData()});
        this.syncFilterButton();
    },

    renderFilterControl(){
        const mount=document.querySelector(".categories[data-v531-filter-mount], [data-v531-filter-mount]");
        if(!mount)return;
        if(mount.querySelector("[data-v533-filter]"))return;
        mount.innerHTML=`
            <div class="v533-toolbar" data-v533-filter>
                <button type="button" class="v533-filter-button" data-open-filter aria-expanded="false">筛选 <span aria-hidden="true">⌄</span></button>
            </div>
            <div class="v533-modal" data-filter-modal hidden aria-hidden="true">
                <div class="v533-backdrop" data-close-filter></div>
                <section class="v533-dialog" role="dialog" aria-modal="true" aria-labelledby="v533-filter-title">
                    <div class="v533-dialog-head">
                        <h2 id="v533-filter-title">筛选</h2>
                        <button type="button" class="v533-close" data-close-filter aria-label="关闭">×</button>
                    </div>
                    <div class="v533-dialog-body">
                        <section class="v533-filter-group"><h3>场景</h3><div class="v533-options" data-filter-options="scenario"></div></section>
                        <section class="v533-filter-group"><h3>能力</h3><div class="v533-options" data-filter-options="capability"></div></section>
                        <section class="v533-filter-group"><h3>价格</h3><div class="v533-options" data-filter-options="pricing"></div></section>
                    </div>
                    <div class="v533-dialog-foot">
                        <button type="button" class="v533-reset" data-reset-filter>重置</button>
                        <button type="button" class="v533-apply" data-apply-filter>确定</button>
                    </div>
                </section>
            </div>`;
        this.populateFilterOptions();
        this.syncFilterButton();
    },

    openFilter(){
        const modal=document.querySelector("[data-filter-modal]");if(!modal)return;
        const s=ResourceStore.getState();
        this._draft={scenario:s.scenario,capability:s.capability,pricing:s.pricing};
        this.populateFilterOptions();
        modal.hidden=false;modal.setAttribute("aria-hidden","false");
        document.body.classList.add("v533-modal-open");
        document.querySelector("[data-open-filter]")?.setAttribute("aria-expanded","true");
        this._modalOpen=true;
    },

    closeFilter(){
        const modal=document.querySelector("[data-filter-modal]");if(!modal)return;
        modal.hidden=true;modal.setAttribute("aria-hidden","true");
        document.body.classList.remove("v533-modal-open");
        document.querySelector("[data-open-filter]")?.setAttribute("aria-expanded","false");
        this._modalOpen=false;
    },

    applyFilter(){
        ResourceStore.setScenario(this._draft.scenario||"all");
        ResourceStore.setCapability(this._draft.capability||"all");
        ResourceStore.setPricing(this._draft.pricing||"all");
        ResourceStore.setPage(1);
        this.updateUrl();
        this.closeFilter();
        this.render();
    },

    resetFilter(){
        this._draft={scenario:"all",capability:"all",pricing:"all"};
        this.populateFilterOptions();
    },

    syncFilterButton(){
        const s=ResourceStore.getState(),button=document.querySelector("[data-open-filter]");
        if(!button)return;
        const active=[s.scenario!="all",s.capability!="all",s.pricing!="all"].filter(Boolean).length;
        button.innerHTML=active?`筛选 <span class="v533-filter-count">${active}</span> <span aria-hidden="true">⌄</span>`:`筛选 <span aria-hidden="true">⌄</span>`;
    },

    canonicalLabel(key,value){
        if(key!=="pricing")return String(value||"");
        const raw=String(value||"").trim().toLowerCase();
        if(raw==="freemium"||raw==="免费+付费"||raw==="增值")return "增值";
        if(raw==="paid"||raw==="付费")return "付费";
        if(raw==="free"||raw==="免费")return "免费";
        return String(value||"");
    },

    sortLabels(values){
        return [...new Set(values.map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>{
            const len=a.length-b.length;
            return len||a.localeCompare(b,"zh-CN");
        });
    },

    facetValues(key){
        const state=ResourceStore.getState();
        const filterState={...state,data:ResourceStore.resources};
        if(key==="scenario")filterState.scenario="all";
        if(key==="capability")filterState.capability="all";
        if(key==="pricing")filterState.pricing="all";
        const data=ResourceEngine.filter(filterState);
        const values=[];
        data.forEach(item=>{
            if(key==="scenario")values.push(...ResourceEngine.scenarioValues(item));
            if(key==="capability")values.push(...ResourceEngine.capabilityValues(item));
            if(key==="pricing")values.push(...ResourceEngine.pricingValues(item));
        });
        return this.sortLabels(values);
    },

    populateFilterOptions(){
        ["scenario","capability","pricing"].forEach(key=>{
            const el=document.querySelector(`[data-filter-options="${key}"]`);if(!el)return;
            const current=this._draft[key]||"all";
            const labels=this.facetValues(key);
            const options=["all",...labels];
            el.innerHTML=options.map(value=>{
                const label=value==="all"?"不限":value;
                const selected=(value==="all"?current==="all":this.canonicalLabel(key,current)===this.canonicalLabel(key,value));
                return `<button type="button" class="v533-option${selected?" active":""}" data-draft-filter="${key}" data-value="${ResourceTemplates.escape(value)}" aria-pressed="${selected}">${ResourceTemplates.escape(label)}</button>`;
            }).join("");
        });
    },

    bindEvents(){
        if(this._bound)return;this._bound=true;
        const input=document.getElementById("searchInput");
        if(input){input.addEventListener("input",()=>{clearTimeout(this._timer);this._timer=setTimeout(()=>{ResourceStore.setKeyword(input.value);ResourceStore.setPage(1);this.updateUrl();this.render();},180);});}
        document.addEventListener("click",e=>{
            const open=e.target.closest("[data-open-filter]"),close=e.target.closest("[data-close-filter]"),reset=e.target.closest("[data-reset-filter]"),apply=e.target.closest("[data-apply-filter]"),draft=e.target.closest("[data-draft-filter]"),page=e.target.closest("[data-page]");
            if(open){this.openFilter();return;}
            if(close){this.closeFilter();return;}
            if(reset){this.resetFilter();return;}
            if(apply){this.applyFilter();return;}
            if(draft){const key=draft.dataset.draftFilter,value=draft.dataset.value||"all";this._draft[key]=value;this.populateFilterOptions();return;}
            if(page){ResourceStore.setPage(page.dataset.page);this.updateUrl();this.render();window.scrollTo({top:0,behavior:"smooth"});return;}
        });
        document.addEventListener("keydown",e=>{
            if(e.key==="Escape"&&this._modalOpen){this.closeFilter();return;}
            if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement?.tagName||"")){e.preventDefault();document.getElementById("searchInput")?.focus();}
        });
    },

    injectStyles(){
        if(document.getElementById("xph-v533-style"))return;
        const s=document.createElement("style");s.id="xph-v533-style";
        s.textContent=`
        .categories[data-v531-filter-mount]{display:block;margin:0 0 30px;padding:0;overflow:visible}
        .v533-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:12px}
        .v533-filter-button{border:0;border-radius:16px;background:#fff;color:#333;padding:11px 16px;font-size:14px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.05)}
        .v533-filter-button:active{transform:translateY(1px)}
        .v533-filter-count{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:9px;background:#3478f6;color:#fff;font-size:11px;margin-left:4px;padding:0 5px}
        .v533-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center}
        .v533-modal[hidden]{display:none}
        .v533-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.28);backdrop-filter:blur(2px)}
        .v533-dialog{position:relative;width:min(720px,100%);max-height:min(78vh,720px);background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.14);display:flex;flex-direction:column;overflow:hidden}
        .v533-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 14px;border-bottom:1px solid #f0f0f0}
        .v533-dialog-head h2{margin:0;font-size:18px}
        .v533-close{border:0;background:#f5f5f7;width:32px;height:32px;border-radius:50%;font-size:22px;line-height:1;color:#666;cursor:pointer}
        .v533-dialog-body{overflow:auto;padding:6px 20px 18px}
        .v533-filter-group{padding:16px 0;border-bottom:1px solid #f2f2f2}
        .v533-filter-group:last-child{border-bottom:0}
        .v533-filter-group h3{margin:0 0 12px;font-size:14px;color:#222}
        .v533-options{display:flex;flex-wrap:wrap;gap:8px}
        .v533-option{border:1px solid #e8e8eb;background:#fff;color:#555;border-radius:12px;padding:8px 12px;font-size:13px;cursor:pointer}
        .v533-option.active{border-color:#3478f6;background:#3478f6;color:#fff}
        .v533-dialog-foot{display:flex;gap:10px;padding:14px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid #f0f0f0;background:#fff}
        .v533-reset,.v533-apply{height:44px;border:0;border-radius:14px;font-size:14px;cursor:pointer}
        .v533-reset{flex:1;background:#f5f5f7;color:#555}.v533-apply{flex:2;background:#3478f6;color:#fff}
        body.v533-modal-open{overflow:hidden}
        @media(min-width:700px){.v533-modal{align-items:center;padding:24px}.v533-dialog{border-radius:24px;max-height:80vh}.v533-dialog-foot{padding-bottom:14px}}
        @media(max-width:430px){.v533-toolbar{align-items:center}.v533-filter-button{padding:10px 15px}.v533-dialog{max-height:82vh}.v533-option{padding:8px 11px}}
        `;
        document.head.appendChild(s);
    },

    exposeDiagnostics(){
        window.XPH_V533={version:this.version,validate:()=>ResourceEngine.validate(ResourceEngine.getAllResources()),state:()=>ResourceStore.getState(),resources:()=>ResourceEngine.getAllResources().length};
        window.XPH_V51=window.XPH_V533;window.XPH_V5=window.XPH_V533;
    }
};
document.addEventListener("DOMContentLoaded",()=>ResourceApp.init());