import { apiUrl, getStoredToken } from '@/lib/api';

export function uploadWithProgress(
  file: File,
  category: 'general' | 'post' | 'support' | 'profile' | 'moderation' | 'gallery' | 'library' | 'group',
  onProgress: (pct: number) => void,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getStoredToken();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('category', category);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Record<string, unknown>);
        } catch {
          reject(new Error('Invalid upload response'));
        }
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.open('POST', apiUrl('/api/upload'));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}
