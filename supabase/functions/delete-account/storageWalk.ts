// Pure helper (no Deno APIs) so vitest can cover it.
//
// Storage `list(prefix)` returns ONE level: files have an `id`, "folders" do not.
// Activity photos live at `feed/{userId}/{runId}/{name}`, so listing only
// `{userId}` returned folders, `remove()` of a folder name deletes nothing, and
// every photo outlived the account. This walks the whole tree, page by page.

export interface StorageEntry { name: string; id: string | null }
export type ListFn = (
  prefix: string,
  opts: { limit: number; offset: number },
) => Promise<StorageEntry[]>;

const PAGE = 100;
const MAX_DEPTH = 6;          // userId/runId/photos is 3; leave headroom, never loop forever
const MAX_FILES = 20_000;     // bound the work for one deletion

export async function collectFilePaths(list: ListFn, root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(prefix: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    for (let offset = 0; files.length < MAX_FILES; offset += PAGE) {
      const page = await list(prefix, { limit: PAGE, offset });
      for (const entry of page) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id) files.push(path);
        else await walk(path, depth + 1);
      }
      if (page.length < PAGE) break;
    }
  }

  await walk(root, 0);
  return files;
}
