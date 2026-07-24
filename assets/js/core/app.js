/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * App v2.0
 * ----------------------------------------------------------
 * 页面生命周期
 * 事件绑定
 * ==========================================================
 */

window.ResourceApp = {

    /**
     * 初始化
     */
    init() {

        const page =
            document.body.dataset.page;


        if (!page) {

            console.warn(
                "未设置 data-page"
            );

            return;

        }


        if (!window.ResourceStore) {

            console.warn(
                "ResourceStore 未加载"
            );

            return;

        }


        ResourceStore.init(page);


        this.render();


        this.bindEvents();

    },


    /**
     * 页面渲染
     */
    render() {

        ResourceRenderer.render({

            container:"#resource-list",

            data:ResourceStore.getData()

        });

    },


    /**
     * 事件绑定
     */
    bindEvents() {


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