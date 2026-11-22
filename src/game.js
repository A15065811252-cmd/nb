import {acts, chapters} from "./story.js";
import {createWorld} from "./world.js";
import {districts, drawDistrictPlan, locationForChapter} from "./map.js";
import {createNarrator, createSceneSound} from "./sound.js";
import {setupFullscreen} from "./fullscreen.js";

const get = (id) => document.getElementById(id);
const reader = get("reader");
const readerBody = get("reader-body");
const resetDialog = get("reset-dialog");
const storageKey = "of-human-bondage:save:1";
const symbols = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const actNames = ["一", "二", "三", "四", "五", "六", "七", "八"];
const narrator = createNarrator();
const effects = createSceneSound();
const state = loadSave();

let readerTab = 0;
let selectedAnswers = [];
let movingToClue = false;
let currentView = "play";
let worldView = "play";
let district = districts[0];
let selectedSite = 0;
let mapPosition;
let mapArrival = false;
let voiceRate = .85;
let crossing = false;
const dawnScenes = [
  {action: "看向窗边", speaker: "女仆", cue: 1, evidence: 0},
  {action: "随女仆下楼", speaker: "母亲", cue: 5, evidence: 4},
  {action: "转到门厅", speaker: "医生", cue: 24, evidence: 24}
];

function loadSave() {
  let prior;
  try {
    prior = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    get("save-status").textContent = "本次进度仅保存在当前窗口";
  }
  return restoreProgress(prior);
}

function restoreProgress(prior) {
  const records = chapters.map((chapter, index) => {
    const entry = prior?.records?.[index];
    const found = Number.isInteger(entry?.found) ? Math.min(3, Math.max(0, entry.found)) : 0;
    const read = chapter.beats.map((_, i) => entry?.read?.[i] === true);
    const correct = chapter.questions.map((_, i) => entry?.correct?.[i] === true);
    const completed = entry?.completed === true && found === 3 && read.every(Boolean) && correct.every(Boolean);
    return {found, read, correct, completed};
  });
  let lastOpen = 0;
  while (lastOpen < chapters.length - 1 && records[lastOpen].completed) lastOpen++;
  const current = Number.isInteger(prior?.current) && prior.current >= 0 && prior.current <= lastOpen
    ? prior.current : lastOpen;
  return {current, records, sceneAudio: prior?.sceneAudio !== false};
}

function save(progress = state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    get("save-status").textContent = "进度已保存在本机";
    return true;
  } catch {
    get("save-status").textContent = "本次进度仅保存在当前窗口";
    return false;
  }
}

