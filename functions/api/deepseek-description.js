const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

function effectiveCount(value) {
  return Array.from(String(value || "")).filter(ch => /[\u3400-\u9fffA-Za-z0-9]/.test(ch)).length;
}

function cleanDescription(value) {
  return Array.from(String(value || ""))
    .filter(ch => /[\u3400-\u9fffA-Za-z0-9]/.test(ch))
    .join("");
}

function buildPrompt({ name, website, github, sourceText }) {
  return [
    "你是《徐胖虎资源社》的资源简介生成器。",
    "严格根据下面已经由系统从官网或 GitHub 读取到的真实内容生成简介。",
    "你不能访问网址，也不能猜测、补充或虚构未提供的信息。",
    "资源名称必须保持原样，不翻译、不改写；资源名称不是简介。",
    "只生成一句中文核心功能简介。",
    "简介必须严格16个有效字符。",
    "有效字符只计算汉字、英文字母、数字；标点、空格和换行不计入。",
    "不要使用营销词、夸张词、无意义凑字词、网址、来源说明或标签。",
    "优先描述资源实际核心功能，不要重复资源名称。",
    '必须只输出 JSON，例如：{"description":"严格16个有效字符的简介"}。',
    "",
    `资源名称：${name || ""}`,
    `官网：${website || ""}`,
    `GitHub：${github || ""}`,
    "真实读取内容：",
    sourceText
  ].join("\n");
}

async function callDeepSeek(env, prompt) {
  const upstream = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: "只输出合法 JSON，且 JSON 只能包含 description 字段。" },
        { role: "user", content: prompt }
      ],
      thinking: { type: "disabled" },
      max_tokens: 128,
      response_format: { type: "json_object" },
      stream: false
    })
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    const error = new Error("DeepSeek API error");
    error.status = upstream.status;
    error.detail = data;
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("DeepSeek 返回空内容");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("DeepSeek 返回的 JSON 无法解析");
  }
  return String(parsed.description || "").trim();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求 JSON 无效" }, { status: 400 });
  }

  const { name = "", website = "", github = "", sourceText = "" } = body || {};
  const source = String(sourceText).trim();

  if (String(name).length > 120 || String(website).length > 2048 || String(github).length > 2048) {
    return Response.json({ error: "请求字段长度无效" }, { status: 400 });
  }

  if (source.length > 24000) {
    return Response.json({ error: "真实读取内容过长，请缩短后重试" }, { status: 413 });
  }

  if (!source) {
    return Response.json({ error: "没有可供 AI 分析的真实页面内容" }, { status: 400 });
  }

  if (!env.DEEPSEEK_API_KEY) {
    return Response.json({ error: "Cloudflare 未配置 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  let prompt = buildPrompt({
    name,
    website,
    github,
    sourceText: source.slice(0, 24000)
  });

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await callDeepSeek(env, prompt);
      const description = cleanDescription(raw);

      if (effectiveCount(description) === 16) {
        return Response.json({ description });
      }

      prompt += `\n上一次输出为「${raw}」，清洗后有效字符数为${effectiveCount(description)}，请重新生成，必须恰好16个有效字符。`;
    }

    return Response.json(
      { error: "DeepSeek 连续3次未生成严格16字符简介，请重试" },
      { status: 422 }
    );
  } catch (error) {
    return Response.json(
      {
        error: "DeepSeek 生成简介失败",
        detail: error?.message || "unknown error"
      },
      { status: error?.status || 500 }
    );
  }
}