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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const separator = result.indexOf(',');
      resolve(separator >= 0 ? result.slice(separator + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, category: UploadCategory = 'general'): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_SIZE) throw new Error('File exceeds the 50 MB limit.');
  if (!file.type) throw new Error('Could not determine the file type. Please choose another file.');

  const dataBase64 = await readFileAsBase64(file);
  const response = await apiFetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64, category }),
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