function node(tag, className = "", content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function button(content, className, handler) {
  const element = node("button", className, content);
  element.type = "button";
  element.addEventListener("click", handler);
  return element;
}

function activeChapter() { return chapters[state.current]; }
function activeRecord() { return state.records[state.current]; }
function activeActIndex() { return acts.findIndex((act) => act.last >= activeChapter().number); }
function isLastFirstActChapter() { return activeChapter().number === acts[0].last; }
function checkReady(record) { return record.found === 3 && record.read.every(Boolean) && record.correct.every(Boolean); }
function firstUnread(record) { return record.read.findIndex((done) => !done); }

function showView(view, throughDoor = false) {
  if (crossing && !throughDoor) return;
  world.clearInput();
  const map = view === "map";
  const directory = view === "acts";
  const previousView = currentView;
  currentView = view;
  if (view !== previousView) narrator.stop();
  get("play-view").hidden = directory;
  get("acts-view").hidden = !directory;
  get("chapter-rail").hidden = map;
  get("map-rail").hidden = !map;
  get("open-book").hidden = map;
  get("return-story").hidden = !map;
  for (const tab of ["play", "map", "acts"]) get(tab + "-tab").removeAttribute("aria-current");
  get(view + "-tab").setAttribute("aria-current", "page");
  effects.setVisible(!directory);
  if (directory) {
    void fullscreen.exit();
    renderActs();
  }
  else if (map && previousView !== "map") {
    const [area, site] = locationForChapter(activeChapter().number);
    openDistrict(area, site, throughDoor);
  } else if (!map && worldView === "map") enterChapter(state.current, throughDoor);
  else if (!map && !directory) renderDawnLine();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function crossScene(change) {
  if (crossing) return;
  crossing = true;
  world.clearInput();
  const play = get("play-view");
  const fade = get("scene-fade");
  const instant = matchMedia("(prefers-reduced-motion: reduce)").matches;
  play.inert = true;
  fade.classList.add("is-dark");
  try {
    await wait(instant ? 0 : 160);
    change();
    // Leave the new camera a frame to draw while the old scene is covered.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  } finally {
    fade.classList.remove("is-dark");
    crossing = false;
    play.inert = false;
  }
}

function mapChapter(site) {
  let last = 1;
  while (last < state.records.length && state.records[last - 1].completed) last++;
  const available = site.chapters.filter((chapter) => chapter <= last);
  if (available.includes(activeChapter().number)) return activeChapter().number;
  return available.find((chapter) => !state.records[chapter - 1].completed) ?? available[0];
}

function siteChapterLabel(site) {
  return "第 " + site.chapters.join("、") + " 章";
}

function openDistrict(area, site = 0, throughDoor = false) {
  movingToClue = false;
  renderDawnLine();
  mapArrival = false;
  district = area;
  selectedSite = site;
  mapPosition = {x: area.spawn[0], z: area.spawn[1]};
  worldView = "map";
  world.setArea(area, throughDoor ? site : undefined);
  effects.setScene(area.atmosphere);
  get("scene-place").textContent = area.name + " · 室外";
  get("chapter-number").textContent = area.english.toUpperCase();
  get("chapter-title").textContent = area.title;
  get("chapter-intro").textContent = area.description;
  renderMapRail();
  renderMapObjective();
}

function renderMapRail() {
  get("map-area-name").textContent = district.name;
  get("district-list").replaceChildren(...districts.map((area) => {
    const control = button(area.name, "district-control", () => openDistrict(area));
    if (area === district) control.setAttribute("aria-current", "location");
    return control;
  }));
  get("site-list").replaceChildren(...district.sites.map((site, index) => {
    const item = node("li");
    const control = button("", "site-control", () => {
      if (movingToClue) return;
      selectedSite = index;
      mapArrival = false;
      renderMapRail();
      renderMapObjective();
    });
    if (index === selectedSite) control.setAttribute("aria-current", "location");
    const tag = node("span", "site-number", String(index + 1));
    tag.setAttribute("aria-hidden", "true");
    const description = node("span");
    description.append(node("strong", "", site.name), node("small", "", siteChapterLabel(site)));
    control.append(tag, description);
    item.append(control);
    return item;
  }));
  drawDistrictPlan(get("map-plan"), district, selectedSite, mapPosition);
}

function renderMapObjective() {
  const site = district.sites[selectedSite];
  const chapter = mapChapter(site);
  get("marker-name").textContent = site.name;
  world.setTarget(selectedSite);
  get("objective-label").textContent = mapArrival ? "已到达 · " + district.name : "探索 · " + district.name;
  get("objective").textContent = site.name + (mapArrival && !chapter ? " · 第 " + site.chapters[0] + " 章解锁后可进入剧情" : "");
  const action = get("observe");
  action.disabled = movingToClue;
  action.textContent = movingToClue ? "正在前往…" : chapter ? "进入此处剧情" : "前往地点";
}

function visitSite() {
  const index = selectedSite;
  const chapter = mapChapter(district.sites[index]);
  movingToClue = true;
  renderMapObjective();
  world.guide(() => {
    if (chapter) {
      world.enterSite(index, () => usePortal(index));
    } else {
      movingToClue = false;
      mapArrival = true;
      renderMapObjective();
    }
  });
}

function usePortal(index) {
  if (crossing) return;
  if (currentView === "map") {
    const site = district.sites[index];
    if (!site) return;
    const chapter = mapChapter(site);
    movingToClue = false;
    if (!chapter) {
      selectedSite = index;
      mapArrival = true;
      renderMapRail();
      renderMapObjective();
      return;
    }
    void crossScene(() => {
      state.current = chapter - 1;
      showView("play", true);
    });
  } else if (currentView === "play" && activeChapter().number <= acts[0].last) {
    void crossScene(() => showView("map", true));
  }
}
function renderActs() {
  const list = get("acts-list");
  list.replaceChildren(...acts.map((act, index) => {
    const item = node("li", "act-card");
    const detail = node("div");
    detail.append(
      node("p", "eyebrow", "第" + actNames[index] + "幕 / " + symbols[index] + "  ·  第 " + act.first + "–" + act.last + " 章"),
      node("h2", "", act.title),
      node("p", "act-place", act.place)
    );
    const firstIndex = act.first - 1;
    const available = firstIndex < chapters.length;
    const unlocked = available && (firstIndex === 0 || state.records[firstIndex - 1].completed);
    let status;
    if (unlocked) {
      const records = state.records.slice(firstIndex, act.last);
      const finished = records.length === act.last - act.first + 1 && records.every((record) => record.completed);
      status = button((finished ? "重访第" : "进入第") + actNames[index] + "幕", "button secondary", () => {
        if (activeActIndex() !== index) {
          const next = records.findIndex((record) => !record.completed);
          showView("play");
          enterChapter(firstIndex + Math.max(0, next));
        } else showView("play");
      });
    } else status = node("p", "act-availability", available ? "按原文顺序解锁" : "待制作");
    item.append(detail, status, node("p", "act-theme", act.theme));
    return item;
  }));
}

function renderChapterList(scrollToCurrent = false) {
  const list = get("chapter-list");
  const top = list.scrollTop;
  const actIndex = activeActIndex();
  const act = acts[actIndex];
  const firstIndex = act.first - 1;
  let open = firstIndex === 0 || state.records[firstIndex - 1].completed;
  list.replaceChildren(...chapters.slice(firstIndex, act.last).map((chapter, offset) => {
    const index = firstIndex + offset;
    const record = state.records[index];
    const item = node("li");
    const control = button("", "", () => enterChapter(index));
    const detail = node("span");
    const status = record.completed ? "已完成" : open ? "可游玩" : "按原文顺序解锁";
    detail.append(node("span", "chapter-name", chapter.title), node("span", "chapter-state", status));
    control.append(node("span", "chapter-roman", chapter.roman), detail);
    const symbol = node("span", "chapter-symbol", record.completed ? "✓" : open ? "›" : "·");
    symbol.setAttribute("aria-hidden", "true");
    control.append(symbol);
    control.disabled = !open;
    if (index === state.current) control.setAttribute("aria-current", "step");
    open = open && record.completed;
    item.append(control);
    return item;
  }));
  list.scrollTop = top;
  if (scrollToCurrent) {
    const entry = list.querySelector("[aria-current]");
    const topDiff = entry.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (topDiff < 0 || topDiff + entry.offsetHeight > list.clientHeight) list.scrollTop += topDiff - 8;
  }
  const completed = state.records.slice(firstIndex, act.last).filter((record) => record.completed).length;
  const count = act.last - firstIndex;
  const name = "第" + actNames[actIndex] + "幕";
  get("rail-label").textContent = name;
  get("rail-roman").textContent = "/ ACT " + symbols[actIndex];
  get("rail-title").textContent = act.title;
  get("chapter-rail").setAttribute("aria-label", name + "章节");
  get("act-progress").textContent = completed + " / " + count;
  get("act-meter").max = count;
  get("act-meter").setAttribute("aria-label", name + "完成章数");
  get("act-meter").value = completed;
}

function enterChapter(index, throughDoor = false) {
  narrator.stop();
  state.current = index;
  movingToClue = false;
  selectedAnswers = [];
  const chapter = activeChapter();
  worldView = "play";
  get("chapter-number").textContent = "第 " + chapter.number + " 章 / CHAPTER " + chapter.roman;
  get("chapter-title").textContent = chapter.title;
  get("chapter-intro").textContent = chapter.intro;
  get("scene-place").textContent = chapter.place;
  world.setChapter(chapter, activeRecord().found, throughDoor);
  effects.setScene(chapter.number === 1 ? (activeRecord().found ? "dawnOpen" : "dawn") : chapter.scene === "church" ? "church"
    : ["school", "study"].includes(chapter.scene) ? "school" : "house");
  renderChapterList(true);
  renderObjective();
  renderDawnLine();
  if (index > 0 || activeRecord().found > 0) save();
}

function renderObjective() {
  const {found, completed, read} = activeRecord();
  const done = state.records.filter((record) => record.completed).length;
  get("game-progress").textContent = `已完成 ${done} / ${chapters.length} 章 · 第 ${activeChapter().number} 章线索 ${found} / ${activeChapter().beats.length}`;
  const [, , clue] = activeChapter().beats[found] ?? [];
  const action = get("observe");
  action.disabled = movingToClue;
  world.setTarget(clue ? found : undefined);
  if (clue) {
    get("objective-label").textContent = "场景线索 " + (found + 1) + " / 3";
    get("objective").textContent = clue;
    get("marker-name").textContent = clue;
    action.textContent = movingToClue ? "正在靠近…" : activeChapter().number === 1 ? dawnScenes[found].action : "前往线索";
  } else if (completed) {
    get("objective-label").textContent = "本章已完成";
    get("objective").textContent = isLastFirstActChapter() ? "第一幕 · 已通关" : "原文与理解检查已完成";
    action.textContent = state.current === chapters.length - 1 ? "查看全书目录" : "进入下一章";
  } else if (read.every(Boolean)) {
    get("objective-label").textContent = "理解检查";
    get("objective").textContent = "用原文回答本章的两个问题";
    action.textContent = "开始检查";
  } else {
    get("objective-label").textContent = "英文原文";
    get("objective").textContent = "三个线索已找到，继续读完本章";
    action.textContent = "继续读原文";
  }
}

function renderDawnLine(cue) {
  const panel = get("dawn-line");
  const segment = activeRecord().found - 1;
  const scene = currentView === "play" && activeChapter().number === 1 ? dawnScenes[segment] : undefined;
  panel.hidden = !scene;
  panel.replaceChildren();
  if (!scene) return;
  const quote = node("p", "dawn-quote", activeChapter().paragraphs[cue ?? scene.cue]);
  quote.lang = "en";
  quote.setAttribute("aria-live", "polite");
  const status = node("span", "dawn-status");
  status.setAttribute("role", "status");
  const listen = button("▶", "speak", () => narrator.play(1, cue ?? scene.cue, listen, status, voiceRate));
  listen.setAttribute("aria-label", "朗读场景原句");
  listen.setAttribute("aria-pressed", "false");
  const speaker = cue === 3 ? "女仆" : scene.speaker;
  panel.append(node("span", "dawn-speaker", speaker), quote, listen,
    button("查看原段", "evidence-link", () => openReader(segment, cue ?? scene.evidence)), status);
}

function interact() {
  if (crossing || movingToClue || reader.open || get("play-view").hidden) return;
  if (currentView === "map") {
    visitSite();
    return;
  }
  const record = activeRecord();
  if (record.completed) {
    if (state.current < chapters.length - 1) enterChapter(state.current + 1);
    else showView("acts");
    return;
  }
  if (record.found === 3) {
    const unread = firstUnread(record);
    openReader(unread < 0 ? 3 : unread);
    return;
  }
  movingToClue = true;
  const dawn = activeChapter().number === 1;
  narrator.stop();
  if (dawn && record.found === 1) renderDawnLine(3);
  renderObjective();
  world.guide(() => {
    movingToClue = false;
    const segment = record.found++;
    const kind = activeChapter().beats[segment][1];
    world.reveal(segment);
    if (dawn && segment === 0) effects.setScene("dawnOpen");
    effects.clue(kind);
    save();
    renderObjective();
    if (dawn) {
      narrator.stop();
      renderDawnLine();
    } else openReader(segment);
  });
}

function openReader(tab, evidence) {
  world.clearInput();
  effects.setReading(true);
  readerTab = tab;
  get("reader-kicker").textContent = "第 " + activeChapter().number + " 章 / " + activeChapter().roman;
  get("reader-title").textContent = activeChapter().title;
  renderReader(evidence);
  if (!reader.open) reader.showModal();
  requestAnimationFrame(() => get("reader-tabs").querySelector("[aria-current]")?.scrollIntoView({block: "nearest", inline: "nearest"}));
}

function renderReader(evidence) {
  narrator.stop();
  const record = activeRecord();
  const footer = get("reader-footer");
  readerBody.replaceChildren();
  footer.replaceChildren();
  const tabs = ["第一段", "第二段", "第三段", "理解检查"].map((label, index) => {
    const suffix = (index < 3 && record.read[index]) || (index === 3 && record.correct.every(Boolean)) ? " ✓" : "";
    const control = button(label + suffix, "", () => openReader(index));
    if (readerTab === index) control.setAttribute("aria-current", "true");
    return control;
  });
  get("reader-tabs").replaceChildren(...tabs);
  if (readerTab === 3) renderQuestions(footer);
  else renderOriginal(footer, evidence);
  readerBody.scrollTop = 0;
  if (evidence !== undefined) {
    const paragraph = get("source-" + evidence);
    if (paragraph) requestAnimationFrame(() => paragraph.scrollIntoView({block: "center", behavior: "instant"}));
  }
}

function appendEnglish(container, text, terms) {
  const plain = text.toLocaleLowerCase("en");
  const matches = [];
  for (const [term] of terms) {
    const lower = term.toLocaleLowerCase("en");
    let index = plain.indexOf(lower);
    while (index >= 0) {
      const end = index + lower.length;
      if (!/[a-z]/i.test(plain[index - 1] ?? "") && !/[a-z]/i.test(plain[end] ?? "")) matches.push({index, end});
      index = plain.indexOf(lower, end);
    }
  }
  matches.sort((a,b) => a.index - b.index || b.end - a.end);
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor) continue;
    container.append(text.slice(cursor, match.index), node("mark", "", text.slice(match.index, match.end)));
    cursor = match.end;
  }
  container.append(text.slice(cursor));
}

