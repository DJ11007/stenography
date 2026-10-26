"use server";
// TEMPORARY, local development only -- not committed. Saves a paper-solution screenshot (JPEG data URI)
// to public/tmp-solution so the admin question editor can pick it up; the folder is deleted afterwards.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeSolutionImage(name: string, dataUrl: string) {
  if (process.env.NODE_ENV !== "development" || !/^[a-z0-9-]+\.jpg$/.test(name) || !dataUrl.startsWith("data:image/jpeg;base64,")) return { ok: false };
  const folder = path.join(process.cwd(), "public", "tmp-solution");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, name), Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64"));
  return { ok: true };
}
