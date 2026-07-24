/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Templates v2.0
 * ----------------------------------------------------------
 * 所有 HTML 模板统一管理
 * 修改 UI 只修改这里
 * ==========================================================
 */

window.ResourceTemplates = {

    /**
     * HTML 转义
     */
    escape(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    },

    /**
     * 资源卡片模板
     */
    card(resource = {}) {

        const {

            name = "未命名资源",

            description = "暂无介绍",

            icon = "📦",

            website = "",

            github = ""

        } = resource;


        return `

<div class="resource-card">

    <div class="resource-icon">

        ${this.escape(icon)}

    </div>

    <div class="resource-content">

        <h3 class="resource-title">

            ${this.escape(name)}

        </h3>

        <p class="resource-description">

            ${this.escape(description)}

        </p>

        <div class="resource-actions">

            ${
                website
                    ? `<a class="resource-btn website-btn" href="${this.escape(website)}" target="_blank" rel="noopener noreferrer">官网</a>`
                    : ""
            }

            ${
                github
                    ? `<a class="resource-btn github-btn" href="${this.escape(github)}" target="_blank" rel="noopener noreferrer">GitHub</a>`
                    : ""
            }

        </div>

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

    ${this.escape(message)}

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