export function setupFullscreen(button, {canEnter, clearInput}) {
  const root = document.documentElement;
  let fallback = false;
  let pending = false;
  const active = () => document.fullscreenElement === root || fallback;

  function refresh() {
    const expanded = active();
    root.toggleAttribute("data-game-fullscreen", expanded);
    button.textContent = expanded ? "退出全屏" : "全屏";
    button.setAttribute("aria-pressed", String(expanded));
    button.title = expanded ? "退出全屏（Esc）" : "全屏（Z）";
    clearInput();
  }

  async function exit() {
    fallback = false;
    if (document.fullscreenElement === root) {
      try { await document.exitFullscreen(); } catch { /* The browser may have exited already. */ }
    }
    refresh();
  }

  async function enter() {
    if (active() || pending || !canEnter()) return;
    pending = true;
    try {
      if (!root.requestFullscreen || !document.fullscreenEnabled) fallback = true;
      else await root.requestFullscreen();
    } catch {
      fallback = true;
    } finally {
      pending = false;
      refresh();
    }
  }

  button.addEventListener("click", () => { if (active()) void exit(); else void enter(); });
  document.addEventListener("fullscreenchange", refresh);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active()) {
      event.preventDefault();
      event.stopPropagation();
      void exit();
    } else if (event.code === "KeyZ" && !event.repeat && !event.altKey && !event.ctrlKey &&
               !event.metaKey && !event.shiftKey && canEnter()) {
      event.preventDefault();
      void enter();
    }
  }, true);
  refresh();
  return {exit};
}
