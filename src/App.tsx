import { useNotes } from "./hooks/useNotes";

function App() {
  const { notes, selected, selectedId, loading, select, create, update, remove } =
    useNotes();

  return (
    <div className="flex h-full w-full">
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
              onClick={() => remove(selectedId)}
              className="text-sm px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded [-webkit-app-region:no-drag]"
            >
              Delete
            </button>
          )}
        </div>
        <ul className="flex-1 overflow-auto">
          {loading && <li className="p-2 text-sm text-neutral-500">Loading…</li>}
          {!loading && notes.length === 0 && (
            <li className="p-2 text-sm text-neutral-500">No notes yet</li>
          )}
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => select(n.id)}
                className={`w-full text-left px-3 py-2 text-sm truncate ${
                  n.id === selectedId
                    ? "bg-neutral-200 dark:bg-neutral-800"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
              >
                {n.title || "Untitled"}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main aria-label="Editor" className="flex-1">
        {selected ? (
          <textarea
            key={selected.id}
            defaultValue={selected.content}
            onBlur={(e) => update(selected.id, e.target.value)}
            className="w-full h-full resize-none p-4 outline-none bg-transparent font-mono text-sm"
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
