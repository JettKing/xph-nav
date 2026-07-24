/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Main v1.0
 * ----------------------------------------------------------
 * 网站入口
 * ==========================================================
 */

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 徐胖虎资源社 Resource Center 已启动");

    init();

});


/**
 * 初始化
 */
function init() {

    // 默认加载 AI 分类
    const resources = ResourceEngine.getCategory("ai");

    ResourceRenderer.renderResources(resources);

}