import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {chromium} from "playwright-core";
import {acts, chapters} from "../src/story.js";
import {districts} from "../src/map.js";
import narration from "../src/narration.json" with {type: "json"};
import {Vector3} from "three";
import {createCharacterPhysics, initializePhysics} from "../src/physics.js";

await initializePhysics();
const floors = [{x: 0, z: 0, w: 11.10, d: 3, top: 0}, {x: 11.10, z: 0, w: 11.10, d: 3, top: -.68}];
for (let i = 0; i < 4; i++) floors.push({x: 5.71 + i * .32, z: 0, w: .35, d: 1.94, top: -.17 * (i + 1) + .0175});
const stairTest = createCharacterPhysics({floors, obstacles: [], doors: [], eyeHeight: 1.30});
try {
  const traveler = new Vector3(4.6, 1.3, 0);
  stairTest.sync(traveler);
  for (let i = 0; i < 72; i++) stairTest.move(traveler, .043, 0, 1 / 60);
  assert.ok(traveler.x > 7 && Math.abs(traveler.y - .62) < .025, "The player should step down onto the lower floor.");
  for (let i = 0; i < 72; i++) stairTest.move(traveler, -.043, 0, 1 / 60);
  assert.ok(traveler.x < 5.3 && Math.abs(traveler.y - 1.30) < .025, "The player should climb back onto the upper floor.");
} finally {
  stairTest.free();
}
let doorAngle = 0;
const movingDoor = {
  width: 2, height: 2.7,
  leafPose: () => ({
    position: {x: -1 + Math.cos(doorAngle), y: 1.35, z: -Math.sin(doorAngle)},
    rotation: {x: 0, y: Math.sin(doorAngle / 2), z: 0, w: Math.cos(doorAngle / 2)}
  })
};
const doorTest = createCharacterPhysics({floors: [{x: 0, z: 0, w: 6, d: 6, top: 0}],
  obstacles: [], doors: [movingDoor], eyeHeight: 1.30});
try {
  const traveler = new Vector3(0, 1.3, 1.4);
  doorTest.sync(traveler);
  for (let i = 0; i < 42; i++) doorTest.move(traveler, 0, -.043, 1 / 60);
  assert.ok(traveler.z > .22, "A shut leaf should block motion.");
  doorAngle = Math.PI / 2;
  for (let i = 0; i < 42; i++) doorTest.move(traveler, 0, -.043, 1 / 60);
  assert.ok(traveler.z < -.75, "The controller must use the rotated leaf after opening.");
} finally {
  doorTest.free();
}

const browserPath = [
  process.env.BONDAGE_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
].find((candidate) => candidate && existsSync(candidate));
assert.ok(browserPath, "Set BONDAGE_BROWSER to a Chromium-based browser executable.");
assert.equal(acts.length, 8);
assert.deepEqual(acts.map((act) => act.first), [1, ...acts.slice(0, -1).map((act) => act.last + 1)]);
assert.equal(acts.at(-1).last, 122);
assert.equal(chapters.length, 21);
assert.deepEqual(districts.flatMap(({sites}) => sites.flatMap(({chapters}) => chapters)).sort((a,b) => a - b), chapters.map(({number}) => number));
assert.equal(chapters.reduce((count, chapter) => count + chapter.paragraphs.length, 0), 745);
for (const chapter of chapters) {
  const track = narration[chapter.number - 1];
  assert.ok(existsSync(new URL("../" + track.file, import.meta.url)));
  assert.equal(track.clips.length, chapter.paragraphs.length);
  assert.ok(track.clips.every(([start, end], index) => end > start && start >= (track.clips[index - 1]?.[1] ?? 0)));
  const starts = chapter.beats.map(([start]) => start);
  assert.equal(starts.length, 3);
  assert.equal(starts[0], 0);
  assert.ok(starts[1] > starts[0] && starts[2] > starts[1] && starts[2] < chapter.paragraphs.length);
  assert.equal(chapter.questions.length, 2);
  for (const [index, , options, answer] of chapter.questions) {
    assert.ok(chapter.paragraphs[index]);
    assert.equal(options.length, 3);
    assert.ok(options[answer]);
  }
  const [line, example] = chapter.readingNote;
  assert.ok(chapter.paragraphs[line].includes(example), "Missing reading note source " + chapter.number);
  for (const [word] of chapter.terms) {
    assert.ok(chapter.paragraphs.join(" ").toLowerCase().includes(word.toLowerCase()), "Missing glossary source " + word);
  }
}

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking"]
});
const url = new URL("../index.html", import.meta.url).href;
const errors = [];

