/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * App v3.0
 * ----------------------------------------------------------
 * 职责：
 * 1. 页面初始化
 * 2. 判断页面类型
 * 3. 调用首页模块
 * 4. 调用资源页模块
 * 5. 绑定资源页事件
 * ==========================================================
 */

window.ResourceApp = {

    init() {

        const page = document.body.dataset.page;

        if (!page) {

            console.warn("未检测到 data-page");
            return;

        }

        /* ==========================
           首页
        ========================== */

        if (page === "home") {

            if (window.ResourceHome) {

                ResourceHome.init();

            } else {

                console.warn("ResourceHome 未加载");

            }

            return;

        }

        /* ==========================
           资源页
        ========================== */

        if (!window.ResourceStore) {

            console.warn("ResourceStore 未加载");
            return;

        }

        if (!window.ResourceRenderer) {

            console.warn("ResourceRenderer 未加载");
            return;

        }

        ResourceStore.init(page);

        this.render();

        this.bindEvents();

    },

    render() {

        ResourceRenderer.render({

            container: "#resource-list",

            data: ResourceStore.getData()

        });

    },

    bindEvents() {

        /* ==========================
           搜索
        ========================== */

        const searchInput = document.getElementById("searchInput");

        if (searchInput && !searchInput.dataset.bound) {

            searchInput.dataset.bound = "true";

            searchInput.addEventListener("input", function () {

                ResourceStore.setKeyword(this.value);

                ResourceApp.render();

            });

        }

        /* ==========================
           分类
        ========================== */

        const categoryButtons = document.querySelectorAll("[data-category]");

        categoryButtons.forEach(button => {

            if (button.dataset.bound) return;

            button.dataset.bound = "true";

            button.addEventListener("click", function () {

                categoryButtons.forEach(btn => {

                    btn.classList.remove("active");

                });

                this.classList.add("active");

                ResourceStore.setCategory(this.dataset.category);

                ResourceApp.render();

            });

        });

    }

};

/* ==========================================================
   页面加载
========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    ResourceApp.init();

});