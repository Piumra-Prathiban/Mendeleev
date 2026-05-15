import { useCallback, useEffect, useRef, useState } from "react";
import { useNotes } from "./hooks/useNotes";
import { htmlToText, previewLine } from "./lib/text";
import type { Note } from "./types";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 600;
const SAVE_DEBOUNCE_MS = 300;

type Settings = {
  splashEnabled: boolean;
  splashDurationMs: number;
  showFormattingButtons: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  splashEnabled: true,
  splashDurationMs: 1900,
  showFormattingButtons: true,
};

const SETTINGS_KEY = "mendeleev:settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  return { settings, patch };
}

function Splash({ durationMs, onDone }: { durationMs: number; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fadeOutAt = Math.max(400, durationMs - 700);
    const raf = requestAnimationFrame(() => setVisible(true));
    const fadeOut = setTimeout(() => setVisible(false), fadeOutAt);
    const unmount = setTimeout(onDone, durationMs);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeOut);
      clearTimeout(unmount);
    };
  }, [durationMs, onDone]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 [-webkit-app-region:drag]"
    >
      <span
        className={`text-4xl font-light tracking-[0.18em] text-neutral-800 dark:text-neutral-200 transition-opacity duration-700 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        Mendeleev
      </span>
    </div>
  );
}

function SettingsPanel({
  settings,
  patch,
  onClose,
}: {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[90vw] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-7 h-7 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
          >
            ×
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <Row
            label="Splash screen"
            hint="Show the Mendeleev wordmark on launch"
          >
            <Toggle
              checked={settings.splashEnabled}
              onChange={(v) => patch({ splashEnabled: v })}
            />
          </Row>

          <Row
            label="Splash duration"
            hint={`${settings.splashDurationMs} ms (700 ms fade in + hold + 700 ms fade out)`}
          >
            <input
              type="range"
              min={1000}
              max={4000}
              step={100}
              value={settings.splashDurationMs}
              onChange={(e) => patch({ splashDurationMs: Number(e.target.value) })}
              disabled={!settings.splashEnabled}
              className="w-40"
            />
          </Row>

          <Row
            label="Formatting buttons"
            hint="Show bold, italic, underline, strikethrough, and heading buttons"
          >
            <Toggle
              checked={settings.showFormattingButtons}
              onChange={(v) => patch({ showFormattingButtons: v })}
            />
          </Row>

          <p className="text-xs text-neutral-500 mt-2">More settings coming soon…</p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? "bg-neutral-700 dark:bg-neutral-300" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-neutral-900 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function FmtButton({
  label,
  title,
  onClick,
  className = "",
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      // Prevent the editor from losing selection when the toolbar takes focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`text-sm w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${className}`}
    >
      {children}
    </button>
  );
}

function confirmDelete(note: Note | undefined) {
  if (!note) return false;
  const label = note.title || "Untitled";
  return window.confirm(`Delete "${label}"? This cannot be undone.`);
}

function splitContent(content: string) {
  const i = content.indexOf("\n");
  if (i === -1) return { title: content, body: "" };
  return { title: content.slice(0, i), body: content.slice(i + 1) };
}

// Walks up from the current selection to find the nearest block tag inside the editor.
function currentBlockTag(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  let node: Node | null = sel.anchorNode;
  while (node && node !== root) {
    if (node instanceof HTMLElement && /^(H[1-6]|P|DIV|LI|BLOCKQUOTE)$/.test(node.tagName)) {
      return node.tagName;
    }
    node = node.parentNode;
  }
  return "";
}

function App() {
  const {
    notes,
    filteredNotes,
    query,
    setQuery,
    selected,
    selectedId,
    loading,
    select,
    create,
    update,
    remove,
  } = useNotes();
  const { settings, patch } = useSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [splashDone, setSplashDone] = useState(!settings.splashEnabled);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dragStart = useRef<{ x: number; w: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pendingSave = useRef<{ timer: number | null; id: string | null; content: string }>({
    timer: null,
    id: null,
    content: "",
  });

  const flushSave = useCallback(() => {
    const p = pendingSave.current;
    if (p.timer !== null) {
      clearTimeout(p.timer);
      p.timer = null;
    }
    if (!p.id) return;
    const id = p.id;
    const content = p.content;
    p.id = null;
    update(id, content);
  }, [update]);

  const scheduleSave = useCallback(() => {
    if (!selected) return;
    const title = titleRef.current?.value ?? "";
    const body = bodyRef.current?.innerHTML ?? "";
    const content = body ? `${title}\n${body}` : title;
    const p = pendingSave.current;
    p.id = selected.id;
    p.content = content;
    if (p.timer !== null) clearTimeout(p.timer);
    p.timer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [selected, flushSave]);

  // Flush pending save when switching notes (cleanup runs before next selected.id renders).
  useEffect(() => {
    return () => flushSave();
  }, [selected?.id, flushSave]);

  const focusBody = () => {
    const el = bodyRef.current;
    if (!el) return null;
    if (document.activeElement !== el) el.focus();
    return el;
  };

  const focusBodyAtStart = () => {
    const el = focusBody();
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const applyInline = (cmd: "bold" | "italic" | "underline" | "strikeThrough") => {
    if (!focusBody()) return;
    document.execCommand(cmd);
    scheduleSave();
  };

  const applyHeading = (tag: "H1" | "H2" | "H3") => {
    const el = focusBody();
    if (!el) return;
    document.execCommand("formatBlock", false, currentBlockTag(el) === tag ? "P" : tag);
    scheduleSave();
  };

  const handleRemove = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (confirmDelete(note)) remove(id);
  };

  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = ev.clientX - dragStart.current.x;
      const next = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, dragStart.current.w + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex h-full w-full">
      {!splashDone && settings.splashEnabled && (
        <Splash
          durationMs={settings.splashDurationMs}
          onDone={() => setSplashDone(true)}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          patch={patch}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {!sidebarCollapsed && (
        <>
          <aside
            aria-label="Notes list"
            style={{ width: sidebarWidth }}
            className="shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden"
          >
            <div className="pl-20 pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 min-w-0 [-webkit-app-region:drag]">
              <button
                type="button"
                onClick={() => create()}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
              >
                New
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => handleRemove(selectedId)}
                  className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                title="Settings"
                className="text-sm w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
              >
                ⚙
              </button>
            </div>
            <div className="px-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Search"
                aria-label="Search notes"
                className="w-full px-2 py-1 text-sm bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded outline-none transition-colors duration-150 focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </div>
            <ul className="flex-1 overflow-auto">
              {loading && <li className="p-2 text-sm text-neutral-500">Loading…</li>}
              {!loading && filteredNotes.length === 0 && (
                <li className="p-2 text-sm text-neutral-500">
                  {query.trim() ? "No matches" : "No notes yet"}
                </li>
              )}
              {filteredNotes.map((n) => {
                const displayTitle = htmlToText(n.title).trim() || "Untitled";
                const newlineAt = n.content.indexOf("\n");
                const body = newlineAt === -1 ? "" : n.content.slice(newlineAt + 1);
                const preview = previewLine(body, 80);
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => select(n.id)}
                      aria-current={n.id === selectedId ? "true" : undefined}
                      className={`w-full text-left pl-3 pr-9 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
                        n.id === selectedId
                          ? "bg-neutral-200 dark:bg-neutral-800"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <div className="text-base font-medium truncate">{displayTitle}</div>
                      {preview && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {preview}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${displayTitle}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(n.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded text-neutral-500 hover:text-red-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 transition-opacity duration-150"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize notes list"
            onMouseDown={onResizeDown}
            onDoubleClick={() => setSidebarWidth(260)}
            className="w-1 -ml-px cursor-col-resize bg-transparent hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          />
        </>
      )}
      <main aria-label="Editor" className="flex-1 flex flex-col min-w-0">
        <div
          className={`${sidebarCollapsed ? "pl-20" : "pl-2"} pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 [-webkit-app-region:drag]`}
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            className="text-sm w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
          {selected && settings.showFormattingButtons && (
            <div className="flex gap-1 [-webkit-app-region:no-drag]">
              <FmtButton label="Bold" title="Bold (⌘B)" onClick={() => applyInline("bold")} className="font-bold">B</FmtButton>
              <FmtButton label="Italic" title="Italic (⌘I)" onClick={() => applyInline("italic")} className="italic">I</FmtButton>
              <FmtButton label="Underline" title="Underline (⌘U)" onClick={() => applyInline("underline")} className="underline">U</FmtButton>
              <FmtButton label="Strikethrough" title="Strikethrough" onClick={() => applyInline("strikeThrough")} className="line-through">S</FmtButton>
              <span className="w-px self-stretch bg-neutral-300 dark:bg-neutral-700 mx-1" />
              <FmtButton label="Heading 1" title="Heading 1" onClick={() => applyHeading("H1")}>H1</FmtButton>
              <FmtButton label="Heading 2" title="Heading 2" onClick={() => applyHeading("H2")}>H2</FmtButton>
              <FmtButton label="Heading 3" title="Heading 3" onClick={() => applyHeading("H3")}>H3</FmtButton>
            </div>
          )}
        </div>
        {selected ? (
          (() => {
            const { title, body } = splitContent(selected.content);
            return (
              <div className="flex-1 flex flex-col min-h-0">
                <input
                  key={`${selected.id}-title`}
                  ref={titleRef}
                  defaultValue={title}
                  onChange={scheduleSave}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.altKey &&
                      !e.ctrlKey &&
                      !e.metaKey
                    ) {
                      e.preventDefault();
                      focusBodyAtStart();
                    }
                  }}
                  onBlur={flushSave}
                  placeholder="Title"
                  className="px-4 pt-4 pb-2 text-2xl font-semibold outline-none bg-transparent"
                />
                <div
                  key={`${selected.id}-body`}
                  ref={(el) => {
                    bodyRef.current = el;
                    if (el && el.dataset.initialized !== "true") {
                      el.innerHTML = body;
                      el.dataset.initialized = "true";
                    }
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck
                  onInput={scheduleSave}
                  onBlur={flushSave}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                  }}
                  className="editor-body flex-1 w-full overflow-auto px-4 pb-4 outline-none bg-transparent text-base whitespace-pre-wrap"
                />
              </div>
            );
          })()
        ) : (
          <div className="p-4 text-sm text-neutral-500">Select or create a note</div>
        )}
      </main>
    </div>
  );
}

export default App;
