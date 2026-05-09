import { useRef, useState } from "react";
import { useNotes } from "./hooks/useNotes";
import type { Note } from "./types";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 600;

function confirmDelete(note: Note | undefined) {
  if (!note) return false;
  const label = note.title || "Untitled";
  return window.confirm(`Delete "${label}"? This cannot be undone.`);
}

function App() {
  const { notes, selected, selectedId, loading, select, create, update, remove } =
    useNotes();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const dragStart = useRef<{ x: number; w: number } | null>(null);

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
      {!sidebarCollapsed && (
        <>
          <aside
            aria-label="Notes list"
            style={{ width: sidebarWidth }}
            className="shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col"
          >
            <div className="pl-20 pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 [-webkit-app-region:drag]">
              <button
                type="button"
                onClick={() => create()}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag]"
              >
                New
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => handleRemove(selectedId)}
                  className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag]"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag] ml-auto"
              >
                Collapse
              </button>
            </div>
            <ul className="flex-1 overflow-auto">
              {loading && <li className="p-2 text-sm text-neutral-500">Loading…</li>}
              {!loading && notes.length === 0 && (
                <li className="p-2 text-sm text-neutral-500">No notes yet</li>
              )}
              {notes.map((n) => (
                <li key={n.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => select(n.id)}
                    className={`w-full text-left pl-3 pr-9 py-2 text-base font-medium truncate ${
                      n.id === selectedId
                        ? "bg-neutral-200 dark:bg-neutral-800"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {n.title || "Untitled"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${n.title || "Untitled"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(n.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded text-neutral-500 hover:text-red-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
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
        {sidebarCollapsed && (
          <div className="pl-20 pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 [-webkit-app-region:drag]">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag]"
            >
              Expand
            </button>
          </div>
        )}
        {selected ? (
          <textarea
            key={selected.id}
            defaultValue={selected.content}
            onBlur={(e) => update(selected.id, e.target.value)}
            className="flex-1 w-full resize-none p-4 outline-none bg-transparent font-mono text-sm"
            placeholder="# Title&#10;Body…"
          />
        ) : (
          <div className="p-4 text-sm text-neutral-500">Select or create a note</div>
        )}
      </main>
    </div>
  );
}

export default App;
