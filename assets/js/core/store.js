/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Store v2.0
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

        this.page = page;

        this.resources = ResourceEngine.getPageResources(page);

    },

    setKeyword(keyword) {

        this.keyword = keyword || "";

    },

    setCategory(category) {

        this.category = category || "all";

    },

    setSort(sort) {

        this.sort = sort || "recommend";

    },

    getData() {

        let data = [...this.resources];

        // Search
        if (
            window.ResourceSearch &&
            typeof ResourceSearch.search === "function"
        ) {
            data = ResourceSearch.search(
                data,
                this.keyword
            );
        }

        // Filter
        if (
            window.ResourceFilter &&
            typeof ResourceFilter.byCategory === "function"
        ) {
            data = ResourceFilter.byCategory(
                data,
                this.category
            );
        }

        return data;

    },

    reset() {

        this.keyword = "";

        this.category = "all";

        this.sort = "recommend";

    }

};