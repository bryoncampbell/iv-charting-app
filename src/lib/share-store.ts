/**
 * Store for shared visit summaries. Uses file system so the link works
 * when opened later or after server restart (single-server / self-hosted).
 * Falls back to in-memory if fs is unavailable.
 * For serverless (e.g. Vercel with multiple instances), use Redis/KV so
 * the same token is available across instances.
 */

import fs from "fs";
import os from "os";
import path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TOKEN_BYTES = 24;

const memoryStore = new Map<string, Record<string, any>>();

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function getStorageDir(): string | null {
  const candidates = [
    path.join(process.cwd(), ".data", "share-summaries"),
    path.join(os.tmpdir(), "share-summaries"),
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, ".write-test"), "");
      fs.unlinkSync(path.join(dir, ".write-test"));
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}

function getFilePath(token: string): string | null {
  const dir = getStorageDir();
  if (!dir) return null;
  return path.join(dir, `${token}.json`);
}

export function createShareToken(payload: Record<string, unknown>): string {
  const token = generateToken();
  memoryStore.set(token, payload as Record<string, any>);

  const filePath = getFilePath(token);
  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
    } catch {
      // Keep in-memory only
    }
  }

  return token;
}

export function getShareSummary(token: string): Record<string, unknown> | null {
  const filePath = getFilePath(token);
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(raw) as Record<string, unknown>;
        return data;
      }
    } catch {
      // Fall through to memory
    }
  }

  const data = memoryStore.get(token);
  return data ?? null;
}
