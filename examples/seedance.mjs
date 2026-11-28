#!/usr/bin/env node
// Seedance 2.5 through HaryAI (Volcengine Ark format): submit a task, poll
// every 10 seconds, download the video. Node 18 or later, no dependencies.
//
//   export HARYAI_KEY=...            # from your HaryAI account page
//   node examples/seedance.mjs "A paper boat sailing down a rain gutter, close up" \
//     --duration 5 --resolution 720p --ratio 16:9
//
// Options: --model <id>  --duration <4-30>  --resolution <480p|720p|1080p>
//          --ratio <16:9|9:16|1:1|...>  --audio  --image <url>  --out <dir>
// API reference: https://haryai.com/docs/video.md

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://api.haryai.com/api/v3";
const POLL_SECONDS = 10;

const key = process.env.HARYAI_KEY;
if (!key) {
  console.error("Set HARYAI_KEY to your HaryAI API key.");
  process.exit(1);
}

const opts = { model: "doubao-seedance-2-5-260628", duration: "5", resolution: "720p", ratio: "16:9", out: "out", audio: false, image: [] };
const words = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--audio") opts.audio = true;
  else if (a === "--image") opts.image.push(argv[++i]);
  else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
  else words.push(a);
}
const prompt = words.join(" ");
if (!prompt) {
  console.error('Usage: node examples/seedance.mjs "<prompt>" [--duration 5] [--resolution 720p] [--ratio 16:9]');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// 1. Submit. Always send duration: without it the longest clip is held from the balance.
const body = {
  model: opts.model,
  content: [{ type: "text", text: prompt }, ...opts.image.map((url) => ({ type: "image_url", image_url: { url } }))],
  duration: Number(opts.duration),
  resolution: opts.resolution,
  ratio: opts.ratio,
  generate_audio: opts.audio,
};
const submit = await fetch(`${BASE}/contents/generations/tasks`, { method: "POST", headers, body: JSON.stringify(body) });
const submitted = await submit.json().catch(() => ({}));
if (!submit.ok || !submitted.id) {
  console.error(`Submit failed (${submit.status}):`, JSON.stringify(submitted));
  process.exit(1);
}
const id = submitted.id;
console.log(`task ${id} submitted, polling every ${POLL_SECONDS} s`);

// 2. Poll until succeeded or failed. 429, 5xx and dropped connections are retried:
//    the task keeps running on the server.
let task;
for (;;) {
  await sleep(POLL_SECONDS);
  let res;
  try {
    res = await fetch(`${BASE}/contents/generations/tasks/${id}`, { headers });
  } catch {
    continue;
  }
  if (res.status === 429 || res.status >= 500) continue;
  task = await res.json();
  if (!res.ok) {
    console.error(`Poll failed (${res.status}):`, JSON.stringify(task));
    process.exit(1);
  }
  console.log(task.status);
  if (task.status === "succeeded" || task.status === "failed") break;
}
if (task.status === "failed") {
  // The hold is refunded in full for failed, cancelled, expired or moderated tasks.
  console.error("failed:", JSON.stringify(task.error));
  process.exit(1);
}

// 3. Download. The link needs no key, redirects to storage and expires after
//    24 hours. A cut-off download is tried again.
await mkdir(opts.out, { recursive: true });
const file = join(opts.out, `${id}.mp4`);
for (let attempt = 1; ; attempt++) {
  try {
    const video = await fetch(task.content.video_url);
    if (!video.ok) throw new Error(`HTTP ${video.status}`);
    await writeFile(file, Buffer.from(await video.arrayBuffer()));
    break;
  } catch (e) {
    if (attempt === 5) {
      console.error(`Download failed: ${e.message}`);
      process.exit(1);
    }
    await sleep(5);
  }
}
console.log(`saved ${file}`, task.usage ? `(billing tokens: ${task.usage.total_tokens})` : "");
