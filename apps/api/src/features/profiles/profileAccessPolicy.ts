export function canViewProfileWithSignals(input: {
  profileUserId: number;
  viewerId: number | null;
  profileVisibility: string;
  isBlocked: boolean;
  isFollowing: boolean;
}): boolean {
  if (input.viewerId === input.profileUserId) return true;
  if (input.isBlocked) return false;
  if (input.profileVisibility === "public") return true;
  return input.profileVisibility === "followers" && input.viewerId !== null && input.isFollowing;
}
