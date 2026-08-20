// lib/storage.ts
//
// Storage abstraction so document uploads aren't hard-coded to one backend.
// LocalFilesystemStorage for local development only (Vercel's serverless
// functions have no persistent disk across invocations, so this must never
// be selected in production); S3StorageAdapter (real AWS S3) for
// production, selected via STORAGE_PROVIDER — nothing above this layer
// changes when the provider changes. Vercel Blob was deliberately NOT
// added as an alternative here: its objects are public-by-obscurity
// (reachable by anyone with the URL), which would weaken the documented
// invariant that every document read re-checks the same permission the
// upload path enforces — real business documents (supplier invoices, tax
// records, business registration) must stay behind that check, not a
// guessable-URL substitute for it.

import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface StoredFile {
  url: string;
  storageKey: string;
}

export interface StorageAdapter {
  save(file: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredFile>;
  read(storageKey: string): Promise<{ buffer: Buffer; mimeType?: string }>;
}

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage", "documents");

class LocalFilesystemStorage implements StorageAdapter {
  async save(file: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredFile> {
    await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    const storageKey = `${randomUUID()}-${safeName(file.filename)}`;
    await writeFile(path.join(LOCAL_STORAGE_DIR, storageKey), file.buffer);
    // Served via app/api/documents/file/[key]/route.ts, which re-checks
    // permissions on every read — this URL is not directly public.
    return { url: `/api/documents/file/${storageKey}`, storageKey };
  }

  async read(storageKey: string): Promise<{ buffer: Buffer }> {
    const buffer = await readFile(path.join(LOCAL_STORAGE_DIR, storageKey));
    return { buffer };
  }
}

class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
      throw new Error("STORAGE_PROVIDER=s3 requires AWS_S3_BUCKET to be set.");
    }
    this.bucket = bucket;
    this.client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  }

  async save(file: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredFile> {
    const storageKey = `documents/${randomUUID()}-${safeName(file.filename)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimeType,
        // Never public — every read goes through the app's own permission
        // check in app/api/documents/file/[key]/route.ts, not a public URL.
        ACL: "private",
      })
    );
    return { url: `/api/documents/file/${encodeURIComponent(storageKey)}`, storageKey };
  }

  async read(storageKey: string): Promise<{ buffer: Buffer; mimeType?: string }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return { buffer: Buffer.concat(chunks), mimeType: result.ContentType };
  }
}

let adapter: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (adapter) return adapter;
  adapter = process.env.STORAGE_PROVIDER === "s3" ? new S3StorageAdapter() : new LocalFilesystemStorage();
  return adapter;
}

// Backward/forward-compatible named export matching the pattern used
// throughout the rest of the codebase and the implementation plan.
export const storage = { save: (f: Parameters<StorageAdapter["save"]>[0]) => getStorage().save(f), read: (k: string) => getStorage().read(k) };
