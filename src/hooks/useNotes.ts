import { useCallback, useEffect, useMemo, useState } from "react";
import type { Note } from "../types";
import * as api from "../lib/api";
import { htmlToText } from "../lib/text";

const byUpdatedDesc = (a: Note, b: Note) => b.updated_at - a.updated_at;

const LAST_SELECTED_KEY = "mendeleev:lastSelectedId";

function readLastSelected(): string | null {
  try {
    return localStorage.getItem(LAST_SELECTED_KEY);
  } catch {
    return null;
  }
}

function writeLastSelected(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_SELECTED_KEY, id);
    else localStorage.removeItem(LAST_SELECTED_KEY);
  } catch {}
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const list = await api.listNotes();
    setNotes(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await api.listNotes();
      if (cancelled) return;
      setNotes(list);
      setSelectedId((prev) => {
        if (prev) return prev;
        const stored = readLastSelected();
        if (stored && list.some((n) => n.id === stored)) return stored;
        return list[0]?.id ?? null;
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeLastSelected(selectedId);
  }, [selectedId]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const create = useCallback(async () => {
    const note = await api.createNote();
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    return note;
  }, []);

  const update = useCallback(async (id: string, content: string) => {
    const updated = await api.updateNote(id, content);
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? updated : n)).sort(byUpdatedDesc),
    );
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteNote(id);
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      setSelectedId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }, []);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId),
    [notes, selectedId],
  );

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const hay = (htmlToText(n.title) + " " + htmlToText(n.content)).toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query]);

  useEffect(() => {
    if (selectedId && !filteredNotes.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredNotes, selectedId]);

  return {
    notes,
    filteredNotes,
    query,
    setQuery,
    selectedId,
    selected,
    loading,
    select,
    create,
    update,
    remove,
    refresh,
  };
}
