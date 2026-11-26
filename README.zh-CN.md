# 通过 HaryAI 调用 Seedance 2.5 API

[English](README.md)

在 [HaryAI](https://haryai.com/zh/seedance-2-5?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api) 用 Seedance 2.5 和 Seedance 2.5 Flash，价格是 BytePlus 官方价 88 折。接口和火山方舟（Volcengine Ark）一样，也支持 OpenAI Videos 格式。不用开 BytePlus 或火山引擎账号，一个 HaryAI 的 key 就够了。

这个仓库讲怎么调用：curl 示例、一个不依赖任何包的 Node 脚本，还有常见问题的回答。完整接口文档见 [docs/video.md](https://haryai.com/docs/video.md)。

## 模型

| 模型 | 模型名 | 分辨率 | 时长 |
|---|---|---|---|
| Seedance 2.5 | `dreamina-seedance-2-5-260628` | 480p、720p、1080p | 4 到 30 秒 |
| Seedance 2.5 Flash | `dreamina-seedance-2-5-flash-261115` | 480p、720p | 4 到 30 秒 |
| Seedance 2.5 | `dreamina-seedance-2-5-260628-unlock` | 480p、720p、1080p | 4 到 30 秒 |
| Seedance 2.5 Flash | `dreamina-seedance-2-5-flash-261115-unlock` | 480p、720p | 4 到 30 秒 |

请一定写明 `duration`（或 `seconds`）。声音可以一起生成，有没有声音都是同一个价。

## 每秒价格

单位美元，每秒价格，按 16:9 输出、不带参考视频计。官方价 88 折，从 HaryAI 余额扣费。

| 模型 | 分辨率 | 官方价 | HaryAI | HaryAI 一段 5 秒 |
|---|---|---|---|---|
| Seedance 2.5 | 480p | $0.103 | $0.09 | $0.45 |
| Seedance 2.5 | 720p | $0.231 | $0.203 | $1.02 |
| Seedance 2.5 | 1080p | $0.569 | $0.50 | $2.50 |
| Seedance 2.5 Flash | 480p | $0.067 | $0.059 | $0.30 |
| Seedance 2.5 Flash | 720p | $0.151 | $0.133 | $0.67 |

带参考视频时每秒单价更低，参考视频的时长也计费。最新价格见 [Seedance API 价格](https://haryai.com/zh/seedance-api-pricing?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)。

### 解禁版 官方价 94 折

同一个模型，内容限制更少。模型名后面加 -unlock 就行，比如 `dreamina-seedance-2-5-260628-unlock`。仍然有内容审核，被拒的任务全额退回。

| 模型 | 分辨率 | 官方价 | HaryAI | HaryAI 一段 5 秒 |
|---|---|---|---|---|
| Seedance 2.5 | 480p | $0.103 | $0.097 | $0.48 |
| Seedance 2.5 | 720p | $0.231 | $0.217 | $1.09 |
| Seedance 2.5 | 1080p | $0.569 | $0.535 | $2.67 |
| Seedance 2.5 Flash | 480p | $0.067 | $0.063 | $0.32 |
| Seedance 2.5 Flash | 720p | $0.151 | $0.142 | $0.71 |

## 快速开始

1. 在 [haryai.com](https://haryai.com/zh/signup?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api) 注册。新账号验证邮箱后送 $0.50 余额，够用 Seedance 2.5 生成一段 5 秒 480p 的视频（$0.45）。
2. 在账户页复制 API key，设成环境变量：`export HARYAI_KEY=...`

视频生成是异步任务：先提交，拿到任务 id，轮询到结束，再下载。

### 火山方舟格式（接口地址 `https://api.haryai.com/api/v3`）

提交任务：

```sh
curl https://api.haryai.com/api/v3/contents/generations/tasks \
  -H "Authorization: Bearer $HARYAI_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-5-260628",
    "content": [{"type": "text", "text": "A cat dancing in the rain"}],
    "duration": 5,
    "resolution": "720p",
    "ratio": "16:9"
  }'
```

返回 `{"id": "<task id>"}`。轮询，直到 `status` 变成 `succeeded` 或 `failed`：

```sh
curl https://api.haryai.com/api/v3/contents/generations/tasks/<task id> \
  -H "Authorization: Bearer $HARYAI_KEY"
```

成功后 `content.video_url` 就是视频地址。下载不需要 API key，链接 24 小时后失效：

```sh
curl -L -o video.mp4 "<content.video_url>"
```

想一次查多个任务，或者提交时没收到回复、想确认任务有没有建出来，可以列出最近 7 天的任务。可以按 `filter.status`、`filter.model` 和 `filter.task_ids` 筛选，查多个任务就把 `filter.task_ids` 写多次：

```sh
curl "https://api.haryai.com/api/v3/contents/generations/tasks?page_size=20&filter.status=succeeded" \
  -H "Authorization: Bearer $HARYAI_KEY"
```

### OpenAI Videos 格式（接口地址 `https://api.haryai.com/v1`）

```sh
# 1. Submit (JSON or multipart)
curl https://api.haryai.com/v1/videos \
  -H "Authorization: Bearer $HARYAI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"dreamina-seedance-2-5-260628","prompt":"A cat dancing in the rain","seconds":5,"size":"1280x720"}'

# 2. Poll
curl https://api.haryai.com/v1/videos/<id> -H "Authorization: Bearer $HARYAI_KEY"

# 3. Download (needs the key)
curl -L -o video.mp4 https://api.haryai.com/v1/videos/<id>/content \
  -H "Authorization: Bearer $HARYAI_KEY"
```

`size` 写成 `宽x高`，按长边定档：长边 1920 及以上是 1080p，1280 及以上是 720p，更小的是 480p。`status` 有 `queued`、`in_progress`、`completed`、`failed` 四种。

### Node 18 脚本，零依赖

[`examples/seedance.mjs`](examples/seedance.mjs) 会提交任务、每 10 秒查一次、把 MP4 存到 `./out`。key 从环境变量 `HARYAI_KEY` 读取。

```sh
export HARYAI_KEY=...
node examples/seedance.mjs "雨夜的霓虹小巷，一把红伞" --duration 5 --resolution 720p --ratio 16:9
```

可选参数：`--model`、`--duration`、`--resolution`、`--ratio`、`--audio`、`--image <url>`（可以写多次）、`--out`。

## 常见问题

### Seedance 2.5 API 怎么调用？

按火山方舟的格式向 `https://api.haryai.com/api/v3/contents/generations/tasks` 提交，请求头带 `Authorization: Bearer <HARYAI_KEY>`，模型填 `dreamina-seedance-2-5-260628`（Flash 填 `dreamina-seedance-2-5-flash-261115`）。然后轮询 `/contents/generations/tasks/<id>`，到 `succeeded` 后下载 `content.video_url`。只支持 OpenAI 格式的工具，接口地址填 `https://api.haryai.com/v1`，调用 `/v1/videos`。

### Seedance 2.5 每秒多少钱？

Seedance 2.5 每秒 480p $0.09，720p $0.203，1080p $0.50（官方价 480p $0.103，720p $0.231，1080p $0.569）。Seedance 2.5 Flash 每秒 480p $0.059，720p $0.133（官方价 480p $0.067，720p $0.151）。按 16:9、不带参考视频计，是 BytePlus 官方价的 88 折。

### 需要开 BytePlus 或火山引擎账号吗？

不需要。有 HaryAI 的 key 就能用，不用开户、不用企业实名、不用申请开通。

### 是满血版 Seedance 2.5 吗？

是。调用的就是官方模型，每个任务的返回里都能看到用了多少 token。

### Coding Plan 能用来生成视频吗？

不能。视频只从余额扣费，HaryAI 的 Coding Plan 只用于 DeepSeek。

### 大额充值有更多折扣吗？

有。写信到 support@haryai.com，可以直充，折扣更多。

### ComfyUI 里怎么用 Seedance 2.5？

ComfyUI 自带的 Seedance 节点扣的是 Comfy 自己的积分。装一个能填火山方舟接口地址和 API key 的社区视频节点，接口地址填 `https://api.haryai.com/api/v3`，填上你的 HaryAI key，模型填 `dreamina-seedance-2-5-260628`，再设分辨率、画面比例、时长（4 到 30 秒）和是否生成声音。只能登录它自家服务的节点用不了这个 key。详见 [在 ComfyUI 和 n8n 里用 Seedance 2.5](https://haryai.com/zh/seedance-2-5-comfyui?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)。

### n8n 里怎么用？

用 HTTP Request 节点提交任务，Wait 节点等 10 秒，再用一个 HTTP Request 节点查询任务，直到 `status` 是 `succeeded`，视频地址在 `content.video_url`。扣子（Coze）的做法是用提交和查询两个接口加上 Authorization 请求头建一个自定义插件，在工作流里调用。

### 在线的 AI 画布能用吗？

能自己填接口地址和 key 的就能用。很多在线画布只用它们自己的积分，不接受外部的 key。

### 在 Claude Code 或 Codex 里怎么用？

先把 key 放进环境变量 `HARYAI_KEY`，把下面这段发给 agent，在最后一行写上想要的画面。它会写一个小脚本，提交任务、轮询，把视频存到 `./out`。

```text
用 HaryAI 的 Seedance 2.5 帮我生成视频，接口和火山方舟一样。

- 接口地址：https://api.haryai.com/api/v3
- API key：在环境变量 HARYAI_KEY 里，用 "Authorization: Bearer" 传
- 模型：dreamina-seedance-2-5-260628
- 提交：POST /contents/generations/tasks，请求体按火山方舟的格式，一定写明 duration
- 查询：每 10 秒 GET 一次 /contents/generations/tasks/{id}，直到 status 是 succeeded 或 failed
- 成功后把 content.video_url 下载到 ./out 并打开（链接 24 小时后失效）
- 接口、状态和错误码：https://haryai.com/docs/video.md

我想要的画面：
```

Claude Code 照常用你自己的 Claude 订阅，只有视频从 HaryAI 余额扣费。Codex 不用先切换到 DeepSeek。详见 [在 Claude Code 里用 Seedance 2.5](https://haryai.com/zh/seedance-2-5-claude?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api) 和 [在 Codex 里用 Seedance 2.5](https://haryai.com/zh/seedance-2-5-codex?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)。

### 计费 token 怎么算？

计费 token =（输入视频秒数 + 输出秒数）× 宽 × 高 × 24 / 1024。参考图片不计费。任务完成后，`usage.completion_tokens` 和 `usage.total_tokens` 里就是计费 token。

### 为什么要写明时长？

提交时会先从余额预扣。不写 `duration`，会按最长的 30 秒预扣，余额不够会被拒绝。任务结束后按实际用量结算，多扣的退回。

### 生成失败扣钱吗？

不扣。失败或超时的任务全额退款，审核没通过的也一样。改一下提示词或参考素材再提交就行。

### 成片链接能用多久？

任务完成后 24 小时内有效，请在这之前保存。火山方舟格式的 `content.video_url` 下载不需要 key，OpenAI 格式的 `/v1/videos/<id>/content` 需要带 key。

### 报错是什么意思？

key、模型和余额相关的错误：

| Status | Code | Meaning |
|---|---|---|
| 401 | (empty) | Missing or invalid key |
| 400 / 503 | `model_not_found` | Model not available to your account / not available now |
| 403 | `insufficient_user_quota` | Balance too low for the hold (set `duration` to lower it) |

火山方舟格式的任务错误：

| Status | Code | Meaning |
|---|---|---|
| 400 | `InvalidParameter` | Bad field, e.g. an unsupported resolution or a refused field |
| 401 | `AuthenticationError` | |
| 403 | `AccessDenied` | |
| 404 | `NotFound` | Task not found (`Task not found`) |
| 429 | `RateLimitExceeded` | The model provider is busy; retry after a few seconds |
| 5xx | `InternalServiceError` | `Task request failed`; retry later |

401 是 key 缺失或无效；`insufficient_user_quota` 是余额不够预扣，写明 `duration` 可以降低预扣；`RateLimitExceeded` 是模型服务商繁忙，过几秒重试。失败的任务会带 `error: {code, message}`。详见 [docs/video.md](https://haryai.com/docs/video.md)。

## 链接

- [Seedance 2.5](https://haryai.com/zh/seedance-2-5?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)，[Seedance 2.5 Flash](https://haryai.com/zh/seedance-2-5-flash?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)
- [Seedance API 价格](https://haryai.com/zh/seedance-api-pricing?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)
- [视频接口文档](https://haryai.com/docs/video.md)，[对话接口文档](https://haryai.com/docs/api.md)，[llms.txt](https://haryai.com/llms.txt)
- [seedance-skill](https://github.com/haryai-com/seedance-skill)：Claude Code 和 Codex 用的 Seedance 2.5 skill
- [seedance-comfyui](https://github.com/haryai-com/seedance-comfyui)：在 ComfyUI 里用（ComfyUI Manager 里能搜到）
- [n8n-nodes-haryai](https://github.com/haryai-com/n8n-nodes-haryai)：在 n8n 里用（npm 包 `n8n-nodes-haryai`）
- [deepseek-codex-claude-code](https://github.com/haryai-com/deepseek-codex-claude-code)：在 Codex 和 Claude Code 里用 DeepSeek V4
- [nano-banana-api](https://github.com/haryai-com/nano-banana-api)：用 OpenAI 图片接口或 Gemini 原生格式调 Nano Banana 2.1 和 2

## 许可

MIT，见 [LICENSE](LICENSE)。

价格截至 2026-11-23。

<!-- 由 build.mjs 于 2026-11-23 生成，数据来自 https://haryai.com/llms.txt（价格标记之间的 Seedance 2.5 video 一节）、https://haryai.com/docs/video.md 和 https://haryai.com/zh/seedance-2-5 上的 agent 提示词。请改 build.mjs，不要直接改本文件。 -->
