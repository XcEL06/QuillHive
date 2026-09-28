import { apiUrl, getStoredToken } from '@/lib/api';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export function uploadWithProgress(
  file: File,
  category: 'general' | 'post' | 'support' | 'profile' | 'moderation' | 'gallery' | 'library' | 'group',
  onProgress: (pct: number) => void,
): Promise<Record<string, unknown>> {
  return fileToBase64(file).then((dataBase64) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getStoredToken();
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
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64, category }));
  }));
}
