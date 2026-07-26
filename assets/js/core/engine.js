/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v2.2
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

        ai: () => window.aiResources || [],

        software: () => window.softwareResources || [],

        productivity: () => window.productivityResources || [],

        website: () => window.websiteResources || [],

        digital: () => window.digitalResources || [],

        solution: () => window.solutionResources || []

    },

    aliases: {

        all: "all",

        /* AI */
        chat: "AI聊天",
        drawing: "AI绘图",
        coding: "AI编程",
        office: "AI办公",

        /* Software */
        system: "系统工具",
        media: "影音工具",
        download: "下载工具",
        file: "文件管理",
        network: "网络工具",

        /* Productivity */
        note: "知识管理",
        notes: "知识管理",
        task: "任务管理",
        automation: "自动化工具",
        teamwork: "团队协作",

        /* Website */
        online: "在线工具",
        learning: "学习网站",
        design: "设计网站",
        development: "开发网站",
        search: "搜索引擎",

        /* Digital */
        ebook: "电子书",
        course: "课程教程",
        template: "模板素材",
        prompt: "提示词",
        workflow: "工作流",

        /* Solution */
        tools: "AI办公方案",
        creation: "AI自媒体方案",
        designflow: "AI设计方案",
        video: "AI视频方案",
        telegram: "Telegram运营方案"

    },

    normalize(value) {

        if (!value) return "";

        const key = String(value).trim().toLowerCase();

        return this.aliases[key] || value;

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

            .filter(fn => typeof fn === "function")

            .flatMap(fn => fn());

    },

    getCategory(category) {

        category = this.normalize(category);

        if (!category || category === "all") {

            return this.getAllResources();

        }

        return this.getAllResources().filter(item =>

            item.category === category ||

            item.subcategory === category ||

            item.tag === category ||

            (Array.isArray(item.tags) && item.tags.includes(category))

        );

    },

    getSubCategory(subcategory) {

        subcategory = this.normalize(subcategory);

        if (!subcategory || subcategory === "all") {

            return this.getAllResources();

        }

        return this.getAllResources().filter(item =>

            item.subcategory === subcategory ||

            item.tag === subcategory ||

            (Array.isArray(item.tags) && item.tags.includes(subcategory))

        );

    },

    search(keyword, data = []) {

        if (!Array.isArray(data)) {

            return [];

        }

        if (!keyword) {

            return data;

        }

        const key = String(keyword)

            .trim()

            .toLowerCase();

        return data.filter(item => {

            const text = [

                item?.name,

                item?.description,

                item?.desc,

                item?.category,

                item?.subcategory,

                item?.tag,

                ...(Array.isArray(item?.tags) ? item.tags : []),

                ...(Array.isArray(item?.features) ? item.features : [])

            ]

                .filter(Boolean)

                .join(" ")

                .toLowerCase();

            return text.includes(key);

        });

    },

    filter({

        data = [],

        keyword = "",

        category = "all",

        subcategory = "all"

    } = {}) {

        let result = Array.isArray(data)

            ? [...data]

            : [];

        category = this.normalize(category);

        subcategory = this.normalize(subcategory);

        if (category !== "all") {

            result = result.filter(item => {

                if (item.category === category) return true;

                if (item.subcategory === category) return true;

                if (item.tag === category) return true;

                if (Array.isArray(item.tags) && item.tags.includes(category)) return true;

                return false;

            });

        }

        if (subcategory !== "all") {

            result = result.filter(item => {

                if (item.subcategory === subcategory) return true;

                if (item.tag === subcategory) return true;

                if (Array.isArray(item.tags) && item.tags.includes(subcategory)) return true;

                return false;

            });

        }

        if (keyword) {

            result = this.search(keyword, result);

        }

        return result;

    }

};