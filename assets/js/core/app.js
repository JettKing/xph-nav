/**
 * ==========================================================
 * App v2.2
 * ----------------------------------------------------------
 * 页面生命周期
 * 事件绑定
 * 搜索
 * 分类
 * 渲染刷新
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

        if (!window.ResourceRenderer) {

            console.warn("ResourceRenderer 未加载");

            return;

        }

        ResourceStore.init(page);

        window.ResourceAppRefresh = () => this.refresh();

        this.render();

        this.bindEvents();

    },

    render() {

        const page = document.body.dataset.page;

        const container =

            page === "home"

                ? "#home-resource-list"

                : "#resource-list";

        ResourceRenderer.render({

            container,

            data: ResourceStore.getData()

        });

    },

    refresh() {

        const count = document.getElementById("resourceCount");

        const empty = document.getElementById("empty");

        const list = document.querySelectorAll(".tool-card");

        if (count) {

            count.textContent = list.length + " 个资源";

        }

        if (empty) {

            empty.style.display =

                list.length === 0

                    ? "block"

                    : "none";

        }

    },

    bindEvents() {

        const searchInput = document.getElementById("searchInput");

        if (searchInput && !searchInput.dataset.bound) {

            searchInput.dataset.bound = "true";

            searchInput.addEventListener("input", function () {

                ResourceStore.setKeyword(this.value);

                ResourceApp.render();

            });

        }

        document.querySelectorAll("[data-category]").forEach(button => {

            if (button.dataset.bound) return;

            button.dataset.bound = "true";

            button.addEventListener("click", function () {

                document
                    .querySelectorAll("[data-category]")
                    .forEach(btn => btn.classList.remove("active"));

                this.classList.add("active");

                ResourceStore.setCategory(
                    this.dataset.category || "all"
                );

                ResourceApp.render();

            });

        });

        document.querySelectorAll("[data-subcategory]").forEach(button => {

            if (button.dataset.bound) return;

            button.dataset.bound = "true";

            button.addEventListener("click", function () {

                ResourceStore.setSubCategory(
                    this.dataset.subcategory || "all"
                );

                ResourceApp.render();

            });

        });

        document.querySelectorAll("[data-tag]").forEach(button => {

            if (button.dataset.bound) return;

            button.dataset.bound = "true";

            button.addEventListener("click", function () {

                ResourceStore.setTag(
                    this.dataset.tag || "all"
                );

                ResourceApp.render();

            });

        });

    }

};