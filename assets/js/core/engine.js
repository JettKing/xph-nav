/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v2.1
 * ----------------------------------------------------------
 * 职责：
 * 1. 提供页面资源
 * 2. 提供全部资源
 * 3. 提供分类资源
 * 4. 不负责 DOM
 * 5. 不负责渲染
 * ==========================================================
 */


window.ResourceEngine = {


    /**
     * 页面资源映射
     */

    pages: {


        ai: () => 
            Array.isArray(window.aiResources)
            ? window.aiResources
            : [],


        software: () =>
            Array.isArray(window.softwareResources)
            ? window.softwareResources
            : [],


        productivity: () =>
            Array.isArray(window.productivityResources)
            ? window.productivityResources
            : [],


        website: () =>
            Array.isArray(window.websiteResources)
            ? window.websiteResources
            : [],


        digital: () =>
            Array.isArray(window.digitalResources)
            ? window.digitalResources
            : [],


        solution: () =>
            Array.isArray(window.solutionResources)
            ? window.solutionResources
            : []

    },





    /**
     * 获取指定页面资源
     */

    getPageResources(page) {


        if(!page){

            return [];

        }


        const getter =
            this.pages[page];


        if(
            typeof getter !== "function"
        ){

            return [];

        }


        return getter();


    },





    /**
     * 获取全部资源
     */

    getAllResources() {


        return Object.values(this.pages)

            .flatMap(getter=>{


                try{


                    const data =
                        getter();


                    return Array.isArray(data)
                        ? data
                        : [];


                }catch(error){


                    console.warn(
                        "资源读取失败",
                        error
                    );


                    return [];


                }


            });


    },





    /**
     * 根据一级分类获取资源
     */

    getCategory(category) {


        if(!category){

            return [];

        }


        return this.getAllResources()

            .filter(item=>{

                return item &&
                    item.category === category;

            });


    },





    /**
     * 根据二级分类获取资源
     */

    getSubCategory(subcategory) {


        if(!subcategory){

            return [];

        }


        return this.getAllResources()

            .filter(item=>{

                return item &&
                    item.subcategory === subcategory;

            });


    }



};