try {
  const page = await browser.newPage({viewport: {width: 1440, height: 950}});
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith("file:")) errors.push("Nonlocal request: " + request.url());
  });
  await page.addInitScript(() => {
    window.playedSoundFiles = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return originalPlay.call(this).then(() => { window.playedSoundFiles.push(this.src); });
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...options) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        connect.call(this, analyser);
        window.sceneAnalyser = analyser;
      }
      return connect.call(this, destination, ...options);
    };
  });
  await page.goto(url);
  await page.locator("#stage[data-physics=rapier]").waitFor({state: "attached"});
  await page.locator("#world-marker").waitFor({state: "visible"});
  assert.equal(await page.locator("#renderer-message").isVisible(), false);
  await page.keyboard.press("KeyZ");
  await page.locator("html[data-game-fullscreen]").waitFor({state: "attached"});
  assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true);
  assert.ok((await page.locator("#stage").boundingBox()).width > 1400);
  await page.keyboard.press("Escape");
  await page.locator("html[data-game-fullscreen]").waitFor({state: "detached"});
  await page.getByRole("button", {name: "全屏", exact: true}).click();
  await page.getByRole("button", {name: "退出全屏", exact: true}).click();
  await page.locator("html[data-game-fullscreen]").waitFor({state: "detached"});
  if (process.env.BONDAGE_SCREENSHOTS) await page.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-opening.png")});
  await page.getByRole("button", {name: "地图", exact: true}).click();
  assert.equal(await page.locator("#map-area-name").textContent(), "伦敦");
  await page.waitForFunction(() => {
    if (!window.sceneAnalyser) return false;
    const wave = new Float32Array(window.sceneAnalyser.fftSize);
    window.sceneAnalyser.getFloatTimeDomainData(wave);
    return wave.some((level) => Math.abs(level) > .005);
  });
  await page.getByRole("button", {name: "布莱克斯泰布尔", exact: true}).click();
  assert.equal(await page.locator(".site-control").count(), 2);
  await page.getByRole("button", {name: "前往地点", exact: true}).click();
  await page.waitForFunction(() => document.querySelector("#objective").textContent.includes("第 4 章解锁"));
  const door = page.locator("#door-marker");
  await door.waitFor({state: "visible"});
  assert.equal(await door.getAttribute("aria-label"), "开门");
  async function mapCoordinate(axis = "z") {
    return page.locator("#map-plan").evaluate((canvas, axis) => {
      const {width, height} = canvas;
      const {data} = canvas.getContext("2d").getImageData(0, 0, width, height);
      let x = 0;
      let z = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 56 && data[i + 1] === 77 && data[i + 2] === 57) {
          x += i / 4 % width + .5;
          z += Math.floor(i / 4 / width) + .5;
          count++;
        }
      }
      if (!count) return Infinity;
      return axis === "z" ? (z / count - height / 2) / 3.42 : (x / count - width / 2) / 4.45;
    }, axis);
  }
  const beforeDoor = await mapCoordinate();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(830);
  await page.keyboard.up("KeyW");
  const blocked = await mapCoordinate();
  assert.ok(blocked < beforeDoor - .8 && blocked > -6.35, "A closed door should stop the camera on the threshold.");
  await page.keyboard.press("KeyE");
  await page.locator('#door-marker[data-action="正在开门"]').waitFor({state: "visible"});
  await page.locator('#door-marker:is([data-action="关门"],[data-action="退开再关门"])').waitFor({state: "visible"});
  await page.waitForFunction(() => window.playedSoundFiles.some((path) => path.endsWith("/door-open.ogg")));
  assert.equal(await page.locator("#map-tab").getAttribute("aria-current"), "page");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(510);
  await page.keyboard.up("KeyW");
  assert.ok(await mapCoordinate() < blocked - .65, "An open doorway should let the player enter the foyer.");
  assert.equal(await page.locator("#map-tab").getAttribute("aria-current"), "page", "A locked location should keep the player on the map.");
  await page.keyboard.down("KeyS");
  await page.getByRole("button", {name: "关门", exact: true}).waitFor({state: "visible"});
  await page.keyboard.up("KeyS");
  await page.getByRole("button", {name: "关门", exact: true}).click();
  await page.locator('#door-marker[data-action="开门"]').waitFor({state: "visible"});
  await page.waitForFunction(() => window.playedSoundFiles.some((path) => path.endsWith("/door-close.ogg")));
  await page.getByRole("button", {name: "特坎伯里", exact: true}).click();
  assert.equal(await page.locator(".site-control").count(), 3);
  await page.locator("#world-marker").waitFor({state: "visible"});
  if (process.env.BONDAGE_SCREENSHOTS) await page.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-map.png")});
  await page.getByRole("button", {name: "伦敦", exact: true}).click();
  await page.evaluate(() => {
    const transition = document.querySelector("#scene-fade");
    window.doorFades = 0;
    new MutationObserver(() => {
      if (transition.classList.contains("is-dark")) window.doorFades++;
    }).observe(transition, {attributes: true, attributeFilter: ["class"]});
  });
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.getByRole("button", {name: "进入此处剧情", exact: true}).click();
  await page.locator("#play-tab[aria-current]").waitFor({state: "attached"});
  await page.locator("#scene-fade.is-dark").waitFor({state: "detached"});
  await page.emulateMedia({reducedMotion: "no-preference"});
  assert.equal(await page.locator("#chapter-title").textContent(), "破晓");
  await page.keyboard.down("KeyS");
  await page.locator("#map-rail").waitFor({state: "visible"});
  await page.keyboard.up("KeyS");
  await page.locator("#scene-fade.is-dark").waitFor({state: "detached"});
  assert.equal(await page.locator("#map-area-name").textContent(), "伦敦");
  assert.match(await page.locator(".site-control[aria-current]").textContent(), /凯里家的房子/);
  assert.ok(Math.abs(await mapCoordinate("x") + 9) < .4, "The return should use the Careys' door, not the district spawn.");
  assert.ok(Math.abs(await mapCoordinate() + 7.46) < .4);
  await page.keyboard.down("KeyS");
  await page.locator("#chapter-rail").waitFor({state: "visible"});
  await page.keyboard.up("KeyS");
  await page.locator("#scene-fade.is-dark").waitFor({state: "detached"});
  assert.equal(await page.evaluate(() => window.doorFades), 3);
  assert.equal(await page.locator("#chapter-title").textContent(), "破晓");
  await page.locator("#chapter-list button").first().click();
  await page.locator("#world-marker").waitFor({state: "visible"});
  const originalPosition = await page.locator("#world-marker").evaluate((marker) => marker.style.left);
  await page.keyboard.down("KeyD");
  await page.waitForFunction((start) => document.querySelector("#world-marker").style.left !== start, originalPosition);
  await page.waitForFunction(() => window.playedSoundFiles.some((file) => file.includes("/assets/sfx/wood-")));
  await page.keyboard.up("KeyD");
  await page.keyboard.press("KeyE");
  await page.getByRole("button", {name: "朗读场景原句"}).waitFor({state: "visible"});
  assert.match(await page.locator("#dawn-line").textContent(), /Wake up, Philip/);
  assert.equal(await page.locator("#reader").isVisible(), false);
  await page.getByRole("button", {name: "朗读场景原句"}).click();
  await page.waitForFunction(() => !document.querySelector("#narration-audio").paused);
  await page.getByRole("button", {name: "查看原段"}).click();
  await page.locator("#reader").waitFor({state: "visible"});
  assert.match(await page.locator(".reading-guide").textContent(), /窗帘/);
  await page.getByRole("button", {name: "朗读原文第 2 段", exact: true}).click();
  await page.waitForFunction(([start, end]) => {
    const audio = document.querySelector("#narration-audio");
    return !audio.paused && audio.currentTime > start + .05 && audio.currentTime < end && audio.playbackRate === .85;
  }, narration[0].clips[1]);
  await page.getByRole("button", {name: "切换朗读语速", exact: true}).click();
  assert.equal(await page.locator("#narration-audio").evaluate((audio) => audio.playbackRate), 1);
  await page.waitForFunction(() => document.querySelector("#narration-audio").paused);
  assert.match(await page.locator("#reader-footer").textContent(), /朗读结束/);
  await page.emulateMedia({reducedMotion: "reduce"});

  for (const chapter of chapters) {
    assert.equal(await page.locator("#chapter-title").textContent(), chapter.title);
    assert.equal(await page.locator("#renderer-message").isVisible(), false);
    const openedChapters = Math.min(chapter.number, chapters.length);
    assert.equal(await page.locator("#chapter-list button:enabled").count(), openedChapters);
    for (let section = 0; section < 3; section++) {
      if (chapter.number !== 1 || section !== 0) {
        if (chapter.number === 1 && section === 1) await page.emulateMedia({reducedMotion: "no-preference"});
        const action = chapter.number === 1 ? ["看向窗边", "随女仆下楼", "转到门厅"][section] : "前往线索";
        await page.getByRole("button", {name: action, exact: true}).click();
        if (chapter.number === 1) {
          await page.waitForFunction((expected) => document.querySelector(".dawn-quote")?.textContent === expected,
            chapter.paragraphs[section === 1 ? 5 : 24]);
          assert.equal(await page.locator("#reader").isVisible(), false);
          if (section === 2) {
            await page.waitForFunction(() => document.querySelector("#scene-place").textContent.includes("门厅"));
            await page.emulateMedia({reducedMotion: "reduce"});
          }
          await page.getByRole("button", {name: "查看原段"}).click();
        }
        await page.locator("#reader").waitFor({state: "visible"});
      }
      const start = chapter.beats[section][0];
      const end = chapter.beats[section + 1]?.[0] ?? chapter.paragraphs.length;
      assert.deepEqual(await page.locator(".paragraph p").allTextContents(), chapter.paragraphs.slice(start, end));
      if (chapter.number === 1 && section === 1) {
        await page.waitForFunction(() => document.querySelector("#scene-place").textContent.includes("母亲的卧室"));
        if (process.env.BONDAGE_SCREENSHOTS) {
          await page.locator("#close-reader").click();
          await page.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-bedroom.png")});
          await page.getByRole("button", {name: "英文原文", exact: true}).click();
        }
        await page.getByText("这一句怎么读", {exact: true}).click();
        assert.ok(await page.locator(".sentence-note p").isVisible());
        await page.getByText("查看本章词语", {exact: true}).click();
        assert.equal(await page.locator(".glossary dt").count(), 4);
        if (process.env.BONDAGE_SCREENSHOTS) await page.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-reader.png")});
      }
      await page.getByRole("button", {name: "读完此段", exact: true}).click();
      if (chapter.number === 1 && section === 0) {
        await page.reload();
        assert.equal(await page.locator("#objective-label").textContent(), "场景线索 2 / 3");
      }
    }
    if (chapter.number === 1) {
      assert.equal(await page.getByRole("button", {name: "完成本章", exact: true}).isEnabled(), false);
      await page.getByRole("button", {name: chapter.questions[0][2][0], exact: true}).click();
      assert.equal(await page.locator(".answer.wrong").count(), 1);
      await page.locator("#reader .evidence-link").click();
      assert.equal(await page.locator(".is-evidence").getAttribute("id"), "source-" + chapter.questions[0][0]);
      await page.getByRole("button", {name: "理解检查", exact: true}).click();
    }
    for (const [, , options, index] of chapter.questions) {
      await page.getByRole("button", {name: options[index], exact: true}).click();
    }
    await page.getByRole("button", {name: "完成本章", exact: true}).click();
    assert.equal(await page.locator("#act-progress").textContent(), chapter.number + " / 21");
    if (chapter.number < chapters.length) await page.getByRole("button", {name: "进入下一章", exact: true}).click();
  }

  assert.ok(await page.getByText("你走出了校门", {exact: true}).isVisible());
  await page.locator("#reader-footer").getByRole("button", {name: "返回场景", exact: true}).click();
  await page.getByRole("button", {name: "查看全书目录", exact: true}).click();
  assert.equal(await page.locator(".act-card").count(), 8);
  assert.equal(await page.getByText("待制作", {exact: true}).count(), 7);
  if (process.env.BONDAGE_SCREENSHOTS) await page.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-directory.png")});
  await page.reload();
  assert.equal(await page.locator("#act-progress").textContent(), "21 / 21");
  assert.equal(await page.locator("#chapter-title").textContent(), chapters.at(-1).title);
  assert.match(await page.locator("#game-progress").textContent(), /已完成 21 \/ 21 章/);
  await page.getByRole("button", {name: "场景音 开", exact: true}).click();
  await page.getByRole("button", {name: "全书目录", exact: true}).click();
  await page.getByRole("button", {name: "重置进度", exact: true}).click();
  await page.getByRole("button", {name: "取消", exact: true}).click();
  assert.match(await page.locator("#game-progress").textContent(), /已完成 21 \/ 21 章/);
  await page.getByRole("button", {name: "重置进度", exact: true}).click();
  await page.getByRole("button", {name: "确认重置", exact: true}).click();
  assert.equal(await page.locator("#chapter-title").textContent(), "破晓");
  assert.match(await page.locator("#game-progress").textContent(), /已完成 0 \/ 21 章 · 第 1 章线索 0 \/ 3/);
  await page.reload();
  assert.equal(await page.locator("#chapter-list button:enabled").count(), 1);
  assert.equal(await page.getByRole("button", {name: "场景音 关", exact: true}).isVisible(), true);
  assert.match(await page.locator("#game-progress").textContent(), /已完成 0 \/ 21 章/);
  await page.close();

  const mobile = await browser.newPage({
    viewport: {width: 390, height: 844},
    hasTouch: true,
    reducedMotion: "reduce"
  });
  await mobile.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException("Embedded container blocked fullscreen"));
  });
  await mobile.goto(url);
  await mobile.locator("#stage[data-physics=rapier]").waitFor({state: "attached"});
  await mobile.locator("#world-marker").waitFor({state: "visible"});
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const touch = await mobile.context().newCDPSession(mobile);
  const touchMove = mobile.getByRole("group", {name: "触屏移动"});
  const touchMarker = mobile.locator("#world-marker");
  async function moveWithTouch(name, axis, sign, end = "touchEnd") {
    const {x, y, width, height} = await touchMove.getByRole("button", {name, exact: true}).boundingBox();
    const start = await touchMarker.evaluate((marker, axis) => parseFloat(marker.style[axis]), axis);
    await touch.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: x + width / 2, y: y + height / 2}]});
    await mobile.waitForFunction(({axis, start, sign}) =>
      (parseFloat(document.querySelector("#world-marker").style[axis]) - start) * sign > .25, {axis, start, sign});
    await touch.send("Input.dispatchTouchEvent", {type: end, touchPoints: []});
  }
  await moveWithTouch("前进", "top", -1);
  await moveWithTouch("后退", "top", 1);
  await moveWithTouch("向右横移", "left", -1, "touchCancel");
  const stopped = await touchMarker.evaluate((marker) => marker.style.left);
  await mobile.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await touchMarker.evaluate((marker) => marker.style.left), stopped);
  await moveWithTouch("向左横移", "left", 1);
  await mobile.getByRole("button", {name: "全屏", exact: true}).tap();
  await mobile.locator("html[data-game-fullscreen]").waitFor({state: "attached"});
  assert.ok(await mobile.evaluate(() => !document.fullscreenElement));
  await mobile.keyboard.press("Escape");
  await mobile.locator("html[data-game-fullscreen]").waitFor({state: "detached"});
  if (process.env.BONDAGE_SCREENSHOTS) await mobile.screenshot({path: join(process.env.BONDAGE_SCREENSHOTS, "bondage-mobile.png")});
  await mobile.getByRole("button", {name: "看向窗边", exact: true}).tap();
  await mobile.waitForFunction(() => document.querySelector("#game-progress").textContent.includes("线索 1 / 3"));
  await mobile.getByRole("button", {name: "查看原段"}).tap();
  assert.ok(await mobile.locator("#reader").isVisible());
  assert.deepEqual(errors, []);
  console.log("Completed all 21 chapters, including all 745 original paragraphs, 63 scene interactions, and 42 comprehension questions.");
  console.log("Verified offline narration and cue playback, wood footsteps, three map regions, WebGL movement, save restoration, and mobile controls.");
  console.log("Verified animated doors, collision and walk-through, both door sounds, native fullscreen, and embedded fullscreen fallback.");
  console.log("Verified door-triggered scene fades, round-trip arrival at the same map entrance, and locked foyers.");
} finally {
  await browser.close();
}
