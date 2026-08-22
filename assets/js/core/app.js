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
        this.renderFilterControl();
        this.bindEvents();
        this.render();
        this.exposeDiagnostics();
    },

    applyUrlState(){
        const p=new URLSearchParams(location.search);
        ResourceStore.setKeyword(p.get("q")||"");
        // V5.3 前台不再使用分类/平台/语言/受众筛选；兼容旧 URL 时直接忽略这些条件。
        ResourceStore.setCapability(p.get("capability")||"all");
        ResourceStore.setScenario(p.get("scenario")||"all");
        ResourceStore.setPricing(p.get("pricing")||"all");
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
                const selected=(value==="all"?current==="all":current===value);
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

    exposeDiagnostics(){
        window.XPH_V533={version:this.version,validate:()=>ResourceEngine.validate(ResourceEngine.getAllResources()),state:()=>ResourceStore.getState(),resources:()=>ResourceEngine.getAllResources().length};
    }
};
document.addEventListener("DOMContentLoaded",()=>ResourceApp.init());