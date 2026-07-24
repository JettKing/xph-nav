/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * App v2.0
 * ----------------------------------------------------------
 * 页面生命周期
 * 事件绑定
 * 调用 Store / Renderer
 * ==========================================================
 */

window.ResourceApp = {

    init() {

        const page = document.body.dataset.page;

        if (!page) {
            console.warn("未设置 data-page");
            return;
        }

        if (!window.ResourceStore) {
            console.warn("ResourceStore 未加载");
            return;
        }

        ResourceStore.init(page);

        this.render();

        this.bindEvents();

    },

    render() {

        ResourceRenderer.renderResources(
            ResourceStore.getData(),
            "resource-list"
        );

    },

    bindEvents() {

        // 下一步 Commit 接入搜索、分类等事件
    }

};

document.addEventListener("DOMContentLoaded", () => {

    ResourceApp.init();

});