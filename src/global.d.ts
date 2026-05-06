import type { NotesApi } from "../electron/preload";

declare global {
  interface Window {
    notes: NotesApi;
  }
}

export {};
