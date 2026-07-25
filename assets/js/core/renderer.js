/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v2.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * 4. 处理异常保护
 * ==========================================================
 */


window.ResourceRenderer = {


    /**
     * 渲染资源列表
     * @param {Object} options
     * @param {String} options.container
     * @param {Array} options.data
     */

    render({

        container = "#resource-list",

        data = []

    } = {}) {


        const element = document.querySelector(container);


        if(!element){

            console.warn(
                `找不到资源容器：${container}`
            );

            return;

        }



        this.clear(element);



        if(
            !Array.isArray(data) ||
            data.length === 0
        ){


            if(
                window.ResourceTemplates &&
                typeof ResourceTemplates.empty === "function"
            ){

                element.innerHTML =
                    ResourceTemplates.empty();

            }else{

                element.innerHTML =
                    `
                    <div class="empty">
                    暂无资源
                    </div>
                    `;

            }


            return;

        }




        if(
            !window.ResourceTemplates ||
            typeof ResourceTemplates.card !== "function"
        ){


            console.warn(
                "ResourceTemplates 未加载"
            );


            return;

        }




        element.innerHTML = data

            .map(item=>{

                return ResourceTemplates.card(item);

            })

            .join("");



    },




    /**
     * 清空容器
     * @param {HTMLElement} container
     */


    clear(container){


        if(!container){

            return;

        }


        container.innerHTML = "";


    }



};