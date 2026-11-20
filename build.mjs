#!/usr/bin/env node
// Builds README.md and README.zh-CN.md. Every price, the discount, the signup
// gift, the model table, the curl examples, the billing formula and the error
// tables are read from the public pages below at build time, so nothing is
// typed twice. Run: node build.mjs   (Node 18 or later, free GETs only)

import { readFile, writeFile } from "node:fs/promises";

const SITE = "https://haryai.com";
const LLMS = `${SITE}/llms.txt`;
const VIDEO_MD = `${SITE}/docs/video.md`;
const CAMPAIGN = "seedance-2.5-api";
// Site pages carry UTM; the docs (.md / .txt) don't.
const page = (path) => `${SITE}${path}?utm_source=github&utm_medium=readme&utm_campaign=${CAMPAIGN}`;

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
};
const must = (m, what) => {
  if (!m) throw new Error(`not found: ${what}`);
  return m;
};
const flat = (s) => s.replace(/\s+/g, " ").trim();
const unescape = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// ---- llms.txt: the Seedance section between the price markers
const llms = await get(LLMS);
const prices = must(llms.match(/PRICES-BEGIN[^\n]*\n([\s\S]*?)<!-- PRICES-END/), "price markers")[1];
const video = must(prices.match(/\*\*Seedance 2\.5 video\*\*[\s\S]*?(?=\nVideo prices:)/), "Seedance section")[0];
const share = Number(must(video.match(/at (\d+)% of BytePlus's official price/), "video share")[1]);
const basis = flat(must(video.match(/Per second of ([\s\S]+?):\n/), "price basis")[1]); // "16:9 output, no reference video"
const gift = Number(must(llms.match(/gets[\s>]+\$([\d.]+)[\s>]+of balance/), "signup gift")[1]);
const models = []; // [{ name, id, tiers: { "480p": { ours, official } } }]
for (const [, name, id, tiers] of video.matchAll(/^- (Seedance[^(]*?) \(([\w-]+)\): (.+)$/gm)) {
  const t = {};
  for (const [, res, ours, official] of tiers.matchAll(/(\d+p) \$([\d.]+) \(official \$([\d.]+)\)/g))
    t[res] = { ours: Number(ours), official: Number(official) };
  models.push({ name, id, tiers: t });
}
must(models.length, "per-second prices");
const off = 100 - share; // en: "12% off"
const zhZhe = share % 10 === 0 ? `${share / 10} 折` : `${share} 折`; // zh: "88 折"

// ---- docs/video.md: models, ranges, examples, billing, errors
const md = await get(VIDEO_MD);
const rows = [...md.matchAll(/^\| `([\w-]+)` \| ([^|]+) \| ([^|]+) \|$/gm)].map(([, id, res]) => ({ id, res: res.trim() }));
must(rows.length, "models table");
const [, dMin, dMax] = must(md.match(/Durations run from (\d+) to (\d+) seconds/), "duration range");
const blocks = [...md.matchAll(/```sh\n([\s\S]*?)```/g)].map((m) => m[1].trimEnd());
if (blocks.length !== 5) throw new Error(`expected 5 sh blocks in video.md, got ${blocks.length}`);
const [arkSubmit, arkPoll, arkDownload, arkList, openai] = blocks;
const listDays = must(md.match(/Your tasks from the last (\d+) days/), "list window")[1];
const linkHours = must(md.match(/expires after (\d+) hours/), "link expiry")[1];
const formula = flat(must(md.match(/Billing tokens = ([\s\S]*?)\. Reference/), "billing formula")[1]);
const sizeRule = flat(must(md.match(/`size` is `WIDTHxHEIGHT`;([\s\S]*?)\n\n/), "size rule")[1]);
const errors = must(md.match(/## Errors\n([\s\S]*)$/), "errors section")[1];
const errTables = [...errors.matchAll(/((?:^\|.*\|\n?)+)/gm)].map((m) => m[1].trimEnd());
if (errTables.length !== 2) throw new Error(`expected 2 error tables, got ${errTables.length}`);

// ---- the agent prompt on the model page (first <pre><code>)
const agentPrompt = async (path) =>
  unescape(must((await get(`${SITE}${path}`)).match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/), `prompt on ${path}`)[1]).trim();
const promptEn = await agentPrompt("/en/seedance-2-5");
const promptZh = await agentPrompt("/zh/seedance-2-5");

// ---- guard: the Node example's default model must still exist
const script = await readFile("examples/seedance.mjs", "utf8");
const scriptModel = must(script.match(/model: "([\w-]+)"/), "script default model")[1];
if (!rows.some((r) => r.id === scriptModel)) throw new Error(`examples/seedance.mjs default model ${scriptModel} is not in video.md`);

const nameOf = (id) => must(models.find((m) => m.id === id), `price for ${id}`).name;
const usd = (n) => `$${n.toFixed(3).replace(/0$/, "")}`;
const clip = (n, s = 5) => `$${(Math.round(Number((n * s).toFixed(4)) * 100 + 1e-6) / 100).toFixed(2)}`; // half up, as the site shows
const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD, local
const flash = models.find((m) => /Flash/.test(m.name));
const proModel = models.find((m) => !/Flash/.test(m.name));
const lowest = proModel;
const lowRes = Object.keys(lowest.tiers)[0];

const modelTable = (h, dur = `${dMin} to ${dMax} s`, sep = ", ") =>
  [`| ${h.join(" | ")} |`, `|${h.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${nameOf(r.id)} | \`${r.id}\` | ${r.res.split(", ").join(sep)} | ${dur} |`)].join("\n");
const priceTable = (h) =>
  [
    `| ${h.join(" | ")} |`,
    `|${h.map(() => "---").join("|")}|`,
    ...models.flatMap((m) => Object.entries(m.tiers).map(([res, p]) => `| ${m.name} | ${res} | ${usd(p.official)} | ${usd(p.ours)} | ${clip(p.ours)} |`)),
  ].join("\n");
const sh = (s) => "```sh\n" + s + "\n```";
const text = (s) => "```text\n" + s + "\n```";

// ================================================================ English
const en = `# Seedance 2.5 API through HaryAI

[中文](README.zh-CN.md)

Use Seedance 2.5 and Seedance 2.5 Flash through [HaryAI](${page("/en/seedance-2-5")}) at ${off}% off BytePlus's official price, with a Volcengine Ark compatible API (and an OpenAI Videos compatible one). You don't need a BytePlus or Volcengine account: one HaryAI key is enough.

This repo shows how to call it: curl, a zero-dependency Node script, and answers to common questions. The full reference is [docs/video.md](${VIDEO_MD}).

## Models

${modelTable(["Model", "Model id", "Resolutions", "Duration"])}

Always set \`duration\` (or \`seconds\`). Sound is generated on request, at the same price with or without it.

## Price per second

US dollars per second of ${basis}. ${off}% off the official BytePlus price, paid from your HaryAI balance.

${priceTable(["Model", "Resolution", "Official", "HaryAI", "5 s clip on HaryAI"])}

With a reference video the per-second price is lower, and the reference video's length is billed too. Current prices: [Seedance API pricing](${page("/en/seedance-api-pricing")}).

## Quick start

1. Sign up at [haryai.com](${page("/en/signup")}). A verified new account gets $${gift.toFixed(2)} of balance, enough for a 5 second ${lowRes} clip on ${lowest.name} (${clip(lowest.tiers[lowRes].ours)}).
2. Copy your API key from the account page and set it: \`export HARYAI_KEY=...\`

Video generation is an asynchronous task: submit, get a task id, poll until it finishes, then download.

### Ark format (base URL \`https://api.haryai.com/api/v3\`)

Submit:

${sh(arkSubmit)}

The reply is \`{"id": "<task id>"}\`. Poll until \`status\` is \`succeeded\` or \`failed\`:

${sh(arkPoll)}

On \`succeeded\`, \`content.video_url\` is the video. It needs no API key and expires after ${linkHours} hours:

${sh(arkDownload)}

To check several tasks in one request, or whether a submit that lost its reply was created, list your tasks from the last ${listDays} days. Filters: \`filter.status\`, \`filter.model\` and \`filter.task_ids\` (repeat it for several ids):

${sh(arkList)}

### OpenAI Videos format (base URL \`https://api.haryai.com/v1\`)

${sh(openai)}

\`size\` is \`WIDTHxHEIGHT\`;${sizeRule.replace(/^/, " ")} \`status\` is \`queued\`, \`in_progress\`, \`completed\` or \`failed\`.

### Node 18, no dependencies

[\`examples/seedance.mjs\`](examples/seedance.mjs) submits a task, polls every 10 seconds and saves the MP4 to \`./out\`. It reads the key from \`HARYAI_KEY\`.

${sh(`export HARYAI_KEY=...
node examples/seedance.mjs "A paper boat sailing down a rain gutter, close up" --duration 5 --resolution 720p --ratio 16:9`)}

Options: \`--model\`, \`--duration\`, \`--resolution\`, \`--ratio\`, \`--audio\`, \`--image <url>\` (repeatable), \`--out\`.

## Questions

### How do I call the Seedance 2.5 API?

Send an Ark request to \`https://api.haryai.com/api/v3/contents/generations/tasks\` with \`Authorization: Bearer <HARYAI_KEY>\` and model \`${proModel.id}\` (or \`${flash?.id}\` for Flash). Poll \`/contents/generations/tasks/<id>\` until \`succeeded\`, then download \`content.video_url\`. Tools that only speak the OpenAI format use \`https://api.haryai.com/v1\` and \`/v1/videos\`.

### How much does Seedance 2.5 cost per second?

${models.map((m) => `${m.name}: ${Object.entries(m.tiers).map(([res, p]) => `${res} ${usd(p.ours)}`).join(", ")} per second (official ${Object.entries(m.tiers).map(([res, p]) => `${res} ${usd(p.official)}`).join(", ")}).`).join(" ")} That is ${off}% off BytePlus's official price, for ${basis}.

### Do I need a BytePlus or Volcengine account?

No. Your HaryAI key is enough. You don't open an account, verify a company or apply for access.

### Is it the full Seedance 2.5?

Yes. Every request goes to the official model. Each task's reply shows the tokens it used.

### Does a Coding Plan cover video?

No. Video is paid from the balance only. The HaryAI Coding Plan is for DeepSeek.

### How do I use Seedance 2.5 in ComfyUI?

The built-in Seedance node bills Comfy's own credits, so install a community video node that takes a Volcengine Ark base URL and an API key. Fill in base URL \`https://api.haryai.com/api/v3\`, your HaryAI key and model \`${proModel.id}\`, plus resolution, ratio, duration (${dMin} to ${dMax} seconds) and generate audio. Nodes that only sign in to their own service won't take the key. Guide: [Seedance 2.5 in ComfyUI and n8n](${page("/en/seedance-2-5-comfyui")}).

### How do I use Seedance 2.5 in n8n?

An HTTP Request node posts the task, a Wait node pauses 10 seconds, and a second HTTP Request node reads the task until \`status\` is \`succeeded\`. The video is at \`content.video_url\`. In Coze, create a custom plugin with the two endpoints (submit, query) and the Authorization header.

### Does it work in hosted AI canvases?

Only in those that let you enter your own base URL and key. Many hosted canvases run on their own credits and take no outside key.

### How do I use it from Claude Code or Codex?

Put your key in \`HARYAI_KEY\`, then paste this to the agent with what you want in the last line. It writes a short script, submits the task, polls and saves the clip to \`./out\`.

${text(promptEn)}

Claude Code runs on your own Claude plan as usual; only the video is paid from your HaryAI balance. Codex doesn't need to switch to DeepSeek first. Guides: [Seedance 2.5 in Claude Code](${page("/en/seedance-2-5-claude")}), [Seedance 2.5 in Codex](${page("/en/seedance-2-5-codex")}).

### How are billing tokens calculated?

Billing tokens = ${formula}. Reference images add nothing. A finished task shows them in \`usage.completion_tokens\` and \`usage.total_tokens\`.

### Why should I set the duration?

On submit the price is held from the balance. Without \`duration\` the hold is for the longest clip (${dMax} s), and a small balance can be refused. When the task finishes you are charged for the real usage.

### Am I charged for a failed video?

No. A failed or timed-out task is refunded in full. So is a task turned down by content moderation; change the prompt or the reference and submit again.

### How long is the video link valid?

${linkHours} hours after the task finishes. The Ark \`content.video_url\` needs no key. The OpenAI format \`/v1/videos/<id>/content\` needs the key.

### What do the errors mean?

Key, model and balance errors:

${errTables[0]}

Ark-format task errors:

${errTables[1]}

A failed task has \`error: {code, message}\`. Details: [docs/video.md](${VIDEO_MD}).

## Links

- [Seedance 2.5](${page("/en/seedance-2-5")}), [Seedance 2.5 Flash](${page("/en/seedance-2-5-flash")})
- [Seedance API pricing](${page("/en/seedance-api-pricing")})
- [Video API reference](${VIDEO_MD}), [Chat API reference](${SITE}/docs/api.md), [llms.txt](${LLMS})
- [seedance-skill](https://github.com/sunsiyuan/seedance-skill): Seedance 2.5 as a Claude Code and Codex skill
- [seedance-comfyui](https://github.com/sunsiyuan/seedance-comfyui): the same in ComfyUI (in ComfyUI Manager)
- [n8n-nodes-haryai](https://github.com/sunsiyuan/n8n-nodes-haryai): the same in n8n (npm \`n8n-nodes-haryai\`)
- [deepseek-codex-claude-code](https://github.com/sunsiyuan/deepseek-codex-claude-code): DeepSeek V4 in Codex and Claude Code

## License

MIT. See [LICENSE](LICENSE).

Prices as of ${today}.

<!-- Generated by build.mjs on ${today} from ${LLMS} (Seedance 2.5 video section between the price markers), ${VIDEO_MD} and the agent prompt on ${SITE}/en/seedance-2-5. Edit build.mjs, not this file. -->
`;

// ================================================================ 中文
const zh = `# 通过 HaryAI 调用 Seedance 2.5 API

[English](README.md)

在 [HaryAI](${page("/zh/seedance-2-5")}) 用 Seedance 2.5 和 Seedance 2.5 Flash，价格是 BytePlus 官方价 ${zhZhe}。接口和火山方舟（Volcengine Ark）一样，也支持 OpenAI Videos 格式。不用开 BytePlus 或火山引擎账号，一个 HaryAI 的 key 就够了。

这个仓库讲怎么调用：curl 示例、一个不依赖任何包的 Node 脚本，还有常见问题的回答。完整接口文档见 [docs/video.md](${VIDEO_MD})。

## 模型

${modelTable(["模型", "模型名", "分辨率", "时长"], `${dMin} 到 ${dMax} 秒`, "、")}

请一定写明 \`duration\`（或 \`seconds\`）。声音可以一起生成，有没有声音都是同一个价。

## 每秒价格

单位美元，每秒价格，按 16:9 输出、不带参考视频计。官方价 ${zhZhe}，从 HaryAI 余额扣费。

${priceTable(["模型", "分辨率", "官方价", "HaryAI", "HaryAI 一段 5 秒"])}

带参考视频时每秒单价更低，参考视频的时长也计费。最新价格见 [Seedance API 价格](${page("/zh/seedance-api-pricing")})。

## 快速开始

1. 在 [haryai.com](${page("/zh/signup")}) 注册。新账号验证邮箱后送 $${gift.toFixed(2)} 余额，够用 ${lowest.name} 生成一段 5 秒 ${lowRes} 的视频（${clip(lowest.tiers[lowRes].ours)}）。
2. 在账户页复制 API key，设成环境变量：\`export HARYAI_KEY=...\`

视频生成是异步任务：先提交，拿到任务 id，轮询到结束，再下载。

### 火山方舟格式（接口地址 \`https://api.haryai.com/api/v3\`）

提交任务：

${sh(arkSubmit)}

返回 \`{"id": "<task id>"}\`。轮询，直到 \`status\` 变成 \`succeeded\` 或 \`failed\`：

${sh(arkPoll)}

成功后 \`content.video_url\` 就是视频地址。下载不需要 API key，链接 ${linkHours} 小时后失效：

${sh(arkDownload)}

想一次查多个任务，或者提交时没收到回复、想确认任务有没有建出来，可以列出最近 ${listDays} 天的任务。可以按 \`filter.status\`、\`filter.model\` 和 \`filter.task_ids\` 筛选，查多个任务就把 \`filter.task_ids\` 写多次：

${sh(arkList)}

### OpenAI Videos 格式（接口地址 \`https://api.haryai.com/v1\`）

${sh(openai)}

\`size\` 写成 \`宽x高\`，按长边定档：长边 1920 及以上是 1080p，1280 及以上是 720p，更小的是 480p。\`status\` 有 \`queued\`、\`in_progress\`、\`completed\`、\`failed\` 四种。

### Node 18 脚本，零依赖

[\`examples/seedance.mjs\`](examples/seedance.mjs) 会提交任务、每 10 秒查一次、把 MP4 存到 \`./out\`。key 从环境变量 \`HARYAI_KEY\` 读取。

${sh(`export HARYAI_KEY=...
node examples/seedance.mjs "雨夜的霓虹小巷，一把红伞" --duration 5 --resolution 720p --ratio 16:9`)}

可选参数：\`--model\`、\`--duration\`、\`--resolution\`、\`--ratio\`、\`--audio\`、\`--image <url>\`（可以写多次）、\`--out\`。

## 常见问题

### Seedance 2.5 API 怎么调用？

按火山方舟的格式向 \`https://api.haryai.com/api/v3/contents/generations/tasks\` 提交，请求头带 \`Authorization: Bearer <HARYAI_KEY>\`，模型填 \`${proModel.id}\`（Flash 填 \`${flash?.id}\`）。然后轮询 \`/contents/generations/tasks/<id>\`，到 \`succeeded\` 后下载 \`content.video_url\`。只支持 OpenAI 格式的工具，接口地址填 \`https://api.haryai.com/v1\`，调用 \`/v1/videos\`。

### Seedance 2.5 每秒多少钱？

${models.map((m) => `${m.name} 每秒 ${Object.entries(m.tiers).map(([res, p]) => `${res} ${usd(p.ours)}`).join("，")}（官方价 ${Object.entries(m.tiers).map(([res, p]) => `${res} ${usd(p.official)}`).join("，")}）。`).join("")}按 16:9、不带参考视频计，是 BytePlus 官方价的 ${zhZhe}。

### 需要开 BytePlus 或火山引擎账号吗？

不需要。有 HaryAI 的 key 就能用，不用开户、不用企业实名、不用申请开通。

### 是满血版 Seedance 2.5 吗？

是。调用的就是官方模型，每个任务的返回里都能看到用了多少 token。

### Coding Plan 能用来生成视频吗？

不能。视频只从余额扣费，HaryAI 的 Coding Plan 只用于 DeepSeek。

### ComfyUI 里怎么用 Seedance 2.5？

ComfyUI 自带的 Seedance 节点扣的是 Comfy 自己的积分。装一个能填火山方舟接口地址和 API key 的社区视频节点，接口地址填 \`https://api.haryai.com/api/v3\`，填上你的 HaryAI key，模型填 \`${proModel.id}\`，再设分辨率、画面比例、时长（${dMin} 到 ${dMax} 秒）和是否生成声音。只能登录它自家服务的节点用不了这个 key。详见 [在 ComfyUI 和 n8n 里用 Seedance 2.5](${page("/zh/seedance-2-5-comfyui")})。

### n8n 里怎么用？

用 HTTP Request 节点提交任务，Wait 节点等 10 秒，再用一个 HTTP Request 节点查询任务，直到 \`status\` 是 \`succeeded\`，视频地址在 \`content.video_url\`。扣子（Coze）的做法是用提交和查询两个接口加上 Authorization 请求头建一个自定义插件，在工作流里调用。

### 在线的 AI 画布能用吗？

能自己填接口地址和 key 的就能用。很多在线画布只用它们自己的积分，不接受外部的 key。

### 在 Claude Code 或 Codex 里怎么用？

先把 key 放进环境变量 \`HARYAI_KEY\`，把下面这段发给 agent，在最后一行写上想要的画面。它会写一个小脚本，提交任务、轮询，把视频存到 \`./out\`。

${text(promptZh)}

Claude Code 照常用你自己的 Claude 订阅，只有视频从 HaryAI 余额扣费。Codex 不用先切换到 DeepSeek。详见 [在 Claude Code 里用 Seedance 2.5](${page("/zh/seedance-2-5-claude")}) 和 [在 Codex 里用 Seedance 2.5](${page("/zh/seedance-2-5-codex")})。

### 计费 token 怎么算？

计费 token =（输入视频秒数 + 输出秒数）× 宽 × 高 × 24 / 1024。参考图片不计费。任务完成后，\`usage.completion_tokens\` 和 \`usage.total_tokens\` 里就是计费 token。

### 为什么要写明时长？

提交时会先从余额预扣。不写 \`duration\`，会按最长的 ${dMax} 秒预扣，余额不够会被拒绝。任务结束后按实际用量结算，多扣的退回。

### 生成失败扣钱吗？

不扣。失败或超时的任务全额退款，审核没通过的也一样。改一下提示词或参考素材再提交就行。

### 成片链接能用多久？

任务完成后 ${linkHours} 小时内有效，请在这之前保存。火山方舟格式的 \`content.video_url\` 下载不需要 key，OpenAI 格式的 \`/v1/videos/<id>/content\` 需要带 key。

### 报错是什么意思？

key、模型和余额相关的错误：

${errTables[0]}

火山方舟格式的任务错误：

${errTables[1]}

401 是 key 缺失或无效；\`insufficient_user_quota\` 是余额不够预扣，写明 \`duration\` 可以降低预扣；\`RateLimitExceeded\` 是模型服务商繁忙，过几秒重试。失败的任务会带 \`error: {code, message}\`。详见 [docs/video.md](${VIDEO_MD})。

## 链接

- [Seedance 2.5](${page("/zh/seedance-2-5")})，[Seedance 2.5 Flash](${page("/zh/seedance-2-5-flash")})
- [Seedance API 价格](${page("/zh/seedance-api-pricing")})
- [视频接口文档](${VIDEO_MD})，[对话接口文档](${SITE}/docs/api.md)，[llms.txt](${LLMS})
- [seedance-skill](https://github.com/sunsiyuan/seedance-skill)：Claude Code 和 Codex 用的 Seedance 2.5 skill
- [seedance-comfyui](https://github.com/sunsiyuan/seedance-comfyui)：在 ComfyUI 里用（ComfyUI Manager 里能搜到）
- [n8n-nodes-haryai](https://github.com/sunsiyuan/n8n-nodes-haryai)：在 n8n 里用（npm 包 \`n8n-nodes-haryai\`）
- [deepseek-codex-claude-code](https://github.com/sunsiyuan/deepseek-codex-claude-code)：在 Codex 和 Claude Code 里用 DeepSeek V4

## 许可

MIT，见 [LICENSE](LICENSE)。

价格截至 ${today}。

<!-- 由 build.mjs 于 ${today} 生成，数据来自 ${LLMS}（价格标记之间的 Seedance 2.5 video 一节）、${VIDEO_MD} 和 ${SITE}/zh/seedance-2-5 上的 agent 提示词。请改 build.mjs，不要直接改本文件。 -->
`;

// zh copy restates two facts in prose; fail if the source changed under it.
if (formula !== "(input video seconds + output seconds) × width × height × 24 / 1024")
  throw new Error(`billing formula changed in video.md, update the zh copy: ${formula}`);
if (sizeRule !== "the longer side picks the tier: 1920 or more is 1080p, 1280 or more is 720p, anything smaller is 480p.")
  throw new Error(`size rule changed in video.md, update the zh copy: ${sizeRule}`);
if (basis !== "16:9 output, no reference video") throw new Error(`price basis changed in llms.txt, update the zh copy: ${basis}`);

await writeFile("README.md", en);
await writeFile("README.zh-CN.md", zh);
console.log(`README.md, README.zh-CN.md: ${share}% of official, ${models.map((m) => `${m.id} ${JSON.stringify(m.tiers)}`).join("; ")}`);
