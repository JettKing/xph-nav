/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v2.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 提供页面资源
 * 2. 提供全部资源
 * 3. 提供分类资源
 * 4. 提供搜索过滤
 * 5. 提供统一查询
 * 6. 不负责 DOM
 * 7. 不负责渲染
 * ==========================================================
 */

window.ResourceEngine = {

    pages: {

        home: () => this.getAllResources(),

        ai: () => window.aiResources || [],

        software: () => window.softwareResources || [],

        productivity: () => window.productivityResources || [],

        website: () => window.websiteResources || [],

        digital: () => window.digitalResources || [],

        solution: () => window.solutionResources || []

    },


    getPageResources(page) {

        if (!page) return [];

        if (page === "home") {

            return this.getAllResources();

        }


        const getter = this.pages[page];

        return typeof getter === "function"
            ? getter()
            : [];

    },


    getAllResources() {

        return Object.values(this.pages)
            .filter(getter => typeof getter === "function")
            .flatMap(getter => getter());

    },


    getCategory(category) {

        if (!category || category === "all") {

            return this.getAllResources();

        }


        return this.getAllResources()
            .filter(item => item.category === category);

    },


    getSubCategory(subcategory) {

        if (!subcategory || subcategory === "all") {

            return this.getAllResources();

        }


        return this.getAllResources()
            .filter(item => item.subcategory === subcategory);

    },


    /**
     * 搜索资源
     */
    search(keyword, data = []) {

        if (!Array.isArray(data) || data.length === 0) {

            return [];

        }


        if (!keyword) {

            return data;

        }


        const key = String(keyword)
            .toLowerCase()
            .trim();


        return data.filter(item => {

            const text = [

                item?.name,

                item?.description,

                item?.desc,

                item?.tag,

                item?.category,

                item?.subcategory,

                ...(Array.isArray(item?.tags) ? item.tags : [])

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return text.includes(key);

        });

    },


    /**
     * 统一过滤
     */
    filter({

        data = [],

        keyword = "",

        category = "all",

        subcategory = "all"

    } = {}) {


        let result = Array.isArray(data)

            ? [...data]

            : [];



        if (category !== "all") {


            result = result.filter(item =>

                item.category === category

            );


        }



        if (subcategory !== "all") {


            result = result.filter(item =>

                item.subcategory === subcategory

            );


        }



        if (keyword) {


            result = this.search(

                keyword,

                result

            );


        }


        return result;


    }


};