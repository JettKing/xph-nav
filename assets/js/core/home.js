/**
 * ==========================================================
 * 徐胖虎资源社
 * Home v3.1
 * ----------------------------------------------------------
 * 首页资源入口渲染
 *
 * V3.1:
 * 支持能力入口
 *
 * 保留:
 * url
 * name
 * icon
 *
 * 新增:
 * capability
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




    /**
     * V3.1
     *
     * 获取入口地址
     *
     * 兼容:
     *
     * 旧:
     * url
     *
     * 新:
     * capability
     */

    getItemUrl(item){


        if(item.url){


            return item.url;


        }



        if(item.capability){



            return (

                "./index.html?capability=" +

                encodeURIComponent(
                    item.capability
                )

            );


        }



        return "#";


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