/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Home v2.3
 * ----------------------------------------------------------
 * 职责：
 * 1. 首页资源入口渲染
 * 2. 读取 home-resource-config
 * 3. 渲染首页资源导航
 * 4. 不负责资源查询
 * 5. 不负责 Store
 * 6. 不负责搜索
 * ==========================================================
 */

window.ResourceHome = {

    config: [],

    init() {

        const container = document.getElementById("home-resource-list");

        if (!container) {
            return;
        }

        this.loadConfig();

        this.render(container);

    },

    loadConfig() {

        const script = document.getElementById(
            "home-resource-config"
        );

        if (!script) {

            console.warn(
                "home-resource-config 未找到"
            );

            this.config = [];

            return;

        }

        try {

            const json = JSON.parse(
                script.textContent || "{}"
            );

            this.config = Array.isArray(json.resources)
                ? json.resources
                : [];

        } catch (e) {

            console.error(
                "home-resource-config 解析失败",
                e
            );

            this.config = [];

        }

    },

    render(container) {

        if (!Array.isArray(this.config)) {

            return;

        }

        container.innerHTML = "";

        if (this.config.length === 0) {

            container.innerHTML = `
                <div style="
                    padding:20px;
                    text-align:center;
                    color:#999;
                    font-size:14px;
                ">
                    暂无资源
                </div>
            `;

            return;

        }

        const fragment = document.createDocumentFragment();

        this.config.forEach(item => {

            fragment.appendChild(
                this.createCard(item)
            );

        });

        container.appendChild(fragment);

    },

    createCard(item) {

        const link = document.createElement("a");

        link.className = "menu-item";

        link.href = item.url || "#";

        link.innerHTML = `

            <div class="menu-icon">

                ${item.icon || "📦"}

            </div>

            <div class="menu-name">

                ${item.name || ""}

            </div>

        `;

        return link;

    }

};