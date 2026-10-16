import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { postVisibilityCondition } from "../features/posts/postVisibility";

const dialect = new PgDialect();

describe("Spark visibility", () => {
  it("limits anonymous viewers to public Sparks", () => {
    const query = dialect.sqlToQuery(postVisibilityCondition(null));

    expect(query.params).toEqual(["spark", "spark", "public"]);
    expect(query.sql).not.toContain("follows");
  });

  it("allows authors to see their own Sparks and followers to see follower-only Sparks", () => {
    const viewerId = 42;
    const query = dialect.sqlToQuery(postVisibilityCondition(viewerId));

    expect(query.sql).toMatch(/author_id.*=\s*\$\d/);
    expect(query.sql).toMatch(/follower_id.*=\s*\$\d/);
    expect(query.sql).toContain("profile_visibility");
    expect(query.sql).toContain("show_posts_to_everyone");
    expect(query.params.filter(value => value === viewerId).length).toBeGreaterThanOrEqual(3);
  });

  it("allows group posts based on group visibility rather than the author's profile feed setting", () => {
    const query = dialect.sqlToQuery(postVisibilityCondition(42));

    expect(query.sql).toContain('"posts"."group_id" IS NOT NULL or EXISTS');
    expect(query.sql).toContain("visibility_group.privacy");
    expect(query.sql).toContain("profile_visibility");
  });

  it("removes Spark and group visibility predicates for super-admin inspection queries", () => {
    const query = dialect.sqlToQuery(postVisibilityCondition(42, true));

    expect(query.sql).toBe("TRUE");
    expect(query.params).toEqual([]);
  });
});
