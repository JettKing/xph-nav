/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v1.0
 * ----------------------------------------------------------
 * 负责：
 * 1. 获取资源数据
 * 2. 调用 Renderer
 * 3. 调用 Filter
 * 4. 调用 Search
 * ==========================================================
 */

window.ResourceEngine = {

    /**
     * 获取全部资源
     */
    getAllResources() {

        return [

            ...(window.aiResources || []),

            ...(window.softwareResources || []),

            ...(window.productivityResources || []),

            ...(window.websiteResources || []),

            ...(window.digitalResources || []),

            ...(window.solutionResources || [])

        ];

    },

    /**
     * 根据一级分类获取资源
     */
    getCategory(category) {

        return this.getAllResources().filter(item => item.category === category);

    },

    /**
     * 根据二级分类获取资源
     */
    getSubCategory(subcategory) {

        return this.getAllResources().filter(item => item.subcategory === subcategory);

    }

};