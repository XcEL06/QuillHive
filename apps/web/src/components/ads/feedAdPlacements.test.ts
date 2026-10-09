import { describe, expect, it } from "vitest";
import { getFeedAdPlacementPostIds } from "./feedAdPlacements";

describe("getFeedAdPlacementPostIds", () => {
  it("places ads after each seven eligible organic posts", () => {
    const posts = Array.from({ length: 20 }, (_, index) => ({ id: index + 1 }));

    expect([...getFeedAdPlacementPostIds(posts)]).toEqual([7, 14]);
  });

  it("does not count sponsored or boosted posts toward ad spacing", () => {
    const posts = [
      ...Array.from({ length: 6 }, (_, index) => ({ id: index + 1 })),
      { id: 7, isSponsored: true },
      { id: 8, isBoosted: true },
      ...Array.from({ length: 9 }, (_, index) => ({ id: index + 9 })),
    ];

    expect([...getFeedAdPlacementPostIds(posts)]).toEqual([9, 16]);
  });

  it("does not append an ad after the last displayed post", () => {
    const posts = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));

    expect(getFeedAdPlacementPostIds(posts).size).toBe(0);
  });

  it("keeps placement positions stable as feed pages are appended", () => {
    const firstPage = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
    const nextPage = Array.from({ length: 8 }, (_, index) => ({ id: index + 8 }));

    expect(getFeedAdPlacementPostIds(firstPage).size).toBe(0);
    expect([...getFeedAdPlacementPostIds([...firstPage, ...nextPage])]).toEqual([7, 14]);
  });
});
