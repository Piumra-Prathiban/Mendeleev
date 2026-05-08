import { useState } from "react";
import { useNotes } from "./hooks/useNotes";
import type { Note } from "./types";

function confirmDelete(note: Note | undefined) {
  if (!note) return false;
  const label = note.title || "Untitled";
  return window.confirm(`Delete "${label}"? This cannot be undone.`);
}

function App() {
  const { notes, selected, selectedId, loading, select, create, update, remove } =
    useNotes();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleRemove = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (confirmDelete(note)) remove(id);
  };

  return (
    <div className="flex h-full w-full">
      {sidebarCollapsed ? (
        <div className="pl-20 pr-2 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 [-webkit-app-region:drag] absolute top-0 left-0 right-0 z-10 bg-white dark:bg-neutral-950">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag]"
          >
            Expand
          </button>
        </div>
      ) : (
      <aside
        aria-label="Notes list"
        className="w-[260px] shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col"
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
      )}
      <main aria-label="Editor" className="flex-1 relative">
        {selected ? (
          <textarea
            key={selected.id}
            defaultValue={selected.content}
            onBlur={(e) => update(selected.id, e.target.value)}
            className={`w-full h-full resize-none p-4 outline-none bg-transparent font-mono text-sm ${
              sidebarCollapsed ? "pt-14" : ""
            }`}
            placeholder="# Title&#10;Body…"
          />
        ) : (
          <div className={`p-4 text-sm text-neutral-500 ${sidebarCollapsed ? "pt-14" : ""}`}>
            Select or create a note
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
