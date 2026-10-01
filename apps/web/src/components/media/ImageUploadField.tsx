import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { mediaUrl } from '@/lib/api';
import { uploadFile, type UploadCategory } from '@/lib/uploadFile';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  category: UploadCategory;
  label: string;
  previewClassName?: string;
}

export function ImageUploadField({ value, onChange, category, label, previewClassName = 'h-32' }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const { toast } = useToast();

  useEffect(() => setPreviewError(false), [value]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, category);
      onChange(uploaded.url);
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-xl gap-2">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {label}
      </Button>
      {value ? (
        previewError ? (
          <div className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-center ${previewClassName}`} role="alert">
            <ImageIcon className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive">Upload completed, but the image preview could not be loaded.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>Choose another image</Button>
          </div>
        ) : (
          <div className={`relative rounded-xl overflow-hidden bg-muted ${previewClassName}`}>
            <img src={mediaUrl(value)} alt="Preview" className="w-full h-full object-cover" onError={() => setPreviewError(true)} />
          </div>
        )
      ) : (
        <div className={`rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground ${previewClassName}`}>
          <ImageIcon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}