function renderOriginal(footer, evidence) {
  const chapter = activeChapter();
  const record = activeRecord();
  const segment = readerTab;
  const [start, , title, note] = chapter.beats[segment];
  const end = chapter.beats[segment + 1]?.[0] ?? chapter.paragraphs.length;
  const guide = node("aside", "reading-guide");
  guide.append(node("strong", "", title), node("p", "", note));
  const glossary = node("details", "glossary");
  glossary.append(node("summary", "", "查看本章词语"));
  const definitions = node("dl");
  for (const [term, definition] of chapter.terms) {
    const head = node("dt", "", term);
    head.lang = "en";
    definitions.append(head, node("dd", "", definition));
  }
  glossary.append(definitions);
  readerBody.append(guide, glossary, node("h3", "original-title", "英文原文 · 第 " + (start + 1) + "–" + end + " 段"));
  const status = node("p", "footer-status", "已读 " + record.read.filter(Boolean).length + " / 3 段");
  status.setAttribute("role", "status");
  for (let index = start; index < end; index++) {
    const text = chapter.paragraphs[index];
    const row = node("div", index === evidence ? "paragraph is-evidence" : "paragraph");
    row.id = "source-" + index;
    const paragraph = node("p");
    paragraph.lang = "en";
    appendEnglish(paragraph, text, chapter.terms);
    const readButton = button("▶", "speak", () => narrator.play(chapter.number, index, readButton, status, voiceRate));
    readButton.setAttribute("aria-label", "朗读原文第 " + (index + 1) + " 段");
    readButton.setAttribute("aria-pressed", "false");
    row.append(node("span", "paragraph-index", String(index + 1).padStart(2,"0")), paragraph, readButton);
    readerBody.append(row);
    const [noteIndex, sample, explanation] = chapter.readingNote;
    if (noteIndex === index) {
      const note = node("details", "sentence-note");
      const excerpt = node("blockquote", "", sample);
      excerpt.lang = "en";
      note.append(node("summary", "", "这一句怎么读"), excerpt, node("p", "", explanation));
      readerBody.append(note);
    }
  }
  const controls = node("div", "reader-footer");
  const actionText = record.read[segment] ? "返回场景" : "读完此段";
  controls.append(button(actionText, "button primary", () => {
    narrator.stop();
    if (record.read[segment]) {
      reader.close();
      return;
    }
    record.read[segment] = true;
    save();
    renderObjective();
    if (record.found !== 3) reader.close();
    else {
      const unread = firstUnread(record);
      openReader(unread < 0 ? 3 : unread);
    }
  }));
  readerBody.append(controls);
  const rate = button(voiceRate === 1 ? "语速 1×" : "语速 0.85×", "sound-toggle voice-rate", () => {
    voiceRate = voiceRate === 1 ? .85 : 1;
    rate.textContent = voiceRate === 1 ? "语速 1×" : "语速 0.85×";
    narrator.setRate(voiceRate);
  });
  rate.setAttribute("aria-label", "切换朗读语速");
  footer.append(status, rate, button("返回场景", "button secondary", () => reader.close()));
}

