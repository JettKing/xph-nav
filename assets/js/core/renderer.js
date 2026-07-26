/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v2.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * 4. 通知交互层刷新
 * ==========================================================
 */

window.ResourceRenderer = {

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

            if (typeof window.ResourceAppRefresh === "function") {
                window.ResourceAppRefresh();
            }

            return;
        }


        element.innerHTML = data
            .map(item => ResourceTemplates.card(item))
            .join("");


        // ⭐ 动态渲染完成后通知交互层
        if (typeof window.ResourceAppRefresh === "function") {
            window.ResourceAppRefresh();
        }

    },


    clear(container) {

        container.innerHTML = "";

    }

};