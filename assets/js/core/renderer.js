/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v2.0
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * ==========================================================
 */

window.ResourceRenderer = {

    /**
     * 渲染资源
     * @param {Object} options
     * @param {String} options.container
     * @param {Array} options.data
     */
    render({
        container = "#resource-list",
        data = []
    } = {}) {

        const element = document.querySelector(container);

        if (!element) {
            console.warn(`找不到容器：${container}`);
            return;
        }

        this.clear(element);

        if (!data.length) {
            element.innerHTML = ResourceTemplates.empty();
            return;
        }

        element.innerHTML = data
            .map(ResourceTemplates.card)
            .join("");

    },

    /**
     * 清空容器
     * @param {HTMLElement} element
     */
    clear(element) {

        element.innerHTML = "";

    }

};