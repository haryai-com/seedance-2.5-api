# Seedance 2.5 API through HaryAI

[中文](README.zh-CN.md)

Use Seedance 2.5 and Seedance 2.5 Flash through [HaryAI](https://haryai.com/en/seedance-2-5?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api) at 12% off BytePlus's official price, with a Volcengine Ark compatible API (and an OpenAI Videos compatible one). You don't need a BytePlus or Volcengine account: one HaryAI key is enough.

This repo shows how to call it: curl, a zero-dependency Node script, and answers to common questions. The full reference is [docs/video.md](https://haryai.com/docs/video.md).

## Models

| Model | Model id | Resolutions | Duration |
|---|---|---|---|
| Seedance 2.5 | `dreamina-seedance-2-5-260628` | 480p, 720p, 1080p | 4 to 30 s |
| Seedance 2.5 Flash | `dreamina-seedance-2-5-flash-261115` | 480p, 720p | 4 to 30 s |
| Seedance 2.5 | `dreamina-seedance-2-5-260628-unlock` | 480p, 720p, 1080p | 4 to 30 s |
| Seedance 2.5 Flash | `dreamina-seedance-2-5-flash-261115-unlock` | 480p, 720p | 4 to 30 s |

Always set `duration` (or `seconds`). Sound is generated on request, at the same price with or without it.

## Price per second

US dollars per second of 16:9 output, no reference video. 12% off the official BytePlus price, paid from your HaryAI balance.

| Model | Resolution | Official | HaryAI | 5 s clip on HaryAI |
|---|---|---|---|---|
| Seedance 2.5 | 480p | $0.103 | $0.09 | $0.45 |
| Seedance 2.5 | 720p | $0.231 | $0.203 | $1.02 |
| Seedance 2.5 | 1080p | $0.569 | $0.50 | $2.50 |
| Seedance 2.5 Flash | 480p | $0.067 | $0.059 | $0.30 |
| Seedance 2.5 Flash | 720p | $0.151 | $0.133 | $0.67 |

With a reference video the per-second price is lower, and the reference video's length is billed too. Current prices: [Seedance API pricing](https://haryai.com/en/seedance-api-pricing?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api).

### Unlocked version, 6% off the official price

The same models with fewer content limits. Add -unlock to the model name, as in `dreamina-seedance-2-5-260628-unlock`. Content review still applies, and a refused task is refunded in full.

| Model | Resolution | Official | HaryAI | 5 s clip on HaryAI |
|---|---|---|---|---|
| Seedance 2.5 | 480p | $0.103 | $0.097 | $0.48 |
| Seedance 2.5 | 720p | $0.231 | $0.217 | $1.09 |
| Seedance 2.5 | 1080p | $0.569 | $0.535 | $2.67 |
| Seedance 2.5 Flash | 480p | $0.067 | $0.063 | $0.32 |
| Seedance 2.5 Flash | 720p | $0.151 | $0.142 | $0.71 |

## Quick start

1. Sign up at [haryai.com](https://haryai.com/en/signup?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api). A verified new account gets $0.50 of balance, enough for a 5 second 480p clip on Seedance 2.5 ($0.45).
2. Copy your API key from the account page and set it: `export HARYAI_KEY=...`

Video generation is an asynchronous task: submit, get a task id, poll until it finishes, then download.

### Ark format (base URL `https://api.haryai.com/api/v3`)

Submit:

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

The reply is `{"id": "<task id>"}`. Poll until `status` is `succeeded` or `failed`:

```sh
curl https://api.haryai.com/api/v3/contents/generations/tasks/<task id> \
  -H "Authorization: Bearer $HARYAI_KEY"
```

On `succeeded`, `content.video_url` is the video. It needs no API key and expires after 24 hours:

```sh
curl -L -o video.mp4 "<content.video_url>"
```

To check several tasks in one request, or whether a submit that lost its reply was created, list your tasks from the last 7 days. Filters: `filter.status`, `filter.model` and `filter.task_ids` (repeat it for several ids):

```sh
curl "https://api.haryai.com/api/v3/contents/generations/tasks?page_size=20&filter.status=succeeded" \
  -H "Authorization: Bearer $HARYAI_KEY"
```

### OpenAI Videos format (base URL `https://api.haryai.com/v1`)

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

`size` is `WIDTHxHEIGHT`; the longer side picks the tier: 1920 or more is 1080p, 1280 or more is 720p, anything smaller is 480p. `status` is `queued`, `in_progress`, `completed` or `failed`.

### Node 18, no dependencies

[`examples/seedance.mjs`](examples/seedance.mjs) submits a task, polls every 10 seconds and saves the MP4 to `./out`. It reads the key from `HARYAI_KEY`.

```sh
export HARYAI_KEY=...
node examples/seedance.mjs "A paper boat sailing down a rain gutter, close up" --duration 5 --resolution 720p --ratio 16:9
```

Options: `--model`, `--duration`, `--resolution`, `--ratio`, `--audio`, `--image <url>` (repeatable), `--out`.

## Questions

### How do I call the Seedance 2.5 API?

Send an Ark request to `https://api.haryai.com/api/v3/contents/generations/tasks` with `Authorization: Bearer <HARYAI_KEY>` and model `dreamina-seedance-2-5-260628` (or `dreamina-seedance-2-5-flash-261115` for Flash). Poll `/contents/generations/tasks/<id>` until `succeeded`, then download `content.video_url`. Tools that only speak the OpenAI format use `https://api.haryai.com/v1` and `/v1/videos`.

### How much does Seedance 2.5 cost per second?

Seedance 2.5: 480p $0.09, 720p $0.203, 1080p $0.50 per second (official 480p $0.103, 720p $0.231, 1080p $0.569). Seedance 2.5 Flash: 480p $0.059, 720p $0.133 per second (official 480p $0.067, 720p $0.151). That is 12% off BytePlus's official price, for 16:9 output, no reference video.

### Do I need a BytePlus or Volcengine account?

No. Your HaryAI key is enough. You don't open an account, verify a company or apply for access.

### Is it the full Seedance 2.5?

Yes. Every request goes to the official model. Each task's reply shows the tokens it used.

### Does a Coding Plan cover video?

No. Video is paid from the balance only. The HaryAI Coding Plan is for DeepSeek.

### Is there a discount for large purchases?

Yes. Write to support@haryai.com for a direct top-up at a bigger discount.

### How do I use Seedance 2.5 in ComfyUI?

The built-in Seedance node bills Comfy's own credits, so install a community video node that takes a Volcengine Ark base URL and an API key. Fill in base URL `https://api.haryai.com/api/v3`, your HaryAI key and model `dreamina-seedance-2-5-260628`, plus resolution, ratio, duration (4 to 30 seconds) and generate audio. Nodes that only sign in to their own service won't take the key. Guide: [Seedance 2.5 in ComfyUI and n8n](https://haryai.com/en/seedance-2-5-comfyui?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api).

### How do I use Seedance 2.5 in n8n?

An HTTP Request node posts the task, a Wait node pauses 10 seconds, and a second HTTP Request node reads the task until `status` is `succeeded`. The video is at `content.video_url`. In Coze, create a custom plugin with the two endpoints (submit, query) and the Authorization header.

### Does it work in hosted AI canvases?

Only in those that let you enter your own base URL and key. Many hosted canvases run on their own credits and take no outside key.

### How do I use it from Claude Code or Codex?

Put your key in `HARYAI_KEY`, then paste this to the agent with what you want in the last line. It writes a short script, submits the task, polls and saves the clip to `./out`.

```text
Make a video with Seedance 2.5 through HaryAI. The API is the same as BytePlus ModelArk (Volcengine Ark).

- Base URL: https://api.haryai.com/api/v3
- API key: in the environment variable HARYAI_KEY, sent as "Authorization: Bearer"
- Model: dreamina-seedance-2-5-260628
- Submit: POST /contents/generations/tasks with a ModelArk request body. Always set duration.
- Poll: GET /contents/generations/tasks/{id} every 10 seconds until status is succeeded or failed.
- When it succeeds, download content.video_url into ./out (the link expires after 24 hours) and open the file.
- Reference, statuses and error codes: https://haryai.com/docs/video.md

What I want:
```

Claude Code runs on your own Claude plan as usual; only the video is paid from your HaryAI balance. Codex doesn't need to switch to DeepSeek first. Guides: [Seedance 2.5 in Claude Code](https://haryai.com/en/seedance-2-5-claude?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api), [Seedance 2.5 in Codex](https://haryai.com/en/seedance-2-5-codex?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api).

### How are billing tokens calculated?

Billing tokens = (input video seconds + output seconds) × width × height × 24 / 1024. Reference images add nothing. A finished task shows them in `usage.completion_tokens` and `usage.total_tokens`.

### Why should I set the duration?

On submit the price is held from the balance. Without `duration` the hold is for the longest clip (30 s), and a small balance can be refused. When the task finishes you are charged for the real usage.

### Am I charged for a failed video?

No. A failed or timed-out task is refunded in full. So is a task turned down by content moderation; change the prompt or the reference and submit again.

### How long is the video link valid?

24 hours after the task finishes. The Ark `content.video_url` needs no key. The OpenAI format `/v1/videos/<id>/content` needs the key.

### What do the errors mean?

Key, model and balance errors:

| Status | Code | Meaning |
|---|---|---|
| 401 | (empty) | Missing or invalid key |
| 400 / 503 | `model_not_found` | Model not available to your account / not available now |
| 403 | `insufficient_user_quota` | Balance too low for the hold (set `duration` to lower it) |

Ark-format task errors:

| Status | Code | Meaning |
|---|---|---|
| 400 | `InvalidParameter` | Bad field, e.g. an unsupported resolution or a refused field |
| 401 | `AuthenticationError` | |
| 403 | `AccessDenied` | |
| 404 | `NotFound` | Task not found (`Task not found`) |
| 429 | `RateLimitExceeded` | The model provider is busy; retry after a few seconds |
| 5xx | `InternalServiceError` | `Task request failed`; retry later |

A failed task has `error: {code, message}`. Details: [docs/video.md](https://haryai.com/docs/video.md).

## Links

- [Seedance 2.5](https://haryai.com/en/seedance-2-5?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api), [Seedance 2.5 Flash](https://haryai.com/en/seedance-2-5-flash?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)
- [Seedance API pricing](https://haryai.com/en/seedance-api-pricing?utm_source=github&utm_medium=readme&utm_campaign=seedance-2.5-api)
- [Video API reference](https://haryai.com/docs/video.md), [Chat API reference](https://haryai.com/docs/api.md), [llms.txt](https://haryai.com/llms.txt)
- [seedance-skill](https://github.com/sunsiyuan/seedance-skill): Seedance 2.5 as a Claude Code and Codex skill
- [seedance-comfyui](https://github.com/sunsiyuan/seedance-comfyui): the same in ComfyUI (in ComfyUI Manager)
- [n8n-nodes-haryai](https://github.com/sunsiyuan/n8n-nodes-haryai): the same in n8n (npm `n8n-nodes-haryai`)
- [deepseek-codex-claude-code](https://github.com/sunsiyuan/deepseek-codex-claude-code): DeepSeek V4 in Codex and Claude Code
- [nano-banana-api](https://github.com/sunsiyuan/nano-banana-api): Nano Banana 2.1 and 2 through the OpenAI images API or Gemini's own format

## License

MIT. See [LICENSE](LICENSE).

Prices as of 2026-11-23.

<!-- Generated by build.mjs on 2026-11-23 from https://haryai.com/llms.txt (Seedance 2.5 video section between the price markers), https://haryai.com/docs/video.md and the agent prompt on https://haryai.com/en/seedance-2-5. Edit build.mjs, not this file. -->
