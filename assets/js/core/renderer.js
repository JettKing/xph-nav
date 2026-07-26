/**
 * ==========================================================
 * Renderer v2.2
 * ----------------------------------------------------------
 * Renderer 统一渲染中心
 * ==========================================================
 */

window.ResourceRenderer = {

    render({

        container = "#resource-list",

        data = []

    } = {}) {

        const element = document.querySelector(container);

        if (!element) {

            console.warn("找不到容器：" + container);

            return;

        }

        this.clear(element);

        const list = Array.isArray(data)

            ? data

            : [];

        if (list.length === 0) {

            element.innerHTML = ResourceTemplates.empty();

            this.refresh();

            return;

        }

        element.innerHTML = list

            .map(item => ResourceTemplates.card(item))

            .join("");

        this.refresh();

    },

    loading(container = "#resource-list") {

        const element = document.querySelector(container);

        if (!element) return;

        element.innerHTML = ResourceTemplates.loading();

    },

    skeleton(container = "#resource-list", count = 6) {

        const element = document.querySelector(container);

        if (!element) return;

        element.innerHTML = ResourceTemplates.skeleton(count);

    },

    append({

        container = "#resource-list",

        data = []

    } = {}) {

        const element = document.querySelector(container);

        if (!element) return;

        if (!Array.isArray(data)) return;

        element.insertAdjacentHTML(

            "beforeend",

            data

                .map(item => ResourceTemplates.card(item))

                .join("")

        );

        this.refresh();

    },

    replace({

        container = "#resource-list",

        html = ""

    } = {}) {

        const element = document.querySelector(container);

        if (!element) return;

        element.innerHTML = html;

        this.refresh();

    },

    clear(container) {

        if (!container) return;

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