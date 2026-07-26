/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * App v2.1
 * ----------------------------------------------------------
 * 页面生命周期
 * 事件绑定
 * 搜索
 * 分类
 * 渲染刷新
 * ==========================================================
 */

window.ResourceApp = {


    init(){

        const page =
            document.body.dataset.page;


        if(!page){

            console.warn(
                "未设置 data-page"
            );

            return;

        }


        if(
            !window.ResourceStore ||
            !window.ResourceEngine ||
            !window.ResourceRenderer ||
            !window.ResourceTemplates
        ){

            console.error(
                "Core 模块加载不完整",
                {
                    Store: !!window.ResourceStore,
                    Engine: !!window.ResourceEngine,
                    Renderer: !!window.ResourceRenderer,
                    Templates: !!window.ResourceTemplates
                }
            );

            return;

        }


        ResourceStore.init(page);


        this.render();


        this.bindEvents();


    },


    render(){


        const container =
            document.querySelector(
                "#resource-list"
            );

        if(!container){

            console.warn(
                "当前页面不存在 resource-list 容器"
            );

            return;

        }


        ResourceRenderer.render({

            container:"#resource-list",

            data:ResourceStore.getData()

        });


        this.refresh();


    },


    refresh(){


        const count =
            document.getElementById(
                "resourceCount"
            );


        const empty =
            document.getElementById(
                "empty"
            );


        const list =
            document.querySelectorAll(
                ".tool-card"
            );


        if(count){

            count.textContent =
                list.length + " 个资源";

        }


        if(empty){

            empty.style.display =
                list.length === 0
                ? "block"
                : "none";

        }


        // 提供给 Renderer 调用
        window.ResourceAppRefresh =
            ()=>this.refresh();


    },


    bindEvents(){


        const searchInput =
            document.getElementById(
                "searchInput"
            );


        if(searchInput){


            searchInput.addEventListener(
                "input",
                function(){


                    ResourceStore.setKeyword(
                        this.value
                    );


                    ResourceApp.render();


                }
            );

        }



        const categoryButtons =
            document.querySelectorAll(
                ".category-btn"
            );


        categoryButtons.forEach(button=>{


            button.addEventListener(
                "click",
                function(){


                    categoryButtons.forEach(btn=>{

                        btn.classList.remove(
                            "active"
                        );

                    });



                    this.classList.add(
                        "active"
                    );


                    ResourceStore.setCategory(
                        this.dataset.category
                    );


                    ResourceApp.render();


                }
            );


        });


    }


};



document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        ResourceApp.init();

    }
);