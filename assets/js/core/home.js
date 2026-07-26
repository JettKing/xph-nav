/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Home v2.3.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 首页资源入口渲染
 * 2. 读取 home-resource-config
 * 3. 渲染首页资源导航
 * 4. 不负责资源查询
 * 5. 不负责 Store
 * 6. 不负责搜索
 * 7. 支持延迟加载配置
 * ==========================================================
 */

window.ResourceHome = {

    config: [],

    initialized: false,

    retryCount: 0,

    maxRetry: 5,


    init() {

        if (this.initialized) {

            return;

        }


        const container = document.getElementById(
            "home-resource-list"
        );


        if (!container) {

            console.warn(
                "home-resource-list 未找到"
            );

            return;

        }


        this.container = container;


        this.loadConfig();


    },


    loadConfig() {


        const script = document.getElementById(
            "home-resource-config"
        );


        if (!script) {


            if (this.retryCount < this.maxRetry) {


                this.retryCount++;


                setTimeout(() => {

                    this.loadConfig();

                }, 100);


                return;

            }



            console.warn(
                "home-resource-config 未找到"
            );


            this.config = [];


            this.render();


            return;


        }



        try {


            const json = JSON.parse(

                script.textContent || "{}"

            );



            this.config = Array.isArray(
                json.resources
            )

                ? json.resources

                : [];



            this.render();



            this.initialized = true;



        } catch (error) {


            console.error(

                "home-resource-config 解析失败",

                error

            );


            this.config = [];


            this.render();


        }


    },


    render() {


        const container = this.container;


        if (!container) {


            return;


        }



        container.innerHTML = "";



        if (!this.config.length) {


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



    createCard(item = {}) {


        const link = document.createElement(
            "a"
        );


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