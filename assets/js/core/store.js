/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Store v2.1
 * ----------------------------------------------------------
 * 页面状态管理
 * 不负责 DOM
 * 不负责渲染
 * ==========================================================
 */


window.ResourceStore = {


    page: "",


    resources: [],


    keyword: "",


    category: "all",


    sort: "recommend",




    init(page) {


        this.page = page || "";


        if(
            window.ResourceEngine &&
            typeof ResourceEngine.getPageResources === "function"
        ){

            const data =
                ResourceEngine.getPageResources(page);


            this.resources =
                Array.isArray(data)
                ? data
                : [];


        }else{


            console.warn(
                "ResourceEngine 未加载"
            );


            this.resources = [];


        }


    },





    setKeyword(keyword) {


        this.keyword =
            keyword || "";


    },





    setCategory(category) {


        this.category =
            category || "all";


    },





    setSort(sort) {


        this.sort =
            sort || "recommend";


    },





    getData() {


        let data =
            Array.isArray(this.resources)
            ? [...this.resources]
            : [];




        // Search

        if(
            window.ResourceSearch &&
            typeof ResourceSearch.search === "function"
        ){

            data =
                ResourceSearch.search(
                    data,
                    this.keyword
                ) || [];

        }





        // Filter

        if(
            window.ResourceFilter &&
            typeof ResourceFilter.byCategory === "function"
        ){

            data =
                ResourceFilter.byCategory(
                    data,
                    this.category
                ) || [];

        }




        return data;


    },





    reset() {


        this.keyword = "";


        this.category = "all";


        this.sort = "recommend";


        this.resources = [];


    }


};