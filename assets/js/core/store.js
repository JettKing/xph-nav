/**
 * ==========================================================
 * Store v3.1
 * ----------------------------------------------------------
 * 页面状态管理
 * 不负责 DOM
 * 不负责渲染
 *
 * V3.1:
 * 增加 capability 能力筛选支持
 * 保留 tag 兼容
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

        capability: "all",

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

            console.warn(
                "ResourceEngine 未加载，无法获取资源"
            );

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


    setCapability(capability) {

        this.state.capability = capability || "all";

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



        /**
         * 标签筛选
         * 兼容：
         * tag
         * tags
         */

        if (this.state.tag !== "all") {

            data = data.filter(item =>

                item.tag === this.state.tag ||

                (
                    Array.isArray(item.tags) &&
                    item.tags.includes(this.state.tag)
                )

            );

        }



        /**
         * 能力筛选 V3.1
         * 兼容：
         * capability
         * capabilities
         */

        if (this.state.capability !== "all") {

            data = data.filter(item =>


                item.capability === this.state.capability ||


                (
                    Array.isArray(item.capabilities) &&
                    item.capabilities.includes(
                        this.state.capability
                    )
                )


            );

        }



        switch (this.state.sort) {


            case "name":


                data.sort((a, b) =>

                    (a.name || "")
                        .localeCompare(
                            b.name || ""
                        )

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


            capability: "all",


            sort: "recommend"


        };

    }


};