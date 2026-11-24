import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "cse.db");

if (!fs.existsSync(dbPath)) {
  throw new Error(
    `CSE database not found at: ${dbPath}. Please restore data/cse.db`
  );
}

export const db = new Database(dbPath, {
  readonly: true,
  fileMustExist: true,
});