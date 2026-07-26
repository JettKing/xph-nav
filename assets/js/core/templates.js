/**
 * ==========================================================
 * Templates v2.2
 * ----------------------------------------------------------
 * 所有资源 HTML 模板统一管理
 * UI 组件唯一来源
 * 支持：
 * Card
 * Empty
 * Loading
 * Skeleton
 * Badge
 * ==========================================================
 */

window.ResourceTemplates = {

    escape(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    },

    badge(text) {

        if (!text) return "";

        return `
<span class="tool-tag">
${this.escape(text)}
</span>
`;

    },

    button(text, href, className = "") {

        if (!href) {

            return `
<span class="action-btn disabled-btn">
${this.escape(text)}
</span>
`;

        }

        return `
<a
class="action-btn ${className}"
href="${this.escape(href)}"
target="_blank"
rel="noopener noreferrer">
${this.escape(text)}
</a>
`;

    },

    card(resource = {}) {

        const {

            name = "未命名资源",

            description = resource.desc || "暂无介绍",

            icon = "📦",

            category = "all",

            subcategory = "",

            website = "",

            github = resource.project || "",

            recommend = false,

            official = false,

            score = "",

            update = ""

        } = resource;

        return `

<div
class="tool-card"
data-name="${this.escape(name)}"
data-category="${this.escape(category)}"
data-subcategory="${this.escape(subcategory)}">

<div class="tool-main">

<div class="tool-icon">
${this.escape(icon)}
</div>

<div class="tool-info">

<div class="tool-name">

${this.escape(name)}

${recommend ? '<span class="recommend-badge">⭐ 推荐</span>' : ""}

${official ? '<span class="official-badge">✔ 官方</span>' : ""}

</div>

<div class="tool-desc">

${this.escape(description)}

</div>

<div class="tool-meta">

${this.badge(subcategory)}

${score ? this.badge("评分 " + score) : ""}

${update ? this.badge(update) : ""}

</div>

</div>

</div>

<div class="tool-bottom">

<div class="tool-actions">

${this.button("官网地址", website, "website-btn")}

${this.button("项目地址", github, "project-btn")}

</div>

</div>

</div>

`;

    },

    skeleton(count = 6) {

        return Array.from({

            length: count

        }).map(() => `

<div class="tool-card skeleton-card">

<div class="tool-main">

<div class="tool-icon skeleton"></div>

<div class="tool-info">

<div class="skeleton skeleton-title"></div>

<div class="skeleton skeleton-desc"></div>

</div>

</div>

</div>

`).join("");

    },

    empty(message = "暂无资源") {

        return `

<div class="empty">

<div class="empty-icon">

📂

</div>

<div class="empty-text">

${this.escape(message)}

</div>

</div>

`;

    },

    loading() {

        return `

<div class="loading">

<div class="loading-spinner"></div>

<div class="loading-text">

资源加载中...

</div>

</div>

`;

    }

};