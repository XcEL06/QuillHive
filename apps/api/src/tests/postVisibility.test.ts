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
    expect(query.params.filter(value => value === viewerId)).toHaveLength(2);
  });
});
