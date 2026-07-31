/**
 * V3.1 能力展示
 *
 * 分类标签和能力标签分离
 *
 * 移动端最多展示2个能力
 */

capabilityBadges(resource = {}) {


    let list = [];


    if (Array.isArray(resource.capabilities)) {

        list = resource.capabilities;

    }


    if (
        resource.capability &&
        !list.includes(resource.capability)
    ) {

        list.push(resource.capability);

    }


    if (!list.length) {

        return "";

    }



    // 移动端稳定展示

    const show = list.slice(0, 2);



    let html = show

        .map(item =>
            this.capabilityBadge(item)
        )

        .join("");



    if (list.length > 2) {


        html += this.capabilityBadge(
            "+" + (list.length - 2)
        );


    }



    return `

<div class="tool-capabilities">

${html}

</div>

`;

}