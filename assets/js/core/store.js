/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Store v2.1
 * ----------------------------------------------------------
 * 页面状态管理
 * 不负责 DOM
 * 不负责渲染
 * ==========================================================
 */

window.ResourceStore = {

    page: "",

    resources: [],

    keyword: "",

    category: "all",

    sort: "recommend",


    init(page) {

        this.page = page || "";

        if (
            window.ResourceEngine &&
            typeof ResourceEngine.getPageResources === "function"
        ) {

            this.resources =
                ResourceEngine.getPageResources(this.page);

        } else {

            this.resources = [];

            console.warn(
                "ResourceEngine 未加载，无法获取资源"
            );

        }

    },


    setKeyword(keyword) {

        this.keyword =
            keyword || "";

    },


    setCategory(category) {

        this.category =
            category || "all";

    },


    setSort(sort) {

        this.sort =
            sort || "recommend";

    },


    getData() {

        let data = [
            ...this.resources
        ];


        // V2.1统一过滤入口
        if (
            window.ResourceEngine &&
            typeof ResourceEngine.filter === "function"
        ) {

            data =
                ResourceEngine.filter({

                    data,

                    keyword: this.keyword,

                    category: this.category

                });

        }


        // 保留排序扩展接口
        if (
            this.sort &&
            this.sort !== "recommend"
        ) {

            // 当前版本暂无排序逻辑
            // 后续统一由 Engine 扩展

        }


        return data;

    },


    reset() {

        this.keyword = "";

        this.category = "all";

        this.sort = "recommend";

    }


};