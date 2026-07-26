/**
 * Unzip an uploaded LinkedIn export archive (server-only) and hand the pure
 * parser the CSVs it needs. Isolated from the pure module so unit tests never
 * pull the zip engine. The archive is untrusted: we bound the work (entry
 * count, per-file and total decompressed size) and only ever read a fixed
 * whitelist of filenames — path/content beyond that is ignored, and nothing
 * is written to disk (in-memory only).
 */
import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import type { LinkedInFiles } from "./linkedin-export";

const MAX_BYTES = 10 * 1024 * 1024; // matches the server-action body limit
const MAX_ENTRIES = 500; // a real export has a few dozen files
const MAX_FILE_BYTES = 5 * 1024 * 1024; // one CSV
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // decompression bomb ceiling

export class LinkedInExportError extends Error {}

// The export stores files at the archive root; match case-insensitively on the
// basename so a nested or localized layout still resolves.
const WANTED: { key: keyof LinkedInFiles; base: string }[] = [
  { key: "profile", base: "profile.csv" },
  { key: "positions", base: "positions.csv" },
  { key: "skills", base: "skills.csv" },
  { key: "education", base: "education.csv" },
  // Already in the archive the person hands over, and previously ignored.
  // Recommendations are the only text on a profile written by SOMEONE ELSE,
  // and they routinely state the scope a CV omits ("pilotait une équipe de
  // 12"). Job-seeker preferences say where the person PROJECTS themselves —
  // the one signal that is about the next rung rather than the last one.
  { key: "recommendationsReceived", base: "recommendations_received.csv" },
  { key: "jobSeekerPreferences", base: "job seeker preferences.csv" },
];

function basename(path: string): string {
  const clean = path.split(/[\\/]/).pop() ?? path;
  return clean.trim().toLowerCase();
}

/** Extract the whitelisted CSVs from the archive. Throws `LinkedInExportError`
 *  on an empty/oversized/invalid archive or one that contains none of them. */
export function extractLinkedInFiles(bytes: Uint8Array): LinkedInFiles {
  if (bytes.byteLength === 0) throw new LinkedInExportError("empty file");
  if (bytes.byteLength > MAX_BYTES)
    throw new LinkedInExportError("file too large");

  let entries: Record<string, Uint8Array>;
  try {
    // Only decompress the whitelisted files (fflate filter) — everything else
    // is skipped WITHOUT expansion. Ordering matters: the whitelist test comes
    // first, so a large unrelated member (e.g. messages.csv) never triggers a
    // false rejection; then the per-file cap; then a cumulative ceiling that
    // is enforced BEFORE decompression, so duplicate whitelisted basenames
    // cannot inflate past the ceiling (fflate allocates originalSize per
    // matched entry as it iterates — the post-loop check would run too late).
    let count = 0;
    let wantedTotal = 0;
    entries = unzipSync(bytes, {
      filter(file) {
        count++;
        if (count > MAX_ENTRIES)
          throw new LinkedInExportError("too many entries");
        if (!WANTED.some((w) => w.base === basename(file.name))) return false;
        if (file.originalSize > MAX_FILE_BYTES)
          throw new LinkedInExportError("entry too large");
        wantedTotal += file.originalSize;
        if (wantedTotal > MAX_TOTAL_BYTES)
          throw new LinkedInExportError("archive too large");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof LinkedInExportError) throw error;
    throw new LinkedInExportError("could not read the archive");
  }

  const files: LinkedInFiles = {};
  for (const [name, data] of Object.entries(entries)) {
    const match = WANTED.find((w) => w.base === basename(name));
    if (match) files[match.key] = strFromU8(data);
  }

  if (!files.profile && !files.positions && !files.skills) {
    throw new LinkedInExportError("not a LinkedIn export");
  }
  return files;
}
