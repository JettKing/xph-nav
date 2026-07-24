/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v1.0
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * ==========================================================
 */

window.ResourceRenderer = {

    /**
     * 渲染资源列表
     * @param {Array} resources
     * @param {String} containerId
     */
    renderResources(resources = [], containerId = "resource-list") {

        const container = document.getElementById(containerId);

        if (!container) {
            console.warn(`找不到容器：#${containerId}`);
            return;
        }

        this.clear(container);

        if (!resources.length) {
            container.innerHTML = ResourceTemplates.empty();
            return;
        }

        const html = resources
            .map(resource => ResourceTemplates.card(resource))
            .join("");

        container.innerHTML = html;

    },

    /**
     * 清空容器
     */
    clear(container) {

        container.innerHTML = "";

    }

};