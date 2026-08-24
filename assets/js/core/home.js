/**
 * ==========================================================
 * 徐胖虎资源社
 * Home v5.3
 * ----------------------------------------------------------
 * 首页资源入口渲染
 *
 * ==========================================================
 */

window.ResourceHome = {


    init(){


        const container =
            document.getElementById(
                "home-resource-list"
            );



        if(!container){


            console.warn(
                "home-resource-list 不存在"
            );


            return;


        }



        const config =
            document.getElementById(
                "home-resource-config"
            );



        if(!config){


            console.warn(
                "home-resource-config 不存在"
            );


            return;


        }



        let data=[];



        try{


            const json =
                JSON.parse(
                    config.textContent
                );



            data =
                Array.isArray(json.resources)

                ?

                json.resources

                :

                [];



        }catch(error){



            console.error(

                "首页资源配置解析失败",

                error

            );



            return;


        }



        this.render(

            container,

            data

        );


    },




    /** 当前 V5.3 首页入口仅使用显式导航 URL。 */

    getItemUrl(item){
        return typeof item?.url === "string" && item.url.trim() ? item.url.trim() : "#";
    },




    render(container,data){


        container.innerHTML="";



        if(!data.length){


            return;


        }



        data.forEach(item=>{


            container.appendChild(

                this.createItem(item)

            );


        });



    },




    createItem(item){



        const link =

            document.createElement(
                "a"
            );



        link.className =
            "menu-item";



        link.href =
            this.getItemUrl(item);



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