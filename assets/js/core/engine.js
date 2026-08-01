/**
 * ==========================================================
 * 徐胖虎资源社 Resource Center
 * Engine v3.1
 * ----------------------------------------------------------
 * 支持：
 * tag
 * tags
 * capability
 * capabilities
 * ==========================================================
 */

window.ResourceEngine = {

    pages: {

        ai: () => window.aiResources || [],

        software: () => window.softwareResources || [],

        productivity: () => window.productivityResources || [],

        website: () => window.websiteResources || [],

        digital: () => window.digitalResources || [],

        solution: () => window.solutionResources || []

    },


    aliases: {

        all:"all",

        chat:"AI聊天",
        drawing:"AI绘图",
        coding:"AI编程",
        office:"AI办公",

        note:"知识管理",
        notes:"知识管理",
        task:"任务管理",
        automation:"自动化",
        teamwork:"团队协作",

        online:"在线工具",
        learning:"学习网站",
        design:"设计网站",
        development:"开发网站",

        ebook:"电子书",
        course:"课程教程",
        template:"模板素材",
        prompt:"提示词",
        workflow:"工作流"

    },


    normalize(value){

        if(!value) return "";

        const key = String(value)
            .trim()
            .toLowerCase();

        return this.aliases[key] || value;

    },



    /**
     * 标签统一匹配
     *
     * 支持：
     * 精确
     * 模糊
     * 大小写
     */

    labelMatch(source,target){

        if(!source || !target)
            return false;


        const a = String(source)
            .toLowerCase()
            .trim();


        const b = String(target)
            .toLowerCase()
            .trim();


        return (

            a === b ||

            a.includes(b) ||

            b.includes(a)

        );

    },



    getPageResources(page){

        if(!page)
            return [];


        if(page==="home"){

            return this.getAllResources();

        }


        const getter=this.pages[page];


        return typeof getter==="function"
            ? getter()
            : [];

    },



    getAllResources(){

        return Object.values(this.pages)

            .filter(fn =>
                typeof fn==="function"
            )

            .flatMap(fn=>fn());

    },



    /**
     * 标签匹配
     *
     * 兼容旧：
     * tag
     * tags
     *
     * 新：
     * capability
     * capabilities
     */

    matchLabel(item,value){

        if(!item || !value)
            return false;



        if(
            this.labelMatch(
                item.tag,
                value
            )
        ){

            return true;

        }



        if(
            Array.isArray(item.tags)
        ){

            if(
                item.tags.some(tag =>
                    this.labelMatch(
                        tag,
                        value
                    )
                )
            ){

                return true;

            }

        }



        if(
            this.labelMatch(
                item.capability,
                value
            )
        ){

            return true;

        }



        if(
            Array.isArray(item.capabilities)
        ){

            if(
                item.capabilities.some(cap =>
                    this.labelMatch(
                        cap,
                        value
                    )
                )
            ){

                return true;

            }

        }


        return false;

    },



    getCategory(category){

        category=this.normalize(category);


        if(
            !category ||
            category==="all"
        ){

            return this.getAllResources();

        }


        return this.getAllResources()
            .filter(item=>

                item.category===category ||

                item.subcategory===category ||

                this.matchLabel(
                    item,
                    category
                )

            );

    },



    getSubCategory(subcategory){

        subcategory=this.normalize(subcategory);


        if(
            !subcategory ||
            subcategory==="all"
        ){

            return this.getAllResources();

        }


        return this.getAllResources()
            .filter(item=>

                item.subcategory===subcategory ||

                this.matchLabel(
                    item,
                    subcategory
                )

            );

    },



    search(keyword,data=[]){

        if(!Array.isArray(data))
            return [];


        if(!keyword)
            return data;


        const key=String(keyword)
            .trim()
            .toLowerCase();



        return data.filter(item=>{


            const text=[

                item?.name,

                item?.description,

                item?.desc,

                item?.category,

                item?.subcategory,

                item?.tag,


                ...(Array.isArray(item?.tags)
                    ? item.tags
                    : []),


                ...(Array.isArray(item?.capabilities)
                    ? item.capabilities
                    : []),


                ...(Array.isArray(item?.features)
                    ? item.features
                    : [])

            ]

            .filter(Boolean)

            .join(" ")

            .toLowerCase();



            return text.includes(key);


        });


    },



    filter({

        data=[],

        keyword="",

        category="all",

        subcategory="all"

    }={}){


        let result=Array.isArray(data)
            ? [...data]
            : [];



        category=this.normalize(category);

        subcategory=this.normalize(subcategory);



        if(category!=="all"){


            result=result.filter(item=>


                item.category===category ||

                item.subcategory===category ||

                this.matchLabel(
                    item,
                    category
                )


            );


        }



        if(subcategory!=="all"){


            result=result.filter(item=>


                item.subcategory===subcategory ||

                this.matchLabel(
                    item,
                    subcategory
                )


            );


        }



        if(keyword){

            result=this.search(
                keyword,
                result
            );

        }



        return result;


    }


};