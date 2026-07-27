/**
 * ==========================================================
 * Store v3.0
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

        this.refresh();

        this.reset();

    },

    refresh() {

        if (
            window.ResourceEngine &&
            typeof ResourceEngine.getPageResources === "function"
        ) {

            const data = ResourceEngine.getPageResources(this.page);

            this.resources = Array.isArray(data)
                ? data
                : [];

        } else {

            this.resources = [];

            console.warn("ResourceEngine 未加载，无法获取资源");

        }

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

        return {

            ...this.state

        };

    },

    getData() {

        let data = [...this.resources];

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

        if (this.state.tag !== "all") {

            data = data.filter(item =>

                item.tag === this.state.tag ||

                (Array.isArray(item.tags) &&
                    item.tags.includes(this.state.tag))

            );

        }

        switch (this.state.sort) {

            case "name":

                data.sort((a, b) =>

                    (a.name || "")
                        .localeCompare(b.name || "")

                );

                break;

            case "score":

                data.sort((a, b) =>

                    (b.score || 0) -
                    (a.score || 0)

                );

                break;

        }

        return data;

    },

    getCount() {

        return this.getData().length;

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