import { useCallback, useEffect, useMemo, useState } from "react";
import type { Note } from "../types";
import * as api from "../lib/api";

const byUpdatedDesc = (a: Note, b: Note) => b.updated_at - a.updated_at;

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return {
    notes,
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
