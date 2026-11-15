import { describe, expect, it } from 'vitest';
import { collectFilePaths, type ListFn, type StorageEntry } from './storageWalk';

const file = (name: string): StorageEntry => ({ name, id: `id-${name}` });
const folder = (name: string): StorageEntry => ({ name, id: null });

/** A fake bucket: path prefix -> entries, served in pages like Supabase does. */
const fakeList = (tree: Record<string, StorageEntry[]>): ListFn =>
  async (prefix, { limit, offset }) => (tree[prefix] ?? []).slice(offset, offset + limit);

describe('collectFilePaths', () => {
  it('finds files nested under run folders (the case the old top-level listing missed)', async () => {
    const list = fakeList({
      u1: [file('avatar.jpg'), folder('run-1'), folder('run-2')],
      'u1/run-1': [file('a.jpg'), file('b.jpg')],
      'u1/run-2': [file('c.jpg')],
    });
    expect((await collectFilePaths(list, 'u1')).sort()).toEqual([
      'u1/avatar.jpg', 'u1/run-1/a.jpg', 'u1/run-1/b.jpg', 'u1/run-2/c.jpg',
    ]);
  });

  it('reads every page, not just the first', async () => {
    const many = Array.from({ length: 250 }, (_, i) => file(`p${i}.jpg`));
    expect(await collectFilePaths(fakeList({ u1: many }), 'u1')).toHaveLength(250);
  });

  it('returns nothing for an empty or missing folder', async () => {
    expect(await collectFilePaths(fakeList({}), 'u1')).toEqual([]);
  });

  it('stops descending past the depth limit instead of looping', async () => {
    const tree: Record<string, StorageEntry[]> = {};
    let path = 'u1';
    for (let i = 0; i < 20; i++) { tree[path] = [folder('d')]; path += '/d'; }
    expect(await collectFilePaths(fakeList(tree), 'u1')).toEqual([]);
  });
});
