import { app, screen, BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type WindowBounds = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

const DEFAULTS: WindowBounds = { width: 1100, height: 720 };
const SAVE_DEBOUNCE_MS = 250;

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isOnScreen(b: WindowBounds): boolean {
  if (b.x === undefined || b.y === undefined) return true;
  return screen.getAllDisplays().some((d) => {
    const { x, y, width, height } = d.workArea;
    return b.x! >= x && b.y! >= y && b.x! + b.width <= x + width && b.y! + b.height <= y + height;
  });
}

export function loadWindowBounds(): WindowBounds {
  const file = path.join(app.getPath("userData"), "window-state.json");
  try {
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    if (!isFinitePositive(parsed.width) || !isFinitePositive(parsed.height)) return DEFAULTS;
    const bounds: WindowBounds = {
      width: parsed.width,
      height: parsed.height,
      x: isFinitePositive(parsed.x) ? parsed.x : undefined,
      y: isFinitePositive(parsed.y) ? parsed.y : undefined,
    };
    return isOnScreen(bounds) ? bounds : { width: bounds.width, height: bounds.height };
  } catch {
    return DEFAULTS;
  }
}

export function trackWindowBounds(win: BrowserWindow) {
  const file = path.join(app.getPath("userData"), "window-state.json");
  let timer: NodeJS.Timeout | null = null;

  const persist = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    try {
      writeFileSync(file, JSON.stringify(win.getNormalBounds()));
    } catch {}
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  };

  win.on("resize", schedule);
  win.on("move", schedule);
  win.on("close", () => {
    if (timer) clearTimeout(timer);
    persist();
  });
}
