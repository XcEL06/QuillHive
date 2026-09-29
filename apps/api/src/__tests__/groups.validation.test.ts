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

import { groupCreateErrorMessage, normalizeGroupCreateInput } from '../routes/groups';

const baselineGroupsSql = readFileSync(
  fileURLToPath(new URL('../../../../packages/utils/db/drizzle/0000_baseline.sql', import.meta.url)),
  'utf8'
);

describe('Group create validation', () => {
  it('allows creating a private group without a category', () => {
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

  it('defaults missing privacy to open', () => {
    expect(normalizeGroupCreateInput({ name: 'Writers Circle' })).toMatchObject({
      privacy: 'open',
      category: 'general',
    });
  });

  it('rejects privacy values outside the groups schema enum', () => {
    expect(() =>
      normalizeGroupCreateInput({
        name: 'Writers Circle',
        privacy: 'secret',
      })
    ).toThrow('Privacy must be open or private');
    expect(() =>
      normalizeGroupCreateInput({
        name: 'Writers Circle',
        privacy: 'public',
      })
    ).toThrow('Privacy must be open or private');
  });

  it('requires a non-empty name', () => {
    expect(() => normalizeGroupCreateInput({ name: '   ' })).toThrow('Name is required');
  });

  it('returns a clear schema error without exposing database details', () => {
    expect(groupCreateErrorMessage({
      code: '42703',
      message: 'column groups.privacy does not exist; query: SELECT secret',
    })).toBe('Group creation is temporarily unavailable because the database schema needs an update. Please try again later.');
  });

  it('returns a generic error without exposing unexpected database details', () => {
    expect(groupCreateErrorMessage(new Error('raw SQL should not be returned')))
      .toBe('Could not create group. Please try again.');
  });

  it('keeps privacy and promotion columns in the baseline groups schema', () => {
    expect(baselineGroupsSql).toContain('"privacy" text NOT NULL DEFAULT \'open\'');
    expect(baselineGroupsSql).toContain('"rules" text');
    expect(baselineGroupsSql).toContain('"is_verified" boolean NOT NULL DEFAULT false');
    expect(baselineGroupsSql).toContain('"is_promoted" boolean NOT NULL DEFAULT false');
  });
});
