export interface FeedAdCandidate {
  id: number;
  isSponsored?: boolean;
  isBoosted?: boolean;
}

const ORGANIC_POSTS_PER_AD = 7;

export function getFeedAdPlacementPostIds(posts: readonly FeedAdCandidate[]): Set<number> {
  const placements = new Set<number>();
  let organicPostCount = 0;

  posts.forEach((post, index) => {
    if (post.isSponsored || post.isBoosted) return;

    organicPostCount += 1;
    if (organicPostCount % ORGANIC_POSTS_PER_AD === 0 && index < posts.length - 1) {
      placements.add(post.id);
    }
  });

  return placements;
}
