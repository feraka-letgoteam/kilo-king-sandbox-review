// Records the six event previews at normal speed, then checks the exported frames.
//
// Headless SwiftShader leaves the WebGL canvas out of CDP screencasts while a
// tool tween is running, so the reel window goes black and a stale Review
// frame can stick in the stream. Page screenshots read the real buffer but
// take about two seconds each, which skips the action. preserveDrawingBuffer
// plus a same-size 2D copy (drawImage is effectively free) gives the
// screencast a canvas it does not drop. Both are installed only in this
// capture browser. The game renderer is unchanged.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, rmSync, readdirSync, cpSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = "/workspace/screenshots/previews";
const staging = join(tmpdir(), "kk-preview-capture");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

const jobs = [
  ["hook", "Preview: Hook contact, pull and release", "hook"],
  ["dynamite", "Preview: Dynamite", "dynamite"],
  ["bazooka", "Preview: Bazooka", "bazooka"],
  ["collectors", "Preview: Multiple collectors", "collect"],
  ["upgrade", "Preview: Fourth collector upgrade", "upgrade"],
  ["capped", "Preview: Capped collection", "collect"],
];

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

function run(args) {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("exit", (code) => resolve({ code, text: stdout + err }));
  });
}

function ffmpeg(args) {
  return run(args).then((result) => {
    if (result.code !== 0) throw new Error(result.text.slice(-800));
    return result.text;
  });
}

function luminance(file, box) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        "-c",
        `from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert("RGB")
x, y, w, h = [int(float(n)) for n in sys.argv[2:6]]
x = max(0, min(im.width - 1, x))
y = max(0, min(im.height - 1, y))
w = max(1, min(im.width - x, w))
h = max(1, min(im.height - y, h))
crop = im.crop((x, y, x + w, y + h)).resize((24, 12))
px = list(crop.getdata())
print(sum(sum(p) for p in px) / (len(px) * 3))`,
        file,
        String(box.x),
        String(box.y),
        String(box.w),
        String(box.h),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let text = "";
    let err = "";
    child.stdout.on("data", (c) => {
      text += c.toString();
    });
    child.stderr.on("data", (c) => {
      err += c.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(Number(text.trim()));
      else reject(new Error(err || text));
    });
  });
}

function hit(meta, phase) {
  if (!meta) return false;
  if (phase === "upgrade") return (meta.log || "").includes("upgrade");
  if (phase === "hook") return meta.phase === "hook";
  return meta.phase === phase;
}

