import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));

import { postBodySchema } from "../features/posts/post.routes";

describe("post create validation", () => {
  it("accepts nullable generated-client fields and supported poem posts", () => {
    const result = postBodySchema.safeParse({
      title: null,
      content: "A poem submitted from the editor.",
      excerpt: null,
      type: "poem",
      imageUrl: null,
      isPublished: true,
    });

    expect(result.success).toBe(true);
  });

  it("continues to accept Spark creation with its audience setting", () => {
    const result = postBodySchema.safeParse({
      content: "A quick spark.",
      type: "spark",
      visibility: "followers",
      isPublished: true,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid external project URL and rejects malformed URLs", () => {
    const base = {
      title: "Gallery artwork",
      content: "<p>Artwork description</p>",
      type: "artwork",
      isPublished: true,
    };

    expect(postBodySchema.safeParse({ ...base, externalUrl: "https://portfolio.example/project" }).success).toBe(true);
    expect(postBodySchema.safeParse({ ...base, externalUrl: "not a URL" }).success).toBe(false);
  });
});
