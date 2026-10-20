import { Metadata } from 'next';

interface Props { params: { id: string } }

async function getPost(id: string) {
  const apiUrl = process.env.API_URL || 'http://localhost:9000';
  const res = await fetch(`${apiUrl}/api/posts/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.id);
  if (!post) return { title: 'Post - QuillHive' };
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  return {
    title: `${post.title || 'Untitled'} - QuillHive`,
    description: (post.excerpt || (post.content || '').replace(/<[^>]+>/g, '').slice(0, 160)),
    openGraph: {
      title: post.title || 'QuillHive Post',
      description: post.excerpt || '',
      images: post.imageUrl ? [post.imageUrl] : [`${appUrl}/opengraph.jpg`],
      url: `${appUrl}/p/${params.id}`,
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.id);
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  if (!post) return <p>Post not found.</p>;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem', fontFamily: 'Georgia, serif' }}>
      <h1>{post.title}</h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>by {post.author?.displayName}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content || '' }} />
      <a href={`${appUrl}/post/${params.id}`} style={{ display: 'inline-block', marginTop: '2rem', color: '#8b5cf6' }}>
        Read full post on QuillHive →
      </a>
    </main>
  );
}
