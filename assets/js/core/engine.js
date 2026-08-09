/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v3.1
 * ----------------------------------------------------------
 * 全站统一分类引擎
 *
 * V3.1 分类体系：
 * 1. categories.js 为分类唯一配置源
 * 2. HTML 使用分类 key（如 ai_chat）
 * 3. data/*.js 保留可读中文 subcategory
 * 4. Engine 负责 key ↔ label 统一解析
 * 5. 兼容旧版中文分类值与旧别名
 *
 * 同时支持：
 * tag / tags
 * capability / capabilities
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

    /* ------------------------------------------------------
       旧版兼容别名
       ------------------------------------------------------ */
    aliases: {
        all: "all",

        chat: "AI聊天",
        drawing: "AI绘图",
        coding: "AI编程",
        office: "AI办公",

        note: "笔记工具",
        notes: "笔记工具",
        task: "任务管理",
        automation: "自动化工具",
        teamwork: "团队协作",

        online: "在线工具",
        learning: "学习网站",
        design: "设计网站",
        development: "开发网站",

        ebook: "电子书",
        course: "课程教程",
        template: "模板素材",
        prompt: "提示词",
        workflow: "工作流"
    },

    /* ------------------------------------------------------
       构建分类索引
       categories.js 是唯一事实来源
       ------------------------------------------------------ */
    getCategoryIndex() {
        const source = window.categories || {};
        const index = {};

        Object.keys(source).forEach(parentKey => {
            const group = source[parentKey] || {};
            const children = group.children || {};

            Object.keys(children).forEach(childKey => {
                const label = children[childKey];

                if (!label) return;

                index[childKey.toLowerCase()] = label;
                index[String(label).trim().toLowerCase()] = label;
            });
        });

        return index;
    },

    /* ------------------------------------------------------
       分类值标准化

       例如：
       ai_chat         → AI聊天
       AI聊天          → AI聊天
       productivity_task → 任务管理
       notes           → 笔记工具（旧版兼容）
       ------------------------------------------------------ */
    normalize(value) {
        if (!value) return "";

        const raw = String(value).trim();
        const key = raw.toLowerCase();

        if (key === "all") return "all";

        const categoryIndex = this.getCategoryIndex();

        if (categoryIndex[key]) {
            return categoryIndex[key];
        }

        if (this.aliases[key]) {
            const aliasValue = this.aliases[key];
            const aliasKey = String(aliasValue).trim().toLowerCase();

            return categoryIndex[aliasKey] || aliasValue;
        }

        return raw;
    },

    /* ------------------------------------------------------
       分类 key / label 获取
       用于校验与调试
       ------------------------------------------------------ */
    getCategoryLabel(value) {
        return this.normalize(value);
    },

    getCategoryKey(value) {
        if (!value) return "";

        const raw = String(value).trim().toLowerCase();
        const source = window.categories || {};

        for (const parentKey of Object.keys(source)) {
            const children = source[parentKey]?.children || {};

            for (const childKey of Object.keys(children)) {
                const label = String(children[childKey] || "").trim().toLowerCase();

                if (
                    childKey.toLowerCase() === raw ||
                    label === raw
                ) {
                    return childKey;
                }
            }
        }

        return raw;
    },

    labelMatch(source, target) {
        if (!source || !target) return false;

        const a = String(source).toLowerCase().trim();
        const b = String(target).toLowerCase().trim();

        return (
            a === b ||
            a.includes(b) ||
            b.includes(a)
        );
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

    matchLabel(item, value) {
        if (!item || !value) return false;

        const target = String(value).trim();

        if (this.labelMatch(item.tag, target)) {
            return true;
        }

        if (Array.isArray(item.tags)) {
            if (
                item.tags.some(tag =>
                    this.labelMatch(tag, target)
                )
            ) {
                return true;
            }
        }

        if (this.labelMatch(item.capability, target)) {
            return true;
        }

        if (Array.isArray(item.capabilities)) {
            if (
                item.capabilities.some(cap =>
                    this.labelMatch(cap, target)
                )
            ) {
                return true;
            }
        }

        return false;
    },

    categoryMatch(item, value) {
        if (!item || !value) return false;

        const normalized = this.normalize(value);

        if (item.category === normalized || item.subcategory === normalized) {
            return true;
        }

        if (Array.isArray(item.subcategories)) {
            if (item.subcategories.some(subcategory =>
                this.normalize(subcategory) === normalized
            )) {
                return true;
            }
        }

        return false;
    },

    getCategory(category) {
        category = this.normalize(category);

        if (!category || category === "all") {
            return this.getAllResources();
        }

        return this.getAllResources().filter(item =>
            this.categoryMatch(item, category) ||
            this.matchLabel(item, category)
        );
    },

    getSubCategory(subcategory) {
        subcategory = this.normalize(subcategory);

        if (!subcategory || subcategory === "all") {
            return this.getAllResources();
        }

        return this.getAllResources().filter(item =>
            this.categoryMatch(item, subcategory) ||
            this.matchLabel(item, subcategory)
        );
    },

    search(keyword, data = []) {
        if (!Array.isArray(data)) return [];
        if (!keyword) return data;

        const key = String(keyword).trim().toLowerCase();

        return data.filter(item => {
            const text = [
                item?.name,
                item?.description,
                item?.desc,
                item?.category,
                item?.subcategory,
                item?.tag,
                ...(Array.isArray(item?.tags) ? item.tags : []),
                ...(Array.isArray(item?.capabilities) ? item.capabilities : []),
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
            result = result.filter(item =>
                this.categoryMatch(item, category) ||
                this.matchLabel(item, category)
            );
        }

        if (subcategory !== "all") {
            result = result.filter(item =>
                this.categoryMatch(item, subcategory) ||
                this.matchLabel(item, subcategory)
            );
        }

        if (keyword) {
            result = this.search(keyword, result);
        }

        return result;
    }
};
