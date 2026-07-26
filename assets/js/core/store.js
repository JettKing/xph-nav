/**
 * ==========================================================
 * Store v2.2
 * ----------------------------------------------------------
 * 页面状态管理
 * 不负责 DOM
 * 不负责渲染
 * ==========================================================
 */

window.ResourceStore = {

    page: "",

    resources: [],

    state: {

        keyword: "",

        category: "all",

        subcategory: "all",

        tag: "all",

        sort: "recommend"

    },

    init(page) {

        this.page = page || "";

        if (
            window.ResourceEngine &&
            typeof ResourceEngine.getPageResources === "function"
        ) {

            this.resources = ResourceEngine.getPageResources(this.page);

        } else {

            this.resources = [];

            console.warn("ResourceEngine 未加载，无法获取资源");

        }

        this.reset();

    },

    setKeyword(keyword) {

        this.state.keyword = keyword || "";

    },

    setCategory(category) {

        this.state.category = category || "all";

    },

    setSubCategory(subcategory) {

        this.state.subcategory = subcategory || "all";

    },

    setTag(tag) {

        this.state.tag = tag || "all";

    },

    setSort(sort) {

        this.state.sort = sort || "recommend";

    },

    getState() {

        return { ...this.state };

    },

    getData() {

        let data = Array.isArray(this.resources)

            ? [...this.resources]

            : [];

        if (
            window.ResourceEngine &&
            typeof ResourceEngine.filter === "function"
        ) {

            data = ResourceEngine.filter({

                data,

                keyword: this.state.keyword,

                category: this.state.category,

                subcategory: this.state.subcategory

            });

        }

        if (
            this.state.tag !== "all"
        ) {

            data = data.filter(item => {

                if (item.tag === this.state.tag) return true;

                if (
                    Array.isArray(item.tags) &&
                    item.tags.includes(this.state.tag)
                ) {

                    return true;

                }

                return false;

            });

        }

        if (
            this.state.sort &&
            this.state.sort !== "recommend"
        ) {

            switch (this.state.sort) {

                case "name":

                    data.sort((a, b) =>
                        (a.name || "").localeCompare(b.name || "")
                    );

                    break;

                case "score":

                    data.sort((a, b) =>
                        (b.score || 0) - (a.score || 0)
                    );

                    break;

                default:

                    break;

            }

        }

        return data;

    },

    reset() {

        this.state = {

            keyword: "",

            category: "all",

            subcategory: "all",

            tag: "all",

            sort: "recommend"

        };

    }

};