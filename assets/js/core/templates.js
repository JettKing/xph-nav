/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Templates v3.0
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


        const {

            name = "未命名资源",

            description = "暂无介绍",

            icon = "📦",

            subcategory = "资源",

            website = "",

            github = ""

        } = resource;



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


            ${
                website

                ?

                `
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

                ""

            }


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