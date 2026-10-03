import { apiFetch, mediaUrl } from '@/lib/api';

export type UploadCategory = 'general' | 'post' | 'support' | 'profile' | 'moderation' | 'gallery' | 'library' | 'group';

export interface UploadedFile extends Record<string, unknown> {
  id: number;
  url: string;
}

function nestedUploadValue(data: Record<string, unknown>, keys: string[]): unknown {
  const containers = [data, data.data, data.file, data.result].filter(
    (value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
  );
  for (const container of containers) {
    for (const key of keys) {
      const value = container[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

export async function uploadFile(file: File, category: UploadCategory = 'general'): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_SIZE) throw new Error('File exceeds the 50 MB limit.');
  if (!file.type) throw new Error('Could not determine the file type. Please choose another file.');

  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('category', category);

  const response = await apiFetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => null) as (Record<string, unknown> & { id?: number; url?: string; secure_url?: string; error?: string }) | null;
  const detail = data && nestedUploadValue(data, ['error', 'message']);
  if (!response.ok) throw new Error(typeof detail === 'string' ? detail : `Upload failed (${response.status}).`);

  const nestedId = data && [data, data.data, data.file, data.result]
    .find(value => value && typeof value === 'object' && 'id' in value) as { id?: unknown } | undefined;
  const id = Number(nestedId?.id ?? data?.id) || 0;
  const rawUrl = (data ? nestedUploadValue(data, ['url', 'secure_url', 'secureUrl', 'fileUrl']) : null)
    ?? (id ? `/api/file/${id}` : null);
  if (typeof rawUrl !== 'string' || !rawUrl) throw new Error('The upload completed without a file URL.');
  return { ...(data ?? {}), id, url: mediaUrl(rawUrl) };
}