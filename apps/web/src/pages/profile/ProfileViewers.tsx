import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Timestamp } from "@/lib/postTimestamp";
import { Eye, UserPlus, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/usePageTitle";
import { apiFetch } from "@/lib/api";

type ProfileViewer = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  viewedAt: string;
  isFollowing: boolean;
};

export default function ProfileViewers() {
  usePageTitle("Profile Viewers");
  const [viewers, setViewers] = useState<ProfileViewer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followingId, setFollowingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch("/api/users/me/profile-viewers")
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load profile viewers");
        const data = await response.json() as ProfileViewer[];
        if (active) setViewers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setViewers([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleFollow = async (viewer: ProfileViewer) => {
    setFollowingId(viewer.id);
    try {
      const response = await apiFetch(`/api/users/${encodeURIComponent(viewer.username)}/follow`, { method: "POST" });
      if (!response.ok) return;
      const data = await response.json() as { following?: boolean };
      setViewers(current => current.map(row => (
        row.id === viewer.id ? { ...row, isFollowing: data.following ?? !row.isFollowing } : row
      )));
    } finally {
      setFollowingId(null);
    }
  };

  return (
    <AppLayout>
      <main className="max-w-2xl mx-auto px-4 md:px-0 py-6">
        <BackButton />
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-serif">
              <Eye className="w-5 h-5 text-primary" />
              People who viewed your profile
            </CardTitle>
            <p className="text-sm text-muted-foreground">Your 20 most recent signed-in profile viewers.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(row => <div key={row} className="h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : viewers.length === 0 ? (
              <div className="flex flex-col items-center text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mb-3 opacity-40" />
                <p className="font-medium text-foreground">No profile viewers yet</p>
                <p className="text-sm mt-1">When signed-in members visit your profile, they will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {viewers.map(viewer => (
                  <div key={viewer.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Link href={`/profile/${viewer.username}`} className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring">
                      <Avatar className="w-11 h-11">
                        <AvatarImage src={viewer.avatarUrl || ""} />
                        <AvatarFallback>{viewer.displayName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${viewer.username}`} className="font-semibold text-sm hover:text-primary transition-colors truncate block">
                        {viewer.displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        viewed your profile <Timestamp value={viewer.viewedAt} />
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={viewer.isFollowing ? "outline" : "default"}
                      className="shrink-0 rounded-xl text-xs"
                      disabled={followingId === viewer.id}
                      onClick={() => void toggleFollow(viewer)}
                    >
                      {!viewer.isFollowing && <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
                      {viewer.isFollowing ? "Following" : "Follow back"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
