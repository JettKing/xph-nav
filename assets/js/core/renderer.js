/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Renderer v3.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 清空容器
 * 2. 渲染资源列表
 * 3. 调用 Templates
 * 4. 更新资源数量
 * 5. V3.1能力标签兼容
 * ==========================================================
 */

window.ResourceRenderer = {


    /**
     * V3.1 数据兼容处理
     */
    normalizeItem(item){

        if(!item){
            return {};
        }


        return {

            ...item,


            tags:

                Array.isArray(item.tags)

                ? item.tags

                : [],



            capabilities:

                Array.isArray(item.capabilities)

                ? item.capabilities

                : []

        };

    },



    normalizeData(data){

        if(!Array.isArray(data)){

            return [];

        }


        return data.map(item =>

            this.normalizeItem(item)

        );

    },



    render({

        container = "#resource-list",

        data = []

    } = {}) {


        const element =
            document.querySelector(container);



        if (!element) {


            console.warn(
                `找不到容器：${container}`
            );


            return;


        }



        this.clear(element);



        data = this.normalizeData(data);



        if (!data.length) {


            element.innerHTML =
                ResourceTemplates.empty();



            this.updateCount(0);


            this.refresh();


            return;


        }



        element.innerHTML = data

            .map(item =>

                ResourceTemplates.card(item)

            )

            .join("");



        this.updateCount(

            data.length

        );



        this.refresh();



    },




    append({

        container = "#resource-list",

        data = []

    } = {}) {



        const element =
            document.querySelector(container);



        if (!element) {

            return;

        }



        data = this.normalizeData(data);



        if (!data.length) {

            return;

        }



        element.insertAdjacentHTML(

            "beforeend",

            data

                .map(item =>

                    ResourceTemplates.card(item)

                )

                .join("")

        );



        this.updateCount(

            element.querySelectorAll(
                ".tool-card"
            ).length

        );



        this.refresh();



    },




    loading(container = "#resource-list") {


        const element =
            document.querySelector(container);



        if (!element) {


            return;


        }



        element.innerHTML =
            ResourceTemplates.loading();



    },




    empty(

        container = "#resource-list",

        message = "暂无资源"

    ) {


        const element =
            document.querySelector(container);



        if (!element) {


            return;


        }



        element.innerHTML =
            ResourceTemplates.empty(message);



        this.updateCount(0);



        this.refresh();



    },




    clear(container) {


        if (!container) {


            return;


        }



        container.innerHTML = "";



    },




    updateCount(count) {


        const counter =
            document.getElementById(
                "resourceCount"
            );



        if (!counter) {


            return;


        }



        counter.textContent =
            `${count} 个资源`;



    },




    refresh() {


        if (
            typeof window.ResourceAppRefresh ===
            "function"
        ) {


            window.ResourceAppRefresh();


        }


    }


};