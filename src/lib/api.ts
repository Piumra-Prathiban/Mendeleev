import type { BackupInfo, BackupResult, Note, TrashedNote } from "../types";

export const listNotes = (): Promise<Note[]> => window.notes.list();
export const getNote = (id: string): Promise<Note | null> => window.notes.get(id);
export const createNote = (): Promise<Note> => window.notes.create();
export const updateNote = (id: string, content: string): Promise<Note> =>
  window.notes.update(id, content);
export const deleteNote = (id: string): Promise<void> => window.notes.remove(id);
export const searchNotes = (query: string): Promise<Note[]> => window.notes.search(query);
export const listTrashedNotes = (): Promise<TrashedNote[]> => window.notes.trashList();
export const restoreNote = (id: string): Promise<void> => window.notes.restore(id);
export const permanentDeleteNote = (id: string): Promise<void> => window.notes.permanentDelete(id);
export const emptyTrash = (): Promise<void> => window.notes.emptyTrash();
export const exportNoteTxt = (title: string, content: string): Promise<string | null> =>
  window.notes.exportTxt(title, content);
export const getBackupInfo = (): Promise<BackupInfo> => window.backups.info();
export const exportBackup = (): Promise<BackupResult | null> => window.backups.export();
export const restoreBackup = (): Promise<BackupResult | null> => window.backups.restore();
