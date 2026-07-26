/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * App v2.1
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

        // 全局刷新接口仅注册一次
        window.ResourceAppRefresh = () => this.refresh();

        this.render();

        this.bindEvents();

    },

    render() {

        const page = document.body.dataset.page;

        // 首页与资源页使用统一规则自动选择容器
        const container =
            page === "home"
                ? "#home-resource-list"
                : "#resource-list";

        ResourceRenderer.render({

            container,
            data: ResourceStore.getData()

        });

        this.refresh();

    },

    refresh() {

        const count =
            document.getElementById("resourceCount");

        const empty =
            document.getElementById("empty");

        const list =
            document.querySelectorAll(".tool-card");

        if (count) {

            count.textContent =
                list.length + " 个资源";

        }

        if (empty) {

            empty.style.display =
                list.length === 0
                    ? "block"
                    : "none";

        }

    },

    bindEvents() {

        const searchInput =
            document.getElementById("searchInput");

        if (searchInput && !searchInput.dataset.bound) {

            searchInput.dataset.bound = "true";

            searchInput.addEventListener(
                "input",
                function () {

                    ResourceStore.setKeyword(
                        this.value
                    );

                    ResourceApp.render();

                }
            );

        }

        const categoryButtons =
            document.querySelectorAll(".category-btn");

        categoryButtons.forEach(button => {

            if (button.dataset.bound) {
                return;
            }

            button.dataset.bound = "true";

            button.addEventListener(
                "click",
                function () {

                    categoryButtons.forEach(btn => {

                        btn.classList.remove(
                            "active"
                        );

                    });

                    this.classList.add(
                        "active"
                    );

                    ResourceStore.setCategory(
                        this.dataset.category
                    );

                    ResourceApp.render();

                }
            );

        });

    }

};

document.addEventListener(
    "DOMContentLoaded",
    () => {

        ResourceApp.init();

    }
);