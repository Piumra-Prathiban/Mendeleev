import fs from "node:fs";
import path from "node:path";
import type { Note } from "../src/types";

const BACKUP_VERSION = 1;
const AUTO_BACKUP_LIMIT = 14;

export type BackupResult = {
  path: string;
  noteCount: number;
  createdAt: string;
};

export type BackupInfo = {
  backupDir: string;
  latestBackup: BackupResult | null;
};

type BackupFile = {
  app: "Mendeleev";
  version: number;
  createdAt: string;
  notes: Note[];
};

const pad = (value: number) => String(value).padStart(2, "0");

function timestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function dateStamp(date = new Date()) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

function ensureJsonPath(filePath: string) {
  return filePath.toLowerCase().endsWith(".json") ? filePath : `${filePath}.json`;
}

function writeBackup(filePath: string, notes: Note[]): BackupResult {
  const createdAt = new Date().toISOString();
  const payload: BackupFile = {
    app: "Mendeleev",
    version: BACKUP_VERSION,
    createdAt,
    notes,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
  return { path: filePath, noteCount: notes.length, createdAt };
}

function backupSummary(filePath: string): BackupResult | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BackupFile>;
    if (!Array.isArray(parsed.notes) || typeof parsed.createdAt !== "string") return null;
    return { path: filePath, noteCount: parsed.notes.length, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function listBackupFiles(backupDir: string) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(backupDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function pruneAutomaticBackups(backupDir: string) {
  const files = listBackupFiles(backupDir).filter((filePath) =>
    path.basename(filePath).startsWith("mendeleev-auto-"),
  );
  for (const filePath of files.slice(AUTO_BACKUP_LIMIT)) {
    fs.unlinkSync(filePath);
  }
}

function validateNote(value: unknown): Note {
  if (!value || typeof value !== "object") throw new Error("Backup contains an invalid note.");
  const note = value as Partial<Note>;
  if (
    typeof note.id !== "string" ||
    typeof note.title !== "string" ||
    typeof note.content !== "string" ||
    typeof note.created_at !== "number" ||
    typeof note.updated_at !== "number"
  ) {
    throw new Error("Backup contains an invalid note.");
  }
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

export function createManualBackup(filePath: string, notes: Note[]) {
  return writeBackup(ensureJsonPath(filePath), notes);
}

export function createAutomaticBackup(backupDir: string, notes: Note[]) {
  const filePath = path.join(backupDir, `mendeleev-auto-${dateStamp()}.json`);
  if (fs.existsSync(filePath)) return backupSummary(filePath);
  const result = writeBackup(filePath, notes);
  pruneAutomaticBackups(backupDir);
  return result;
}

export function createSafetyBackup(backupDir: string, notes: Note[]) {
  return writeBackup(path.join(backupDir, `mendeleev-before-restore-${timestamp()}.json`), notes);
}

export function readBackup(filePath: string): Note[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<BackupFile>;
  if (parsed.app !== "Mendeleev" || parsed.version !== BACKUP_VERSION) {
    throw new Error("This is not a supported Mendeleev backup file.");
  }
  if (!Array.isArray(parsed.notes)) throw new Error("Backup file does not contain notes.");
  return parsed.notes.map(validateNote);
}

export function getBackupInfo(backupDir: string): BackupInfo {
  const latestBackup =
    listBackupFiles(backupDir)
      .map(backupSummary)
      .find((summary): summary is BackupResult => summary !== null) ?? null;
  return { backupDir, latestBackup };
}
