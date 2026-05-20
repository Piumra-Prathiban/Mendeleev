import type { BackupsApi, NotesApi } from "../electron/preload";

declare global {
  interface Window {
    notes: NotesApi;
    backups: BackupsApi;
  }
}

export {};
