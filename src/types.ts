export type Note = {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export type TrashedNote = Note & { deleted_at: number };

export type BackupResult = {
  path: string;
  noteCount: number;
  createdAt: string;
};

export type BackupInfo = {
  backupDir: string;
  latestBackup: BackupResult | null;
};
