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
 * 5. 通知交互层刷新
 *
 * V3.1:
 * 支持 capabilities 能力标签数据传递
 * 保留 tags 标签体系兼容
 * ==========================================================
 */

window.ResourceRenderer = {


    normalizeItem(item = {}) {


        return {


            ...item,


            // 保留旧标签

            tags: Array.isArray(item.tags)

                ? item.tags

                : (item.tag ? [item.tag] : []),



            // V3.1 能力标签

            capabilities:

                Array.isArray(item.capabilities)

                    ? item.capabilities

                    : (item.capability

                        ? [item.capability]

                        : [])


        };


    },



    normalizeList(data = []) {


        if (!Array.isArray(data)) {

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


        const element = document.querySelector(container);



        if (!element) {


            console.warn(

                `找不到容器：${container}`

            );


            return;


        }



        const list = this.normalizeList(data);



        this.clear(element);



        if (!list.length) {


            element.innerHTML =

                ResourceTemplates.empty();



            this.updateCount(0);


            this.refresh();


            return;


        }



        element.innerHTML = list

            .map(item =>

                ResourceTemplates.card(item)

            )

            .join("");



        this.updateCount(list.length);



        this.refresh();



    },



    append({

        container = "#resource-list",

        data = []

    } = {}) {



        const element = document.querySelector(container);



        if (!element) {


            return;


        }



        const list = this.normalizeList(data);



        if (!list.length) {


            return;


        }



        element.insertAdjacentHTML(

            "beforeend",

            list

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



        const element = document.querySelector(container);



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



        const element = document.querySelector(container);



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



        const counter = document.getElementById(

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