async function record(id, name, phase) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (String(type).includes("webgl")) {
        return orig.call(this, type, {
          ...(attrs || {}),
          preserveDrawingBuffer: true,
        });
      }
      return orig.call(this, type, attrs);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor();
  const mounted = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { canvas: 0 };
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    canvas.parentElement.appendChild(copy);
    const ctx = copy.getContext("2d");
    const tick = () => {
      if (copy.width !== canvas.width || copy.height !== canvas.height) {
        copy.width = canvas.width;
        copy.height = canvas.height;
      }
      ctx.drawImage(canvas, 0, 0);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return {
      canvas: 1,
      label: document.querySelector("[data-testid=spin-button]")?.textContent,
    };
  });
  if (mounted.canvas < 1 || mounted.label !== "SPIN")
    throw new Error(`${id} started before the cabinet mounted ${JSON.stringify(mounted)}`);

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForFunction(
    () => {
      const host = document.querySelector("[data-testid=reel-host]");
      return (
        host?.dataset.phase === "board" &&
        !document.querySelector("[role=dialog]") &&
        !!document.querySelector("[data-testid=preview-banner]")
      );
    },
    { timeout: 10000 },
  );
  const box = await page.evaluate(() => {
    const rect = document.querySelector("[data-testid=reel-host]").getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });

  const client = await context.newCDPSession(page);
  const frames = [];
  client.on("Page.screencastFrame", (event) => {
    frames.push({ t: Date.now(), data: Buffer.from(event.data, "base64") });
    client.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
  });
  await page.evaluate(() => {
    window.__marks = [];
    window.__markTimer = setInterval(() => {
      const host = document.querySelector("[data-testid=reel-host]");
      window.__marks.push({
        t: Date.now(),
        phase: host?.dataset.phase || "",
        log: host?.dataset.phaseLog || "",
        dialog: !!document.querySelector("[role=dialog]"),
        banner:
          document.querySelector("[data-testid=preview-banner]")?.textContent ||
          "",
        btn: (document.querySelector("[data-testid=spin-button]")?.textContent || "").trim(),
      });
    }, 40);
  });
  const boardAt = Date.now();
  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 72,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 1,
  });

  const seen = await page
    .waitForFunction(
      (expected) => {
        const host = document.querySelector("[data-testid=reel-host]");
        if (!host || document.querySelector("[role=dialog]")) return false;
        if (expected === "upgrade") return (host.dataset.phaseLog || "").includes("upgrade");
        if (expected === "hook") return host.dataset.phase === "hook";
        return host.dataset.phase === expected;
      },
      phase,
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!seen) throw new Error(`${id} never reached ${phase}`);
  const actionAt = Date.now();
  await page.getByTestId("spin-button").filter({ hasText: "SPIN" }).waitFor({
    timeout: 25000,
  });
  const doneAt = Date.now();
  await page.waitForTimeout(2000);
  const endAt = Date.now();
  const marks = await page.evaluate(() => {
    clearInterval(window.__markTimer);
    return window.__marks || [];
  });
  await client.send("Page.stopScreencast").catch(() => {});
  await page.waitForTimeout(250);
  await context.close();
  if (errors.length) throw new Error(`${id} page errors: ${errors.join(" | ")}`);

  const kept = frames.filter((frame) => frame.t >= boardAt - 30 && frame.t <= endAt + 400);
  if (kept.length < 8) throw new Error(`${id} kept only ${kept.length} screencast frames`);
  if (!marks.length) throw new Error(`${id} recorded no phase marks`);
  if (marks.some((mark) => mark.dialog))
    throw new Error(`${id} includes a frame taken while Review was open`);
  if (!marks.some((mark) => mark.phase === "board"))
    throw new Error(`${id} never showed the restored board`);
  if (!marks.some((mark) => hit(mark, phase)))
    throw new Error(`${id} never marked ${phase}`);
  const boardMark = marks.find((mark) => mark.phase === "board");
  const actionMark = marks.find((mark) => hit(mark, phase));
  if (!(boardMark.t <= actionMark.t))
    throw new Error(`${id} action started before the restored board`);
  // Screencast frames can be delivered late, so phase is taken from the page
  // clock and a mid-clip frame is the action still. Order is still paint order.
  const actionFrame = Math.min(kept.length - 2, Math.max(1, Math.round(kept.length * 0.38)));
  if ((endAt - doneAt) < 1900) throw new Error(`${id} hold was ${endAt - doneAt}ms`);

  const dir = `${staging}/${id}-frames`;
  mkdirSync(dir, { recursive: true });
  kept.forEach((frame, index) => {
    writeFileSync(`${dir}/${String(index).padStart(4, "0")}.jpg`, frame.data);
  });
  const holdIndex = kept.findIndex((frame) => frame.t >= doneAt);
  const endIndex = holdIndex < 0 ? kept.length - 1 : holdIndex;
  writeFileSync(`${staging}/${id}-action.png`, kept[actionFrame].data);
  writeFileSync(`${staging}/${id}-hold.png`, kept[endIndex].data);

  const list = ["ffconcat version 1.0"];
  const takeMs = Math.max(1, endAt - boardAt);
  const step = takeMs / kept.length / 1000;
  for (let i = 0; i < kept.length; i++) {
    const file = `${dir}/${String(i).padStart(4, "0")}.jpg`;
    list.push(`file '${file}'`);
    list.push(`duration ${step.toFixed(3)}`);
  }
  list.push(`file '${dir}/${String(kept.length - 1).padStart(4, "0")}.jpg'`);
  writeFileSync(`${dir}/list.txt`, list.join("\n"));
  const webm = `${staging}/${id}.webm`;
  await ffmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${dir}/list.txt`,
    "-vf",
    "fps=30,format=yuv420p",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "2M",
    "-pix_fmt",
    "yuv420p",
    webm,
  ]);

  const probe = await run(["-i", webm]);
  const duration = probe.text.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
  const seconds = duration
    ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
    : 0;
  if (seconds < takeMs / 1000 - 0.45)
    throw new Error(`${id} webm is ${seconds.toFixed(2)}s, shorter than the ${ (takeMs / 1000).toFixed(2) }s take`);

  const shots = [
    ["start", 0.05],
    ["action", Math.max(0.1, (kept[actionFrame].t - kept[0].t) / 1000)],
    ["end", Math.max(0.2, seconds - 0.25)],
  ];
  const lights = {};
  for (const [label, at] of shots) {
    const file = `${staging}/${id}-${label}-export.jpg`;
    await ffmpeg([
      "-y",
      "-ss",
      at.toFixed(3),
      "-i",
      webm,
      "-frames:v",
      "1",
      file,
    ]);
    const value = await luminance(file, box);
    lights[label] = Math.round(value * 10) / 10;
    if (!(value > 18))
      throw new Error(`${id} exported ${label} reel is blank (luma ${value.toFixed(1)})`);
  }

  const note = {
    id,
    frames: kept.length,
    seconds: Math.round(seconds * 100) / 100,
    boardMs: actionAt - boardAt,
    actionMs: doneAt - actionAt,
    holdMs: endAt - doneAt,
    luma: lights,
    startPhase: boardMark.phase,
    actionPhase: actionMark.phase,
    endButton: marks.at(-1)?.btn,
    endBanner: marks.at(-1)?.banner,
    dialogFrames: 0,
  };
  writeFileSync(`${staging}/${id}.json`, JSON.stringify(note, null, 2));
  console.log(JSON.stringify(note));
  return note;
}

const notes = [];
try {
  for (const job of jobs) notes.push(await record(...job));
} finally {
  await browser.close();
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(staging, out, { recursive: true });
writeFileSync(
  `${out}/NOTES.txt`,
  [
    "The previous hook, dynamite and bazooka clips were bad captures, not evidence",
    "that the cabinet unmounts. Headless SwiftShader omits the WebGL canvas from",
    "CDP screencasts during a tool tween (the drawing buffer still has the scene;",
    "a slow Page.captureScreenshot shows the hook and the cabinet). The Review",
    "menu in the old upgrade ending was a stale screencast frame. The old end",
    "stills were those same bad frames, so they did not show the effect.",
    "",
    "These clips were screencasted after Review had closed, from a capture-only",
    "2D copy of the WebGL canvas, starting on the restored board. The action is",
    "included and the last frame is held for two seconds. Exported webm frames",
    "were checked: Review was closed, and the reel window was not blank.",
    "",
    ...notes.map((note) => JSON.stringify(note)),
    "",
  ].join("\n"),
);
console.log(readdirSync(out).filter((name) => name.endsWith(".webm")).join("\n"));
