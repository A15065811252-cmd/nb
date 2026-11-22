import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import chapters from "../src/original.json" with {type: "json"};

const [piperPath, modelPath, ffmpegPath] = process.argv.slice(2).map((path) => resolve(path));
if (!piperPath || !modelPath || !ffmpegPath) {
  throw new Error("Usage: node tools/generate-narration.mjs <piper.exe> <voice.onnx> <ffmpeg.exe>");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const workDir = await mkdtemp(join(tmpdir(), "bondage-narration-"));
const audioDir = join(root, "assets", "narration");
await mkdir(audioDir, {recursive: true});

function run(program, args, input) {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, {
      cwd: dirname(program), windowsHide: true, stdio: [input ? "pipe" : "ignore", "ignore", "pipe"]
    });
    let message = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (part) => { message = (message + part).slice(-1600); });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      if (status === 0) accept();
      else reject(new Error(program + " exited with " + (signal ?? status) + "\n" + message));
    });
    if (input) {
      child.stdin.on("error", (error) => { if (error.code !== "EPIPE") reject(error); });
      child.stdin.end(input, "utf8");
    }
  });
}

function pcmFromWave(wave) {
  let rate = 0;
  for (let index = 12; index + 8 <= wave.length;) {
    const tag = wave.toString("ascii", index, index + 4);
    const length = wave.readUInt32LE(index + 4);
    const data = index + 8;
    if (data + length > wave.length) break;
    if (tag === "fmt ") {
      if (wave.readUInt16LE(data) !== 1 || wave.readUInt16LE(data + 2) !== 1 ||
          wave.readUInt16LE(data + 14) !== 16) throw new Error("Expected mono 16-bit PCM");
      rate = wave.readUInt32LE(data + 4);
    }
    if (tag === "data" && rate && length) return {rate, pcm: wave.subarray(data, data + length)};
    index = data + length + (length % 2);
  }
  throw new Error("No usable PCM in Piper output");
}

const sources = chapters.flatMap(({number, paragraphs}) => paragraphs.map((paragraph, index) => ({
  text: paragraph.replace(/\s+/g, " ").trim(),
  // Piper's Windows CLI opens filenames through the system code page.
  output_file: join(workDir, number + "-" + index + ".wav")
})));
console.log("Synthesizing " + sources.length + " paragraphs with Piper.");
await run(piperPath, ["--model", modelPath, "--json-input", "--sentence-silence", "0.18"],
  sources.map((source) => JSON.stringify(source)).join("\n") + "\n");

const narration = [];
for (const chapter of chapters) {
  const pcmParts = [];
  let frames = 0;
  let sampleRate;
  const clips = [];
  for (const index of chapter.paragraphs.keys()) {
    const {rate, pcm} = pcmFromWave(await readFile(join(workDir, chapter.number + "-" + index + ".wav")));
    sampleRate ??= rate;
    if (sampleRate !== rate) throw new Error("Inconsistent narrator sample rate");
    const pauseFrames = Math.round(rate * .42);
    clips.push([frames / rate, (frames + pcm.length / 2) / rate].map((value) => Number(value.toFixed(4))));
    pcmParts.push(pcm, Buffer.alloc(pauseFrames * 2));
    frames += pcm.length / 2 + pauseFrames;
  }
  const baseName = "chapter-" + String(chapter.number).padStart(2, "0");
  const temporaryTrack = join(workDir, baseName + ".pcm");
  const temporaryEncoded = join(workDir, baseName + ".ogg");
  await writeFile(temporaryTrack, Buffer.concat(pcmParts));
  await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", String(sampleRate),
    "-ac", "1", "-i", temporaryTrack, "-c:a", "libopus", "-b:a", "32k", "-application", "audio", "-y", temporaryEncoded]);
  await writeFile(join(audioDir, baseName + ".ogg"), await readFile(temporaryEncoded));
  narration.push({file: "assets/narration/" + baseName + ".ogg", clips});
  console.log("Chapter " + chapter.number + " has " + clips.length + " narration cues.");
}
await writeFile(join(root, "src", "narration.json"), JSON.stringify(narration, null, 2) + "\n");