function jumpToEvidence(index) {
  readerTab = activeChapter().beats.findLastIndex(([start]) => start <= index);
  renderReader(index);
  get("source-" + index)?.setAttribute("tabindex", "-1");
  get("source-" + index)?.focus({preventScroll: true});
}

function renderQuestions(footer) {
  const chapter = activeChapter();
  const record = activeRecord();
  readerBody.append(node("p", "checks-intro", "选出原文支持的答案。答错可以回看线索，再试一次。"));
  chapter.questions.forEach(([evidence, prompt, options, correct, explanation], question) => {
    const area = node("fieldset", "question");
    area.append(node("legend", "", (question + 1) + ". " + prompt));
    const answers = node("div", "answers");
    options.forEach((option, index) => {
      const className = record.correct[question] && index === correct
        ? "answer right" : selectedAnswers[question] === index && !record.correct[question] ? "answer wrong" : "answer";
      const choice = button(option, className, () => {
        const scrollTop = readerBody.scrollTop;
        selectedAnswers[question] = index;
        if (index === correct) {
          record.correct[question] = true;
          save();
        }
        renderReader();
        readerBody.scrollTop = scrollTop;
        get("feedback-" + question)?.focus({preventScroll: true});
      });
      choice.disabled = record.correct[question];
      answers.append(choice);
    });
    area.append(answers);
    if (record.correct[question] || selectedAnswers[question] !== undefined) {
      const feedback = node("div", "answer-feedback");
      feedback.id = "feedback-" + question;
      feedback.tabIndex = -1;
      feedback.setAttribute("role", "status");
      feedback.append(
        node("p", "", record.correct[question] ? "理解正确。 " + explanation : "再读一下相关段落，留意人物说的话和叙述者的补充。"),
        button("回看原文第 " + (evidence + 1) + " 段", "evidence-link", () => jumpToEvidence(evidence))
      );
      area.append(feedback);
    }
    readerBody.append(area);
  });
  if (record.completed && isLastFirstActChapter()) {
    readerBody.append(get("act-complete-template").content.cloneNode(true));
  }
  const status = node("p", "footer-status", record.found + " / 3 条线索 · " + record.read.filter(Boolean).length + " / 3 段已读 · " + record.correct.filter(Boolean).length + " / 2 题通过");
  footer.append(status);
  const finish = button(record.completed ? "返回场景" : "完成本章", "button primary", () => {
    if (checkReady(record) && !record.completed) {
      record.completed = true;
      save();
      renderChapterList();
      renderObjective();
      if (isLastFirstActChapter()) {
        renderReader();
        readerBody.scrollTop = readerBody.scrollHeight;
        return;
      }
    }
    reader.close();
  });
  finish.disabled = !checkReady(record);
  footer.append(finish);
}

