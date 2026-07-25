/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Templates v3.1
 * ----------------------------------------------------------
 * 所有资源 HTML 模板统一管理
 * UI 结构唯一来源
 * ==========================================================
 */


window.ResourceTemplates = {



    /**
     * HTML 转义
     */

    escape(value){

        return String(value ?? "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");

    },




    /**
     * 资源卡片模板
     */

    card(resource = {}){


        const name =
            resource.name || "未命名资源";


        const description =
            resource.description ||
            resource.desc ||
            "暂无介绍";


        const icon =
            resource.icon ||
            "📦";


        const subcategory =
            resource.subcategory ||
            resource.category ||
            "资源";



        const website =
            resource.website ||
            resource.url ||
            "";



        const github =
            resource.github ||
            resource.project ||
            "";





        const projectButton = github

        ? `

<a
class="action-btn project-btn"
href="${this.escape(github)}"
target="_blank"
rel="noopener noreferrer"
>
项目地址
</a>

`

        :

        `

<span
class="action-btn disabled-btn"
>
暂无项目
</span>

`;






        const websiteButton = website

        ? `

<a
class="action-btn website-btn"
href="${this.escape(website)}"
target="_blank"
rel="noopener noreferrer"
>
官网地址
</a>

`

        :

        "";





        return `


<div class="tool-card">


    <div class="tool-main">


        <div class="tool-icon">

            ${this.escape(icon)}

        </div>



        <div class="tool-info">


            <div class="tool-name">

                ${this.escape(name)}

            </div>



            <div class="tool-desc">

                ${this.escape(description)}

            </div>


        </div>


    </div>



    <div class="tool-bottom">


        <div class="tool-tag">

            ${this.escape(subcategory)}

        </div>



        <div class="tool-actions">


            ${websiteButton}


            ${projectButton}


        </div>


    </div>


</div>


`;

    },





    /**
     * 空状态
     */

    empty(message="暂无资源"){


        return `

<div class="empty">

    ${this.escape(message)}

</div>

`;

    },





    /**
     * 加载状态
     */

    loading(){


        return `

<div class="loading">

    加载中...

</div>

`;

    }



};