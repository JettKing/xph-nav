/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Templates v1.0
 * ----------------------------------------------------------
 * 所有 HTML 模板统一管理
 * 修改 UI 只修改这里
 * ==========================================================
 */

window.ResourceTemplates = {

    /**
     * 资源卡片模板
     */
    card(resource) {

        return `
            <div class="resource-card">

                <div class="resource-icon">
                    ${resource.icon || "📦"}
                </div>

                <div class="resource-content">

                    <h3 class="resource-title">
                        ${resource.name}
                    </h3>

                    <p class="resource-description">
                        ${resource.description}
                    </p>

                </div>

            </div>
        `;

    },

    /**
     * 空状态模板
     */
    empty(message = "暂无资源") {

        return `
            <div class="resource-empty">

                ${message}

            </div>
        `;

    },

    /**
     * 加载状态模板
     */
    loading() {

        return `
            <div class="resource-loading">

                加载中...

            </div>
        `;

    }

};