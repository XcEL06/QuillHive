export interface SpamReviewUser {
  id: number;
  username: string;
  displayName: string;
  createdAt: Date;
}

export interface SpamReviewPost {
  id: number;
  authorId: number;
  content: string;
  createdAt: Date;
}

export interface SpamReviewFollow {
  followerId: number;
  createdAt: Date;
}

export interface SpamReviewSignal {
  userId: number;
  ruleKey: string;
  reason: string;
  evidence: Record<string, unknown>;
}

const TEN_MINUTES = 10 * 60_000;
const SEVEN_DAYS = 7 * 24 * 60 * 60_000;
const externalUrlPattern = /https?:\/\/[^\s<>()]+/gi;
const paymentPattern = /\b(pay(?:ment)?|crypto|wallet|wire transfer|cash ?app|venmo|zelle|send money|investment|guaranteed returns?)\b/i;

function normalizeContent(content: string): string[] {
  return content.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/).filter(Boolean);
}

function areNearDuplicates(left: string, right: string): boolean {
  const a = new Set(normalizeContent(left));
  const b = new Set(normalizeContent(right));
  if (a.size < 5 || b.size < 5) return false;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection) >= 0.8;
}

function externalLinks(content: string): string[] {
  return [...content.matchAll(externalUrlPattern)].map((match) => match[0])
    .filter((url) => !/^https?:\/\/(?:www\.)?quillhive\.(?:com|app)(?:\/|$)/i.test(url));
}

export function detectSpamReviewSignals(
  users: SpamReviewUser[],
  posts: SpamReviewPost[],
  follows: SpamReviewFollow[],
  now = new Date(),
): SpamReviewSignal[] {
  const signals: SpamReviewSignal[] = [];
  const postsByUser = new Map<number, SpamReviewPost[]>();
  for (const post of posts) {
    const userPosts = postsByUser.get(post.authorId) ?? [];
    userPosts.push(post);
    postsByUser.set(post.authorId, userPosts);
  }
  const followsByUser = new Map<number, SpamReviewFollow[]>();
  for (const follow of follows) {
    const userFollows = followsByUser.get(follow.followerId) ?? [];
    userFollows.push(follow);
    followsByUser.set(follow.followerId, userFollows);
  }

  for (const user of users) {
    const userPosts = (postsByUser.get(user.id) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const recentBurst = userPosts.find((post, index) => {
      let start = index;
      while (start > 0 && post.createdAt.getTime() - userPosts[start - 1].createdAt.getTime() <= TEN_MINUTES) start--;
      return index - start + 1 >= 5;
    });
    if (recentBurst) {
      signals.push({
        userId: user.id,
        ruleKey: "burst_posting",
        reason: "Posted five or more times within ten minutes.",
        evidence: { postIds: userPosts.filter((post) => Math.abs(post.createdAt.getTime() - recentBurst.createdAt.getTime()) <= TEN_MINUTES).map((post) => post.id) },
      });
    }

    let duplicatePair: [SpamReviewPost, SpamReviewPost] | undefined;
    for (let i = 0; i < userPosts.length && !duplicatePair; i++) {
      for (let j = i + 1; j < userPosts.length; j++) {
        if (areNearDuplicates(userPosts[i].content, userPosts[j].content)) {
          duplicatePair = [userPosts[i], userPosts[j]];
          break;
        }
      }
    }
    if (duplicatePair) {
      signals.push({
        userId: user.id,
        ruleKey: "duplicate_content",
        reason: "Repeated near-duplicate text across multiple posts.",
        evidence: { postIds: duplicatePair.map((post) => post.id), sample: duplicatePair[0].content.slice(0, 400) },
      });
    }

    const linkHeavyPost = userPosts.find((post) => {
      const links = externalLinks(post.content);
      const text = post.content.replace(externalUrlPattern, " ").trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      return links.length >= 2 && links.length / Math.max(words + links.length, 1) >= 0.35;
    });
    if (linkHeavyPost) {
      signals.push({
        userId: user.id,
        ruleKey: "link_heavy",
        reason: "Post contains a high ratio of external links to text.",
        evidence: { postId: linkHeavyPost.id, links: externalLinks(linkHeavyPost.content).length, sample: linkHeavyPost.content.slice(0, 400) },
      });
    }

    const firstPosts = [...userPosts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 5);
    const scamPost = firstPosts.find((post) => externalLinks(post.content).length > 0 || paymentPattern.test(post.content));
    if (now.getTime() - user.createdAt.getTime() <= SEVEN_DAYS && scamPost) {
      signals.push({
        userId: user.id,
        ruleKey: "new_account_link_or_payment",
        reason: "New account's first posts contain an external link or payment solicitation.",
        evidence: { postId: scamPost.id, accountAgeHours: Math.max(0, Math.round((now.getTime() - user.createdAt.getTime()) / 3_600_000)), sample: scamPost.content.slice(0, 400) },
      });
    }

    const userFollows = [...(followsByUser.get(user.id) ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const massFollow = userFollows.find((follow, index) => {
      let start = index;
      while (start > 0 && follow.createdAt.getTime() - userFollows[start - 1].createdAt.getTime() <= TEN_MINUTES) start--;
      return index - start + 1 >= 25;
    });
    if (massFollow) {
      signals.push({
        userId: user.id,
        ruleKey: "rapid_mass_following",
        reason: "Followed 25 or more accounts within ten minutes.",
        evidence: { followsInWindow: 25, detectedAt: massFollow.createdAt.toISOString() },
      });
    }
  }

  return signals;
}
