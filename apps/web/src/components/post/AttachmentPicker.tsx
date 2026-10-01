import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, Music, Video, File } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, type UploadCategory } from '@/lib/uploadFile';
import { mediaUrl } from '@/lib/api';

export interface Attachment {
  url: string;
  mimeType: string;
  filename?: string;
  sizeBytes?: number;
}

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const ACCEPTED_DOCUMENTS = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/xml', 'text/xml',
  'application/rtf', 'text/rtf', 'application/epub+zip', 'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
];

function isAcceptedMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/') || ACCEPTED_DOCUMENTS.includes(mimeType);
}

export function attachmentIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('audio/')) return Music;
  if (mime.startsWith('video/')) return Video;
  if (mime === 'application/pdf' || mime.includes('word') || mime === 'text/plain') return FileText;
  return File;
}

interface AttachmentPickerProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  max?: number;
  label?: string;
  compact?: boolean;
  category?: UploadCategory;
}

export function AttachmentPicker({ attachments, onChange, max = MAX_ATTACHMENTS, label = 'Attach files', compact = false, category = 'post' }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(() => new Set());
  const { toast } = useToast();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > max) {
      toast({ title: 'Too many files', description: `You can attach up to ${max} files.`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    const next: Attachment[] = [...attachments];
    try {
      for (const file of Array.from(files)) {
        if (!isAcceptedMimeType(file.type)) {
          toast({ title: 'Unsupported file', description: `${file.name} (${file.type || 'unknown type'}) is not allowed.`, variant: 'destructive' });
          continue;
        }
        if (file.size > MAX_SIZE) {
          toast({ title: 'File too large', description: `${file.name} exceeds 50MB.`, variant: 'destructive' });
          continue;
        }
        const data = await uploadFile(file, category);
        next.push({
          url: data.url,
          mimeType: file.type,
          filename: file.name,
          sizeBytes: file.size,
        });
      }
      onChange(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/pdf,text/plain,text/csv,text/markdown,application/json,application/xml,application/rtf,application/epub+zip,application/zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.csv,.md,.json,.epub,.zip"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size={compact ? 'sm' : 'default'}
        onClick={() => inputRef.current?.click()}
        disabled={uploading || attachments.length >= max}
        className="rounded-full gap-1.5 text-muted-foreground hover:text-primary"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        <span className={compact ? 'text-xs' : 'text-sm'}>{label}</span>
      </Button>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => {
            const Icon = attachmentIcon(a.mimeType);
            const isImage = a.mimeType.startsWith('image/');
            return (
              <div
                key={`${a.url}-${i}`}
                className="relative group bg-muted rounded-lg border border-border overflow-hidden flex items-center gap-2 pr-2"
              >
                {isImage && !failedPreviews.has(a.url) ? (
                  <img
                    src={mediaUrl(a.url)}
                    alt={a.filename || ''}
                    className="w-12 h-12 object-cover"
                    onError={() => setFailedPreviews(current => new Set(current).add(a.url))}
                  />
                ) : (
                  <div className={`h-12 ${isImage ? 'w-24' : 'w-12'} flex flex-col items-center justify-center gap-0.5 bg-primary/10 text-primary`}>
                    <Icon className="w-5 h-5" />
                    {isImage && <span className="text-[9px] text-destructive">Preview unavailable</span>}
                  </div>
                )}
                <span className="text-xs text-foreground truncate max-w-[140px]">{a.filename || 'file'}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="ml-1 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  aria-label="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
