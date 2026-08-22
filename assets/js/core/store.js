/** XPH Resource Store V5.3: strict Contract data, filter state and pagination. */
window.ResourceStore={
 version:'5.3',page:'',resources:[],state:{keyword:'',capability:'all',scenario:'all',pricing:'all',page:1,pageSize:20},
 init(page){this.page=page||'';this.refresh();this.reset();const result=ResourceEngine.validate(this.resources);if(!result.valid)throw new Error(`资源 Contract 校验失败：${result.errors.join('；')}`);},
 refresh(){this.resources=window.ResourceEngine?.getPageResources(this.page)||[];},
 reset(){this.state={keyword:'',capability:'all',scenario:'all',pricing:'all',page:1,pageSize:20};},
 setKeyword(v){this.state.keyword=String(v||'').trim();this.state.page=1;},
 setCapability(v){const value=String(v||'all').trim();if(value!=='all'&&!(window.tags?.capabilities||[]).includes(value))throw new Error(`非法能力筛选：${value}`);this.state.capability=value;this.state.page=1;},
 setScenario(v){const value=String(v||'all').trim();if(value!=='all'&&!(window.tags?.scenarios||[]).includes(value))throw new Error(`非法场景筛选：${value}`);this.state.scenario=value;this.state.page=1;},
 setPricing(v){const value=String(v||'all').trim();if(value!=='all' && !(window.tags?.attributes?.pricing||[]).includes(value))throw new Error(`非法价格筛选：${value}`);this.state.pricing=value;this.state.page=1;},
 setPage(v){const max=this.getPageCount();this.state.page=Math.min(Math.max(Number(v)||1,1),Math.max(max,1));},
 setPageSize(v){this.state.pageSize=Math.max(1,Math.min(100,Number(v)||20));this.state.page=1;},
 getState(){return {...this.state};},
 getFilteredData(){return ResourceEngine.filter({...this.state,data:this.resources});},
 getData(){const d=this.getFilteredData(),start=(this.state.page-1)*this.state.pageSize;return d.slice(start,start+this.state.pageSize);},
 getFilteredCount(){return this.getFilteredData().length;},
 getPageCount(){return Math.ceil(this.getFilteredCount()/this.state.pageSize)||1;},
 getCount(){return this.getFilteredCount();},
 getFacets(){return ResourceEngine.facets(this.getFilteredData());}
};