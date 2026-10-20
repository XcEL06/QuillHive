import { Metadata } from 'next';

interface Props { params: { username: string } }

async function getProfile(username: string) {
  const apiUrl = process.env.API_URL || 'http://localhost:9000';
  const res = await fetch(`${apiUrl}/api/users/${username}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.username);
  if (!profile) return { title: 'Profile - QuillHive' };
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  return {
    title: `${profile.displayName || params.username} - QuillHive`,
    description: profile.bio || `Discover ${profile.displayName}'s work on QuillHive - where everyone grows, gets discovered, and finds real opportunities.`,
    openGraph: {
      title: `${profile.displayName} on QuillHive`,
      description: profile.bio || '',
      images: profile.avatarUrl ? [profile.avatarUrl] : [`${appUrl}/opengraph.jpg`],
      url: `${appUrl}/u/${params.username}`,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ProfilePage({ params }: Props) {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <p>View {params.username}&apos;s full profile on QuillHive.</p>
      <a href={`${appUrl}/profile/${params.username}`} style={{ color: '#8b5cf6' }}>
        Go to profile →
      </a>
    </main>
  );
}
