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

import { canCreateGroupPost, getGroupJoinAction, canViewGroupPosts, groupCreateErrorMessage, normalizeGroupCreateInput } from '../routes/groups';

const baselineGroupsSql = readFileSync(
  fileURLToPath(new URL('../../../../packages/utils/db/drizzle/0000_baseline.sql', import.meta.url)),
  'utf8'
);
const communityMigrationSql = readFileSync(
  fileURLToPath(new URL('../../../../packages/utils/db/drizzle/0021_groups_community_model.sql', import.meta.url)),
  'utf8'
);
const privacyInviteMigrationSql = readFileSync(
  fileURLToPath(new URL('../../../../packages/utils/db/drizzle/0024_group_privacy_invites.sql', import.meta.url)),
  'utf8'
);

describe('Group create validation', () => {
  it('allows super admins to inspect private group posts without membership', () => {
    expect(canViewGroupPosts('private', false, true)).toBe(true);
  });

  it('keeps private group posts closed to regular non-members', () => {
    expect(canViewGroupPosts('private', false, false)).toBe(false);
    expect(canViewGroupPosts('private', true, false)).toBe(true);
    expect(canViewGroupPosts('public', false, false)).toBe(true);
  });

  it('selects instant, approval, or invite-only group join behavior', () => {
    expect(getGroupJoinAction('open')).toBe('join');
    expect(getGroupJoinAction('public')).toBe('request');
    expect(getGroupJoinAction('private')).toBe('invite');
  });

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

  it('supports the three privacy states and migrates legacy secret type input', () => {
    expect(normalizeGroupCreateInput({ name: 'Secret Writers', type: 'secret' })).toMatchObject({
      type: 'private',
      privacy: 'private',
    });
    expect(normalizeGroupCreateInput({ name: 'Open Writers', privacy: 'open' }).privacy).toBe('open');
    expect(normalizeGroupCreateInput({ name: 'Public Writers', privacy: 'public' }).privacy).toBe('public');
    expect(normalizeGroupCreateInput({ name: 'Private Writers', privacy: 'private' }).privacy).toBe('private');
    expect(normalizeGroupCreateInput({ name: 'Legacy Gated', type: 'private' }).privacy).toBe('public');
    expect(() => normalizeGroupCreateInput({ name: 'Invalid privacy', privacy: 'secret' })).toThrow('Group privacy must be open, public, or private');
  });

  it('limits descriptions and rules to the community spec', () => {
    expect(() => normalizeGroupCreateInput({ name: 'Writers', description: 'x'.repeat(281) }))
      .toThrow('Description must be 280 characters or fewer');
    expect(() => normalizeGroupCreateInput({ name: 'Writers', rules: ['1', '2', '3', '4', '5', '6'] }))
      .toThrow('Groups can have up to 5 rules');
    expect(normalizeGroupCreateInput({ name: 'Writers', rules: ['Respect the room'] }).rules)
      .toEqual(['Respect the room']);
  });

  it('keeps group posting limited to active members and permitted post types', () => {
    expect(canCreateGroupPost({ status: 'active', role: 'member', isAnnouncementOnly: false, type: 'discussion' })).toBe(true);
    expect(canCreateGroupPost({ status: 'muted', role: 'member', isAnnouncementOnly: false, type: 'discussion' })).toBe(false);
    expect(canCreateGroupPost({ status: 'muted', mutedUntil: new Date(Date.now() - 1_000), role: 'member', isAnnouncementOnly: false, type: 'discussion' })).toBe(true);
    expect(canCreateGroupPost({ status: 'active', role: 'member', isAnnouncementOnly: true, type: 'discussion' })).toBe(false);
    expect(canCreateGroupPost({ status: 'active', role: 'moderator', isAnnouncementOnly: true, type: 'announcement' })).toBe(false);
    expect(canCreateGroupPost({ status: 'active', role: 'admin', isAnnouncementOnly: true, type: 'announcement' })).toBe(true);
    expect(canCreateGroupPost({ status: 'active', role: 'member', isAnnouncementOnly: false, type: 'opportunity_reshare' })).toBe(true);
    expect(canCreateGroupPost({ status: 'active', role: 'member', isAnnouncementOnly: false, type: 'opportunity' })).toBe(false);
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

  it('migrates group identity, moderation state, and structured post metadata', () => {
    expect(communityMigrationSql).toContain('"slug" text NOT NULL');
    expect(communityMigrationSql).toContain('"type" text NOT NULL DEFAULT \'public\'');
    expect(communityMigrationSql).toContain('"trust_score_at_join" integer');
    expect(communityMigrationSql).toContain('CREATE TABLE IF NOT EXISTS "group_post_details"');
    expect(communityMigrationSql).toContain('"opportunity_snapshot" jsonb');
    expect(communityMigrationSql).toContain('"is_announcement" boolean NOT NULL DEFAULT false');
  });

  it('creates expiring private-group invites and migrates legacy privacy safely', () => {
    expect(privacyInviteMigrationSql).toContain('UPDATE "groups"');
    expect(privacyInviteMigrationSql).toContain('SET "privacy" = \'public\'');
    expect(privacyInviteMigrationSql).toContain('SET "type" = \'private\'');
    expect(privacyInviteMigrationSql).toContain('CREATE TABLE IF NOT EXISTS "group_invites"');
    expect(privacyInviteMigrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "group_invites_code_unique"');
  });
});
