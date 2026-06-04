import { useCallback, useEffect, useRef, useState } from "react";
import { useNotes, type SortBy } from "./hooks/useNotes";
import { emptyTrash, exportBackup, getBackupInfo, listTrashedNotes, permanentDeleteNote, restoreBackup, restoreNote } from "./lib/api";
import { htmlToText, previewLine } from "./lib/text";
import type { BackupInfo, TrashedNote } from "./types";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 600;
const SAVE_DEBOUNCE_MS = 300;

type Settings = {
  splashEnabled: boolean;
  splashDurationMs: number;
  showFormattingButtons: boolean;
  theme: "light" | "dark";
};

function systemTheme(): Settings["theme"] {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

const DEFAULT_SETTINGS: Settings = {
  splashEnabled: true,
  splashDurationMs: 1900,
  showFormattingButtons: true,
  theme: systemTheme(),
};

const SETTINGS_KEY = "mendeleev:settings";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (merged.theme !== "light" && merged.theme !== "dark") merged.theme = DEFAULT_SETTINGS.theme;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

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
  onBackupRestored,
}: {
  settings: Settings;
  patch: (p: Partial<Settings>) => void;
  onClose: () => void;
  onBackupRestored: () => Promise<void>;
}) {
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [backupStatus, setBackupStatus] = useState<string>("");
  const [backupBusy, setBackupBusy] = useState(false);

  const refreshBackupInfo = useCallback(async () => {
    setBackupInfo(await getBackupInfo());
  }, []);

  useEffect(() => {
    refreshBackupInfo();
  }, [refreshBackupInfo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleExportBackup = async () => {
    setBackupBusy(true);
    setBackupStatus("");
    try {
      const result = await exportBackup();
      if (result) {
        setBackupStatus(`Exported ${result.noteCount} notes.`);
        await refreshBackupInfo();
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : "Backup export failed.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!window.confirm("Restore this backup? Current notes will be replaced after a safety backup is created.")) {
      return;
    }
    setBackupBusy(true);
    setBackupStatus("");
    try {
      const result = await restoreBackup();
      if (result) {
        await onBackupRestored();
        await refreshBackupInfo();
        setBackupStatus(`Restored ${result.noteCount} notes.`);
      }
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : "Backup restore failed.");
    } finally {
      setBackupBusy(false);
    }
  };

  const latestBackup = backupInfo?.latestBackup;

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

          <Row
            label="Theme"
            hint={settings.theme === "dark" ? "Use dark appearance" : "Use light appearance"}
          >
            <Toggle
              checked={settings.theme === "dark"}
              onChange={(v) => patch({ theme: v ? "dark" : "light" })}
            />
          </Row>

          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="text-sm font-medium">Backups</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Automatic daily backups are kept locally. Restore creates a safety backup first.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={backupBusy}
                onClick={handleExportBackup}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
              >
                Export Backup
              </button>
              <button
                type="button"
                disabled={backupBusy}
                onClick={handleRestoreBackup}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
              >
                Restore Backup
              </button>
            </div>
            <div className="text-xs text-neutral-500 mt-2 truncate" title={backupInfo?.backupDir}>
              {latestBackup
                ? `Latest: ${new Date(latestBackup.createdAt).toLocaleString()} (${latestBackup.noteCount} notes)`
                : "No backups yet"}
            </div>
            {backupStatus && <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{backupStatus}</div>}
          </div>
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

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="10" x2="8" y2="15" />
      <path d="M5 10h6V7l2-5H3l2 5v3z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="13"
      viewBox="0 0 12 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 3h10M4 3V2h4v1M2 3l.7 8.5A1 1 0 003.7 12h4.6a1 1 0 001-.5L10 3" />
      <line x1="4.5" y1="5.5" x2="4.5" y2="9.5" />
      <line x1="7.5" y1="5.5" x2="7.5" y2="9.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5.5" cy="5.5" r="4" />
      <line x1="8.8" y1="8.8" x2="13" y2="13" />
    </svg>
  );
}

function ZenIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {active ? (
        // compress: corners pointing inward → exit zen
        <path d="M5 1v4H1M9 1v4h4M9 13v-4h4M5 13v-4H1" />
      ) : (
        // expand: corners pointing outward → enter zen
        <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
      )}
    </svg>
  );
}

