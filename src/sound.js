import narrationTracks from "./narration.json" with {type: "json"};

export function createNarrator() {
  const audio = new Audio();
  audio.preload = "metadata";
  audio.id = "narration-audio";
  audio.hidden = true;
  document.body.append(audio);
  let active;

  function stop(message) {
    const previous = active;
    active = undefined;
    audio.pause();
    if (previous) {
      cancelAnimationFrame(previous.frame);
      previous.control.textContent = "▶";
      previous.control.setAttribute("aria-pressed", "false");
      previous.control.closest(".paragraph")?.classList.remove("is-playing");
      previous.status.textContent = message ?? previous.idleText;
    }
  }

  function play(chapterNumber, paragraphIndex, control, status, rate) {
    if (active?.control === control) {
      stop();
      return;
    }
    stop();
    const track = narrationTracks[chapterNumber - 1];
    const clip = track?.clips[paragraphIndex];
    if (!clip) {
      status.textContent = "这个段落还没有朗读音轨。";
      return;
    }
    const url = new URL(track.file, document.baseURI).href;
    if (audio.src !== url) audio.src = url;
    const [,end] = clip;
    const next = {
      control, status, idleText: status.textContent, frame: 0, end
    };
    active = next;
    audio.currentTime = clip[0];
    audio.playbackRate = rate;
    control.textContent = "■";
    control.setAttribute("aria-pressed", "true");
    control.closest(".paragraph")?.classList.add("is-playing");
    status.textContent = "正在加载朗读…";

    const checkEnd = () => {
      if (active !== next) return;
      if (audio.currentTime >= end) stop("本段朗读结束");
      else next.frame = requestAnimationFrame(checkEnd);
    };
    audio.play().then(() => {
      if (active !== next) return;
      status.textContent = "正在朗读第 " + (paragraphIndex + 1) + " 段";
      next.frame = requestAnimationFrame(checkEnd);
    }).catch(() => {
      if (active === next) stop("朗读音轨无法播放，请刷新后重试。");
    });
  }

  audio.addEventListener("ended", () => stop("本段朗读结束"));
  audio.addEventListener("timeupdate", () => {
    if (active && audio.currentTime >= active.end) stop("本段朗读结束");
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  return {play, stop, setRate(rate) { audio.playbackRate = rate; }};
}

const soundscapes = {
  dawn: {low: 59, high: 470, gain: .20, tremble: .093},
  dawnOpen: {low: 75, high: 740, gain: .24, tremble: .105},
  house: {low: 90, high: 240, gain: .135, tremble: .139},
  school: {low: 100, high: 720, gain: .16, tremble: .172},
  church: {low: 42, high: 225, gain: .20, tremble: .071},
  street: {low: 102, high: 850, gain: .28, tremble: .121},
  country: {low: 165, high: 1490, gain: .26, tremble: .201},
  yard: {low: 145, high: 1080, gain: .24, tremble: .155}
};

export function createSceneSound() {
  let context, bus, ambience, ambientLevel, wind, noise, highpass, lowpass, sway;
  let enabled = true;
  let reading = false;
  let visible = true;
  let scene = "dawn";
  let stride = 0;
  let lastStep = -1;
  let resumeTask;
  let loaded = false;
  let stepIndex = 0;
  const stepTracks = {
    wood: ["wood-1.ogg", "wood-2.ogg"],
    stone: ["stone-1.ogg"],
    gravel: ["gravel-1.ogg"]
  };
  function sample(name) {
    const audio = new Audio();
    audio.preload = "none";
    audio.src = new URL("assets/sfx/" + name, document.baseURI).href;
    audio.volume = .32;
    return audio;
  }
  const samples = Object.fromEntries(Object.entries(stepTracks).map(([key, names]) => [key, names.map(sample)]));
  const steps = Object.values(samples).flat();
  const doorTracks = [sample("door-close.ogg"), sample("door-open.ogg")];
  const clips = [...steps, ...doorTracks];

  function filter(type, frequency) {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    return filter;
  }

  function noiseBuffer() {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, sampleRate * 12, sampleRate);
    const data = buffer.getChannelData(0);
    let rolling = 0;
    for (let i = 0; i < data.length; i++) {
      rolling = .84 * rolling + (Math.random() * 2 - 1) * .16;
      const taper = Math.min(1, i / 2800, (data.length - i - 1) / 2800);
      data[i] = rolling * Math.max(.02, taper);
    }
    return buffer;
  }

  function update() {
    if (!context) return;
    const now = context.currentTime;
    const setting = soundscapes[scene];
    bus.gain.setTargetAtTime(enabled && visible && !document.hidden ? 1 : 0, now, .055);
    ambientLevel.gain.setTargetAtTime(setting.gain * (reading ? .24 : 1), now, .16);
    highpass.frequency.setTargetAtTime(setting.low, now, .15);
    lowpass.frequency.setTargetAtTime(setting.high, now, .15);
    wind.frequency.setTargetAtTime(setting.tremble, now, .24);
  }

  function unlock() {
    if (!enabled || !visible) return;
    if (!context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      bus = context.createGain();
      bus.gain.value = 0;
      bus.connect(context.destination);
      ambientLevel = context.createGain();
      ambientLevel.gain.value = 0;
      highpass = filter("highpass", 68);
      lowpass = filter("lowpass", 450);
      sway = context.createGain();
      sway.gain.value = .72;
      wind = context.createOscillator();
      const modulation = context.createGain();
      modulation.gain.value = .27;
      wind.connect(modulation).connect(sway.gain);
      wind.start();
      noise = noiseBuffer();
      ambience = context.createBufferSource();
      ambience.buffer = noise;
      ambience.loop = true;
      ambience.connect(highpass).connect(lowpass).connect(sway).connect(ambientLevel).connect(bus);
      ambience.start();
      update();
    }
    if (context.state === "suspended" && !resumeTask) {
      resumeTask = context.resume().catch(() => {}).finally(() => { resumeTask = undefined; });
    }
    if (!loaded) {
      loaded = true;
      for (const clip of clips) {
        clip.preload = "auto";
        clip.load();
      }
    }
  }

  function burst({band = 550, length = .15, volume = .25, body = 115, pitchEnd = 55, mass = .09} = {}) {
    if (!context || context.state !== "running" || !enabled || !visible) return;
    const now = context.currentTime;
    const sound = context.createBufferSource();
    sound.buffer = noise;
    const tone = context.createOscillator();
    tone.frequency.setValueAtTime(body, now);
    tone.frequency.exponentialRampToValueAtTime(pitchEnd, now + length);
    const bandpass = filter("bandpass", band);
    bandpass.Q.value = .75;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.001, now);
    envelope.gain.linearRampToValueAtTime(volume, now + .011);
    envelope.gain.exponentialRampToValueAtTime(.001, now + length);
    const bodyLevel = context.createGain();
    bodyLevel.gain.value = mass;
    sound.connect(bandpass).connect(envelope).connect(bus);
    tone.connect(bodyLevel).connect(envelope);
    sound.start(now, .18 + Math.random() * 7, length);
    tone.start(now);
    tone.stop(now + length);
  }

  function step(surface, distance) {
    if (!enabled || !visible || reading || !context || context.state !== "running") return;
    stride += distance;
    const now = context.currentTime;
    if (stride < .67 || now - lastStep < .215) return;
    stride %= .67;
    lastStep = now;
    const bank = samples[surface] ?? samples.stone;
    const sample = bank[stepIndex++ % bank.length];
    if (sample.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || sample.error) {
      burst({band: {wood: 400, stone: 990, gravel: 1460}[surface] ?? 600, length: .18, volume: .22});
      return;
    }
    sample.currentTime = 0;
    sample.playbackRate = .90 + Math.random() * .16;
    sample.play().catch(() => burst());
  }

  function clue(kind) {
    const foley = {
      window: {band: 1380, length: .43, volume: .28, mass: .01},
      bed: {band: 730, length: .30, volume: .20, mass: .02},
      door: {band: 470, length: .27, volume: .26, body: 150, pitchEnd: 82},
      bell: {band: 1440, length: .52, volume: .22, body: 530, pitchEnd: 498, mass: .26}
    };
    burst(foley[kind] ?? {band: 940, length: .14, volume: .12, mass: .025});
  }

  function door(opening, distance) {
    if (!enabled || !visible || document.hidden) return;
    const recording = doorTracks[Number(opening)];
    doorTracks[Number(!opening)].pause();
    recording.currentTime = 0;
    recording.volume = .64 / (1 + distance * .17);
    recording.playbackRate = opening ? 1.16 : 1.28;
    recording.play().catch(() => burst(opening
      ? {band: 735, length: .52, body: 224, pitchEnd: 147, volume: .25}
      : {band: 390, length: .26, body: 143, pitchEnd: 60, volume: .29}));
  }

  function silence(trackList) { for (const clip of trackList) clip.pause(); }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) silence(clips);
    update();
  });

  return {
    unlock, step, clue, door,
    setScene(name) { scene = soundscapes[name] ? name : "house"; stride = 0; update(); },
    setReading(value) { reading = value; if (value) silence(steps); update(); },
    setVisible(value) { visible = value; if (!value) silence(clips); update(); },
    setEnabled(value) { enabled = value; if (!value) silence(clips); update(); }
  };
}
