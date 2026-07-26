/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v2.3
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * 4. 通知交互层刷新
 * 5. 提供统一刷新接口
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

        const list = Array.isArray(data)
            ? data
            : [];

        if (list.length === 0) {

            element.innerHTML =
                ResourceTemplates.empty();

            this.refresh();

            return;

        }

        element.innerHTML = list
            .map(item =>
                ResourceTemplates.card(item)
            )
            .join("");

        this.refresh();

    },

    append({
        container = "#resource-list",
        data = []
    } = {}) {

        const element = document.querySelector(container);

        if (!element) {

            console.warn(`找不到容器：${container}`);

            return;

        }

        const list = Array.isArray(data)
            ? data
            : [];

        if (!list.length) {

            return;

        }

        element.insertAdjacentHTML(

            "beforeend",

            list
                .map(item =>
                    ResourceTemplates.card(item)
                )
                .join("")

        );

        this.refresh();

    },

    loading(container = "#resource-list") {

        const element = document.querySelector(container);

        if (!element) {

            return;

        }

        element.innerHTML =
            ResourceTemplates.loading();

    },

    empty(
        container = "#resource-list",
        message = "暂无资源"
    ) {

        const element = document.querySelector(container);

        if (!element) {

            return;

        }

        element.innerHTML =
            ResourceTemplates.empty(message);

        this.refresh();

    },

    clear(container) {

        if (!container) {

            return;

        }

        container.innerHTML = "";

    },

    refresh() {

        if (

            typeof window.ResourceAppRefresh ===

            "function"

        ) {

            window.ResourceAppRefresh();

        }

    }

};