function TrashPanel({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  onRestored: () => Promise<void>;
}) {
  const [trashed, setTrashed] = useState<TrashedNote[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setTrashed(await listTrashedNotes());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleRestore = async (id: string) => {
    setBusy(true);
    try {
      await restoreNote(id);
      await onRestored();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this note? This cannot be undone.")) return;
    setBusy(true);
    try {
      await permanentDeleteNote(id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (trashed.length === 0) return;
    if (!window.confirm(`Permanently delete all ${trashed.length} notes in the trash? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await emptyTrash();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trash"
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-[90vw] max-h-[70vh] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <h2 className="text-base font-semibold">Trash</h2>
          <div className="flex items-center gap-2">
            {trashed.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleEmptyTrash}
                className="text-xs px-2 py-1 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
              >
                Empty Trash
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trash"
              className="w-7 h-7 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {trashed.length === 0 ? (
            <div className="p-4 text-sm text-neutral-500">Trash is empty</div>
          ) : (
            <ul>
              {trashed.map((n) => {
                const displayTitle = n.title.trim() || "Untitled";
                const deletedDate = new Date(n.deleted_at).toLocaleDateString();
                return (
                  <li key={n.id} className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{displayTitle}</div>
                      <div className="text-xs text-neutral-400 dark:text-neutral-500">Deleted {deletedDate}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRestore(n.id)}
                      className="shrink-0 text-xs px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePermanentDelete(n.id)}
                      className="shrink-0 text-xs px-2 py-1 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                    >
                      Delete Forever
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function splitContent(content: string) {
  const i = content.indexOf("\n");
  if (i === -1) return { title: content, body: "" };
  return { title: content.slice(0, i), body: content.slice(i + 1) };
}

function isSelectionInside(root: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const anchor = sel.anchorNode;
  if (!anchor) return false;
  const anchorEl = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
  return !!anchorEl && root.contains(anchorEl);
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

function currentBlockAlign(root: HTMLElement): "left" | "center" | "right" | "" {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  let node: Node | null = sel.anchorNode;
  while (node && node !== root) {
    if (node instanceof HTMLElement && /^(H[1-6]|P|DIV|LI|BLOCKQUOTE)$/.test(node.tagName)) {
      const align = window.getComputedStyle(node).textAlign;
      if (align === "center") return "center";
      if (align === "right" || align === "end") return "right";
      if (align === "left" || align === "start") return "left";
      return "left";
    }
    node = node.parentNode;
  }
  return "";
}

function applyAlignToSelection(root: HTMLElement, align: "left" | "center" | "right") {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const blockTags = /^(H[1-6]|P|DIV|LI|BLOCKQUOTE)$/;

  // If selection is collapsed, just align the current block element.
  if (range.collapsed) {
    let node: Node | null = range.startContainer;
    while (node && node !== root) {
      if (node instanceof HTMLElement && blockTags.test(node.tagName)) {
        node.style.textAlign = align;
        return;
      }
      node = node.parentNode;
    }
    root.style.textAlign = align;
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if (!(n instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
      if (!blockTags.test(n.tagName)) return NodeFilter.FILTER_SKIP;
      // Only align blocks that intersect the current selection.
      try {
        return range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      } catch {
        // Some older engines can throw for certain nodes; be conservative.
        return NodeFilter.FILTER_SKIP;
      }
    },
  });

  const blocks: HTMLElement[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n instanceof HTMLElement) blocks.push(n);
  }

  if (blocks.length === 0) {
    root.style.textAlign = align;
    return;
  }
  for (const b of blocks) b.style.textAlign = align;
}

function App() {
  const {
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
    refresh,
    pinnedIds,
    togglePin,
    sortBy,
    setSortBy,
  } = useNotes();
  const { settings, patch } = useSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [splashDone, setSplashDone] = useState(!settings.splashEnabled);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [currentAlign, setCurrentAlign] = useState<"left" | "center" | "right">("left");
  const [zenMode, setZenMode] = useState(false);
  const [inlineState, setInlineState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedSecondsAgo, setSavedSecondsAgo] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchCount, setFindMatchCount] = useState(0);
  const lastSavedAt = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; w: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const alignMenuRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const lastEditorRange = useRef<Range | null>(null);
  const prevSidebarCollapsed = useRef(false);
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
    update(id, content).then(() => {
      lastSavedAt.current = Date.now();
      setSaveStatus("saved");
    });
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
    setSaveStatus("saving");
    p.timer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [selected, flushSave]);

  // Flush pending save when switching notes (cleanup runs before next selected.id renders).
  useEffect(() => {
    setSaveStatus("idle");
    lastSavedAt.current = null;
    setFindOpen(false);
    setFindQuery("");
    setFindMatchCount(0);
    clearFindHighlights();
    return () => flushSave();
  }, [selected?.id, flushSave]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const tick = () => {
      if (lastSavedAt.current !== null) {
        setSavedSecondsAgo(Math.floor((Date.now() - lastSavedAt.current) / 1000));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [saveStatus]);

  const focusBody = () => {
    const el = bodyRef.current;
    if (!el) return null;
    if (document.activeElement !== el) el.focus();
    // Restore last known selection so toolbar actions apply at the caret.
    if (!isSelectionInside(el) && lastEditorRange.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(lastEditorRange.current);
      }
    }
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
    const sel = window.getSelection();
    const wasCollapsed = !sel || sel.rangeCount === 0 ? true : sel.getRangeAt(0).collapsed;
    document.execCommand(cmd);
    // If we formatted a selection, don't keep the command "latched" for subsequent typing.
    if (!wasCollapsed) {
      const nextSel = window.getSelection();
      if (nextSel && nextSel.rangeCount > 0) {
        const r = nextSel.getRangeAt(0).cloneRange();
        r.collapse(false);
        nextSel.removeAllRanges();
        nextSel.addRange(r);
        if (document.queryCommandState(cmd)) document.execCommand(cmd);
      }
    }
    scheduleSave();
  };

  const applyHeading = (tag: "H1" | "H2" | "H3") => {
    const el = focusBody();
    if (!el) return;
    const align = currentBlockAlign(el);
    const desired = currentBlockTag(el) === tag ? "P" : tag;
    // Chromium is more reliable with "<h1>" style values.
    document.execCommand("formatBlock", false, `<${desired.toLowerCase()}>`);
    if (align) applyAlignToSelection(el, align);
    scheduleSave();
  };

  const applyAlign = (align: "left" | "center" | "right") => {
    const root = focusBody();
    if (!root) return;
    applyAlignToSelection(root, align);
    setCurrentAlign(align);
    setAlignMenuOpen(false);
    scheduleSave();
  };

  useEffect(() => {
    if (!selected || !settings.showFormattingButtons) return;

    const sync = () => {
      const root = bodyRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const anchor = sel.anchorNode;
      if (!anchor) return;
      const anchorEl = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
      if (!anchorEl || !root.contains(anchorEl)) return;
      // Cache range so toolbar operations don't lose the current selection.
      lastEditorRange.current = sel.getRangeAt(0).cloneRange();
      const align = currentBlockAlign(root);
      if (align) setCurrentAlign(align);
      setInlineState({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
      });
    };

    const onSelectionChange = () => sync();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [selected, settings.showFormattingButtons]);

  useEffect(() => {
    if (!alignMenuOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = alignMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setAlignMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAlignMenuOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [alignMenuOpen]);

  const handleRemove = (id: string) => {
    if (window.confirm("This note will be moved to Trash. Proceed?")) remove(id);
  };

  const enterZen = useCallback(() => {
    prevSidebarCollapsed.current = sidebarCollapsed;
    setSidebarCollapsed(true);
    setZenMode(true);
  }, [sidebarCollapsed]);

  const exitZen = useCallback(() => {
    setSidebarCollapsed(prevSidebarCollapsed.current);
    setZenMode(false);
  }, []);

  useEffect(() => {
    if (!zenMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitZen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zenMode, exitZen]);

  const findRangesRef = useRef<Range[]>([]);
  const findIndexRef = useRef(0);

  const applyFindHighlights = useCallback((ranges: Range[], index: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const highlights = (CSS as any).highlights;
    if (!highlights) return;
    if (ranges.length === 0) {
      highlights.delete("find-all");
      highlights.delete("find-current");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlights.set("find-all", new (window as any).Highlight(...ranges));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    highlights.set("find-current", new (window as any).Highlight(ranges[index]));
    ranges[index]?.startContainer.parentElement?.scrollIntoView({ block: "nearest" });
  }, []);

  const buildFindRanges = useCallback((query: string): Range[] => {
    if (!query) return [];
    const roots: Node[] = [];
    if (titleRef.current) roots.push(titleRef.current);
    if (bodyRef.current) roots.push(bodyRef.current);
    const q = query.toLowerCase();
    const result: Range[] = [];
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent ?? "";
        const lower = text.toLowerCase();
        let pos = 0;
        while ((pos = lower.indexOf(q, pos)) !== -1) {
          const r = document.createRange();
          r.setStart(node, pos);
          r.setEnd(node, pos + q.length);
          result.push(r);
          pos += q.length;
        }
      }
    }
    return result;
  }, []);

  const runFind = useCallback((query: string, index?: number) => {
    const ranges = buildFindRanges(query);
    findRangesRef.current = ranges;
    const idx = index !== undefined ? index : 0;
    findIndexRef.current = Math.max(0, Math.min(idx, ranges.length - 1));
    setFindMatchCount(ranges.length);
    applyFindHighlights(ranges, findIndexRef.current);
  }, [buildFindRanges, applyFindHighlights]);

  const clearFindHighlights = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const highlights = (CSS as any).highlights;
    if (!highlights) return;
    highlights.delete("find-all");
    highlights.delete("find-current");
    findRangesRef.current = [];
    findIndexRef.current = 0;
  }, []);

  const openFind = useCallback(() => {
    setFindOpen(true);
    setTimeout(() => findInputRef.current?.focus(), 0);
  }, []);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindQuery("");
    setFindMatchCount(0);
    clearFindHighlights();
  }, [clearFindHighlights]);

  const findNext = useCallback((backwards = false) => {
    const ranges = findRangesRef.current;
    if (ranges.length === 0) return;
    const next = backwards
      ? (findIndexRef.current - 1 + ranges.length) % ranges.length
      : (findIndexRef.current + 1) % ranges.length;
    findIndexRef.current = next;
    applyFindHighlights(ranges, next);
    findInputRef.current?.focus();
  }, [applyFindHighlights]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        openFind();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, openFind]);

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
          onBackupRestored={async () => { await refresh(); }}
        />
      )}
      {trashOpen && (
        <TrashPanel
          onClose={() => setTrashOpen(false)}
          onRestored={async () => { await refresh(); }}
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
                onClick={() => setTrashOpen(true)}
                aria-label="Open trash"
                title="Trash"
                className="text-sm w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
              >
                <TrashIcon />
              </button>
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
            <div className="px-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-1.5">
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
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  aria-label="Sort notes by"
                  className="text-xs bg-transparent border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-0.5 outline-none transition-colors duration-150 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-600 cursor-pointer"
                >
                  <option value="modified">Last modified</option>
                  <option value="created">Date created</option>
                  <option value="title">Title</option>
                </select>
              </div>
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
                const isPinned = pinnedIds.has(n.id);
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => select(n.id)}
                      aria-current={n.id === selectedId ? "true" : undefined}
                      className={`w-full text-left pl-3 pr-16 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${
                        n.id === selectedId
                          ? "bg-neutral-200 dark:bg-neutral-800"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <div className="text-base font-medium truncate flex items-center gap-1">
                        {isPinned && (
                          <span className="shrink-0 text-neutral-400 dark:text-neutral-500">
                            <PinIcon active={true} />
                          </span>
                        )}
                        {displayTitle}
                      </div>
                      {preview && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {preview}
                        </div>
                      )}
                      <div className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={isPinned ? `Unpin ${displayTitle}` : `Pin ${displayTitle}`}
                      title={isPinned ? "Unpin" : "Pin to top"}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(n.id);
                      }}
                      className={`absolute right-9 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 transition-opacity duration-150 ${
                        isPinned
                          ? "opacity-100 text-neutral-600 dark:text-neutral-400"
                          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      }`}
                    >
                      <PinIcon active={isPinned} />
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
          className={`${sidebarCollapsed ? "pl-20" : "pl-2"} pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 [-webkit-app-region:drag]`}
        >
          {!zenMode && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              className="text-sm w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [-webkit-app-region:no-drag]"
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          )}
          {selected && settings.showFormattingButtons && !zenMode && (
            <div className="flex gap-1 [-webkit-app-region:no-drag]">
              <FmtButton
                label="Bold"
                title="Bold (⌘B)"
                onClick={() => applyInline("bold")}
                className={`font-bold ${inlineState.bold ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
              >
                B
              </FmtButton>
              <FmtButton
                label="Italic"
                title="Italic (⌘I)"
                onClick={() => applyInline("italic")}
                className={`italic ${inlineState.italic ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
              >
                I
              </FmtButton>
              <FmtButton
                label="Underline"
                title="Underline (⌘U)"
                onClick={() => applyInline("underline")}
                className={`underline ${inlineState.underline ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
              >
                U
              </FmtButton>
              <FmtButton
                label="Strikethrough"
                title="Strikethrough"
                onClick={() => applyInline("strikeThrough")}
                className={`line-through ${inlineState.strikeThrough ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
              >
                S
              </FmtButton>
              <span className="w-px self-stretch bg-neutral-300 dark:bg-neutral-700 mx-1" />
              <FmtButton label="Heading 1" title="Heading 1" onClick={() => applyHeading("H1")}>H1</FmtButton>
              <FmtButton label="Heading 2" title="Heading 2" onClick={() => applyHeading("H2")}>H2</FmtButton>
              <FmtButton label="Heading 3" title="Heading 3" onClick={() => applyHeading("H3")}>H3</FmtButton>
              <span className="w-px self-stretch bg-neutral-300 dark:bg-neutral-700 mx-1" />
              <div ref={alignMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Alignment"
                  title="Alignment"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlignMenuOpen((v) => !v)}
                  className="text-sm h-7 px-2 flex items-center justify-center gap-1 border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
                >
                  <span className="min-w-3 text-center">
                    {currentAlign === "left" ? "L" : currentAlign === "center" ? "C" : "R"}
                  </span>
                  <span className="text-[10px] leading-none">▾</span>
                </button>
                {alignMenuOpen && (
                  <div className="absolute z-20 mt-1 left-0 w-36 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shadow-sm p-1">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyAlign("left")}
                      className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 ${currentAlign === "left" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyAlign("center")}
                      className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 ${currentAlign === "center" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyAlign("right")}
                      className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 ${currentAlign === "right" ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
                    >
                      Right
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {selected && saveStatus !== "idle" && (
            <span className={`${zenMode ? "" : "ml-auto"} text-xs text-neutral-400 dark:text-neutral-500 [-webkit-app-region:no-drag]`}>
              {saveStatus === "saving"
                ? "Saving…"
                : savedSecondsAgo < 5
                  ? "Saved just now"
                  : savedSecondsAgo < 60
                    ? `Saved ${savedSecondsAgo}s ago`
                    : `Saved ${Math.floor(savedSecondsAgo / 60)}m ago`}
            </span>
          )}
          {selected && (
            <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
              <button
                type="button"
                onClick={findOpen ? closeFind : openFind}
                aria-label={findOpen ? "Close find in note" : "Find in note (⌘F)"}
                title={findOpen ? "Close find in note" : "Find in note (⌘F)"}
                className={`w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 ${findOpen ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                onClick={zenMode ? exitZen : enterZen}
                aria-label={zenMode ? "Exit zen mode (Esc)" : "Enter zen mode"}
                title={zenMode ? "Exit zen mode (Esc)" : "Zen mode"}
                className="w-7 h-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded transition-colors duration-150 hover:bg-neutral-200 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
              >
                <ZenIcon active={zenMode} />
              </button>
            </div>
          )}
        </div>
        {findOpen && selected && (
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={(e) => {
                const q = e.target.value;
                setFindQuery(q);
                if (q) runFind(q, 0);
                else clearFindHighlights();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.shiftKey ? findNext(true) : findNext(); }
                if (e.key === "Escape") closeFind();
              }}
              placeholder="Find in note…"
              aria-label="Find in note"
              className="flex-1 max-w-xs px-2 py-0.5 text-sm bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
            />
            {findQuery && (
              <span className="text-xs text-neutral-400 shrink-0">
                {findMatchCount > 0 ? `${findMatchCount} match${findMatchCount !== 1 ? "es" : ""}` : "No matches"}
              </span>
            )}
            <button
              type="button"
              onClick={() => findNext(true)}
              aria-label="Previous match"
              title="Previous match (⇧↵)"
              disabled={!findQuery || findMatchCount === 0}
              className="w-6 h-6 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded text-xs transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => findNext(false)}
              aria-label="Next match"
              title="Next match (↵)"
              disabled={!findQuery || findMatchCount === 0}
              className="w-6 h-6 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 rounded text-xs transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={closeFind}
              aria-label="Close find"
              className="w-6 h-6 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              ×
            </button>
          </div>
        )}
        {selected ? (
          (() => {
            const { title, body } = splitContent(selected.content);
            return (
              <div className={`flex-1 flex flex-col min-h-0 ${zenMode ? "items-center overflow-auto" : ""}`}>
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
                  className={
                    zenMode
                      ? "w-full max-w-2xl px-10 pt-16 pb-3 text-2xl font-semibold outline-none bg-transparent"
                      : "px-4 pt-4 pb-2 text-2xl font-semibold outline-none bg-transparent"
                  }
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
                  className={
                    zenMode
                      ? "editor-body w-full max-w-2xl px-10 pb-24 outline-none bg-transparent text-base whitespace-pre-wrap"
                      : "editor-body flex-1 w-full overflow-auto px-4 pb-4 outline-none bg-transparent text-base whitespace-pre-wrap"
                  }
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
