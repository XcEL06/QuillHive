import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('@workspace/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(async (cb) => cb({
      insert: vi.fn(),
      select: vi.fn(),
    })),
  },
}));

import { normalizeGroupCreateInput } from '../routes/groups';

const baselineGroupsSql = readFileSync(
  fileURLToPath(new URL('../../../../packages/utils/db/drizzle/0000_baseline.sql', import.meta.url)),
  'utf8'
);

describe('Group create validation', () => {
  it('allows creating a group without a category and defaults privacy', () => {
    const result = normalizeGroupCreateInput({
      name: 'Writers Circle',
      description: 'A place to share drafts.',
      privacy: 'private',
      coverUrl: 'https://example.com/cover.jpg',
    });

    expect(result).toMatchObject({
      name: 'Writers Circle',
      description: 'A place to share drafts.',
      privacy: 'private',
      coverUrl: 'https://example.com/cover.jpg',
      category: 'general',
    });
  });

  it('rejects invalid privacy values', () => {
    expect(() =>
      normalizeGroupCreateInput({
        name: 'Writers Circle',
        privacy: 'secret',
      })
    ).toThrow('Invalid privacy');
  });

  it('keeps privacy and promotion columns in the baseline groups schema', () => {
    expect(baselineGroupsSql).toContain('"privacy" text NOT NULL DEFAULT \'open\'');
    expect(baselineGroupsSql).toContain('"rules" text');
    expect(baselineGroupsSql).toContain('"is_verified" boolean NOT NULL DEFAULT false');
    expect(baselineGroupsSql).toContain('"is_promoted" boolean NOT NULL DEFAULT false');
  });
});
