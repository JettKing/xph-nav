/** 徐胖虎资源社 Renderer V5.3 FINAL：渲染资源、统计、分页与状态。 */
window.ResourceRenderer = {
    normalizeItem(item){return {...(item||{}),capabilities:Array.isArray(item?.capabilities)?item.capabilities:[],scenarios:Array.isArray(item?.scenarios)?item.scenarios:[],attributes:item?.attributes&&typeof item.attributes==="object"?item.attributes:{}};},
    normalizeData(data){return Array.isArray(data)?data.map(this.normalizeItem):[];},
    render({container="#resource-list",data=[]}={}){
        const el=document.querySelector(container); if(!el)return;
        const normalized=this.normalizeData(data); el.innerHTML=normalized.length?normalized.map(ResourceTemplates.card.bind(ResourceTemplates)).join(""):ResourceTemplates.empty("没有找到符合条件的资源");
        this.updateCount(ResourceStore.resources.length);
        this.renderPagination(); this.refresh();
    },
    updateCount(count){const el=document.getElementById("resourceCount");if(el)el.textContent=`${Number(count)||0} 个资源`;},
    renderPagination(){
        let wrap=document.querySelector("[data-pagination]");
        if(!wrap){wrap=document.createElement("div");wrap.dataset.pagination="true";wrap.className="v5-pagination";document.querySelector("#resource-list")?.insertAdjacentElement("afterend",wrap);}
        const pages=ResourceStore.getPageCount(), current=ResourceStore.getState().page;
        if(pages<=1){wrap.innerHTML="";return;}
        const buttons=[];for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-current)<=1)buttons.push(`<button type="button" class="category-btn ${i===current?"active":""}" data-page="${i}">${i}</button>`);else if(buttons[buttons.length-1]!=="…")buttons.push("…");}
        wrap.innerHTML=`<button type="button" class="category-btn" data-page="${Math.max(1,current-1)}" ${current===1?"disabled":""}>上一页</button>${buttons.map(v=>v==="…"?`<span class="v5-page-gap">…</span>`:v).join("")}<button type="button" class="category-btn" data-page="${Math.min(pages,current+1)}" ${current===pages?"disabled":""}>下一页</button>`;
    },
    refresh(){window.ResourceAppRefresh?.();},
    loading(container="#resource-list"){const el=document.querySelector(container);if(el)el.innerHTML=ResourceTemplates.loading();},
    empty(container="#resource-list",message="暂无资源"){const el=document.querySelector(container);if(el)el.innerHTML=ResourceTemplates.empty(message);this.updateCount(0);},
    clear(container){if(container)container.innerHTML="";},
    append(){console.warn("V5 Renderer: append 已由分页渲染替代");}
};