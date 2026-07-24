const softwareList = [

{
icon:"📲",
name:"LocalSend",
desc:"跨平台局域网文件传输工具",

category:"system",
tag:"系统工具",

website:"https://localsend.org",
project:"https://github.com/localsend/localsend",

hot:true,                // 是否热门资源
recommend:true,          // 是否推荐资源
date:"2026-07-24",       // 收录日期
star:5                   // 推荐评分
},


{
icon:"📝",
name:"Obsidian",
desc:"强大的本地知识管理工具",

category:"system",
tag:"系统工具",

website:"https://obsidian.md",
project:"",

hot:false,               // 是否热门资源
recommend:true,          // 是否推荐资源
date:"2026-07-23",       // 收录日期
star:5                   // 推荐评分
}


/*
=========================================================

新增资源模板

复制下面整个对象：
从 { 开始
到 } 结束

然后放入 softwareList 的 [ ] 中。

注意：
每条资源之间使用英文逗号 ,

例如：

{
资源1
},

{
资源2
}

最后一条资源后面的逗号可以删除。


=========================================================


{
icon:"🚀",                    // 资源图标，例如：🚀 🤖 🛠️ 📚 🌐

name:"新工具",                // 资源名称

desc:"工具简介",              // 资源简介


category:"xxx",               // 分类标识
                              // 必须与 HTML 中 data-category 完全一致


tag:"xxx",                    // 显示标签


website:"官网地址",            // 官方网站完整URL


project:"",                   // GitHub/项目地址
                              // 有项目：
                              // project:"https://github.com/xxx"

                              // 无项目：
                              // project:""
                              // 必须保留英文双引号


hot:false,                    // 热门资源
                              // true = 显示热门
                              // false = 普通资源


recommend:false,              // 推荐资源
                              // true = 显示推荐


date:"2026-07-24",             // 收录日期


star:5                         // 推荐评分
                               // 最高5星


}


=========================================================

字段说明：

icon
资源显示图标


name
资源名称


desc
卡片简介


category
分类筛选使用


tag
标签显示


website
官网按钮地址


project
项目地址

没有项目必须：

project:""


hot
控制热门排序


recommend
控制推荐排序


date
用于最新资源排序


star
用于评分显示


=========================================================

*/
];