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


    escape(value){

        return String(value ?? "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");

    },



    card(resource = {}){


        const {

            name = "未命名资源",

            description = resource.description || resource.desc || "暂无介绍",

            icon = "📦",

            category = "all",

            subcategory = "资源",

            website = "",

            github = resource.github || resource.project || ""


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

<span class="action-btn disabled-btn">
暂无项目
</span>

`;



        return `


<div
class="tool-card"
data-name="${this.escape(name)}"
data-category="${this.escape(category)}"
data-subcategory="${this.escape(subcategory)}"
>


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



    empty(message="暂无资源"){


        return `

<div class="empty">

${this.escape(message)}

</div>

`;

    },



    loading(){


        return `

<div class="loading">

加载中...

</div>

`;

    }


};