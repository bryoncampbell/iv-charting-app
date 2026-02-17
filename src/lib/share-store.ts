/**
 * Store for shared visit summaries.
 * When Supabase is configured, uses share_summaries table so links work across
 * serverless instances (Vercel). Otherwise uses file system or in-memory.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

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

export async function createShareToken(payload: Record<string, unknown>): Promise<string> {
  const token = generateToken();

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from("share_summaries").insert({ token, payload });
    if (error) {
      console.error("share-store: Supabase insert failed:", error);
      throw new Error("Could not create share link");
    }
    return token;
  }

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

export async function getShareSummary(token: string): Promise<Record<string, unknown> | null> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("share_summaries")
      .select("payload")
      .eq("token", token)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as Record<string, unknown>;
  }

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
