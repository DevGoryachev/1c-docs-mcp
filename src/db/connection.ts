import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";

export type SqliteDb = Database.Database;

export function openReadonlyDb(): SqliteDb {
  if (!fs.existsSync(config.dbPath)) {
    throw new Error(`Файл базы не найден: ${config.dbPath}. Сначала выполните индексатор.`);
  }
  const db = new Database(config.dbPath, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");
  return db;
}

export function openWritableDb(): SqliteDb {
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(config.dbPath, { readonly: false, fileMustExist: false });
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  return db;
}