const world = createWorld({
  canvas: get("world"),
  stage: get("stage"),
  marker: get("world-marker"),
  doorMarker: get("door-marker"),
  canMove: () => !crossing && !reader.open && !resetDialog.open && get("acts-view").hidden,
  onInteract: interact,
  onStep: effects.step,
  onDoor: effects.door,
  onPortal: usePortal,
  onPosition: (position) => {
    if (currentView !== "map") {
      if (currentView === "play" && activeChapter().number === 1) {
        get("scene-place").textContent = position.x < 5.55 ? "伦敦 · 菲利普的卧室"
          : position.x < 6.82 ? "伦敦 · 楼梯" : position.z < -6.15 ? "伦敦 · 门厅" : "伦敦 · 母亲的卧室";
      }
      return;
    }
    mapPosition = {x: position.x, z: position.z};
    drawDistrictPlan(get("map-plan"), district, selectedSite, mapPosition);
  },
  onFailure: () => {
    get("world-marker").hidden = true;
    get("renderer-message").hidden = false;
    get("renderer-message").textContent = "此浏览器暂时无法显示 3D。仍可点击「前往线索」继续剧情、阅读和答题。";
    get("control-hint").textContent = "文字游玩模式";
    for (const control of document.querySelectorAll("#stage [data-key]")) control.disabled = true;
  }
});

