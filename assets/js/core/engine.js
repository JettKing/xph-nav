/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v2.0
 * ----------------------------------------------------------
 * 职责：
 * 1. 提供页面资源
 * 2. 提供全部资源
 * 3. 提供分类资源
 * 4. 不负责 DOM
 * 5. 不负责渲染
 * ==========================================================
 */

window.ResourceEngine = {

    /**
     * 页面资源映射
     */
    pages: {

        ai: () => window.aiResources || [],

        software: () => window.softwareResources || [],

        productivity: () => window.productivityResources || [],

        website: () => window.websiteResources || [],

        digital: () => window.digitalResources || [],

        solution: () => window.solutionResources || []

    },

    /**
     * 获取指定页面资源
     */
    getPageResources(page) {

        if (!page) return [];

        const getter = this.pages[page];

        return getter ? getter() : [];

    },

    /**
     * 获取全部资源
     */
    getAllResources() {

        return Object.values(this.pages)
            .flatMap(getter => getter());

    },

    /**
     * 根据一级分类获取资源
     */
    getCategory(category) {

        return this.getAllResources()
            .filter(item => item.category === category);

    },

    /**
     * 根据二级分类获取资源
     */
    getSubCategory(subcategory) {

        return this.getAllResources()
            .filter(item => item.subcategory === subcategory);

    }

};