const fullscreen = setupFullscreen(get("fullscreen-toggle"), {
  canEnter: () => currentView !== "acts" && !reader.open && !resetDialog.open,
  clearInput: world.clearInput
});
get("play-tab").addEventListener("click", () => showView("play"));
get("map-tab").addEventListener("click", () => showView("map"));
get("acts-tab").addEventListener("click", () => showView("acts"));
get("return-story").addEventListener("click", () => showView("play"));
get("reset-progress").addEventListener("click", () => {
  if (crossing || movingToClue) return;
  world.clearInput();
  get("reset-error").hidden = true;
  resetDialog.showModal();
});
get("cancel-reset").addEventListener("click", () => resetDialog.close());
get("reset-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const fresh = restoreProgress({sceneAudio: state.sceneAudio});
  if (!save(fresh)) {
    get("reset-error").hidden = false;
    return;
  }
  Object.assign(state, fresh);
  resetDialog.close();
  enterChapter(0);
  showView("play");
});
get("observe").addEventListener("click", interact);
get("world-marker").addEventListener("click", interact);
get("door-marker").addEventListener("click", world.toggleDoor);
get("open-book").addEventListener("click", () => {
  const record = activeRecord();
  const unread = firstUnread(record);
  openReader(unread < 0 ? 0 : unread);
});
get("close-reader").addEventListener("click", () => reader.close());
reader.addEventListener("close", () => { narrator.stop(); effects.setReading(false); });
const narrationAudio = get("narration-audio");
for (const event of ["play", "pause"]) {
  narrationAudio.addEventListener(event, () => effects.setReading(reader.open || !narrationAudio.paused));
}
function applySceneAudio() {
  effects.setEnabled(state.sceneAudio);
  get("scene-audio").setAttribute("aria-pressed", String(state.sceneAudio));
  get("scene-audio").textContent = state.sceneAudio ? "场景音 开" : "场景音 关";
}
get("scene-audio").addEventListener("click", () => {
  state.sceneAudio = !state.sceneAudio;
  applySceneAudio();
  if (state.sceneAudio) effects.unlock();
  save();
});
for (const event of ["click", "keydown", "pointerup"]) document.addEventListener(event, effects.unlock, {capture: true});
for (const control of document.querySelectorAll("#stage [data-key]")) {
  let pointerId;
  control.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointerId !== undefined) return;
    event.preventDefault();
    effects.unlock();
    pointerId = event.pointerId;
    control.setPointerCapture(event.pointerId);
    world.hold(control.dataset.key, true);
  });
  for (const event of ["pointerup","pointercancel","lostpointercapture"]) {
    control.addEventListener(event, (input) => {
      if (input.pointerId !== pointerId) return;
      pointerId = undefined;
      world.hold(control.dataset.key, false);
    });
  }
  control.addEventListener("keydown", (event) => {
    if (["Enter"," "].includes(event.key)) {
      event.preventDefault();
      world.hold(control.dataset.key, true);
    }
  });
  control.addEventListener("keyup", (event) => {
    if (["Enter"," "].includes(event.key)) world.hold(control.dataset.key, false);
  });
  control.addEventListener("blur", () => {
    if (pointerId === undefined) world.hold(control.dataset.key, false);
  });
}

applySceneAudio();
enterChapter(state.current);
