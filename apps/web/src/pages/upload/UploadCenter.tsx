import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileCheck2 } from "lucide-react";
import toast from "react-hot-toast";
import { useT } from "@/lib/i18n";
import { uploadFile as uploadFileToServer } from "@/lib/uploadFile";

export default function UploadCenter() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<{ url: string; moderationStatus?: string } | null>(null);
  const t = useT();

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('upload.fileExceedsLimit'));
      return;
    }
    setProgress(20);
    try {
      const data = await uploadFileToServer(file);
      setProgress(100);
      setUploaded({ url: data.url, moderationStatus: typeof data.moderationStatus === "string" ? data.moderationStatus : undefined });
      toast.success(t('upload.uploadComplete'));
    } catch (error) {
      setProgress(0);
      toast.error(error instanceof Error ? error.message : t('upload.uploadFailed'));
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold">{t('upload.title')}</h1>
          <p className="text-muted-foreground">{t('upload.subtitle')}</p>
        </div>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t('upload.cardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center hover:bg-muted/40">
              <Upload className="w-10 h-10 text-muted-foreground mb-3" />
              <span className="font-medium">{file ? file.name : t('upload.dropHere')}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type || "unknown type"}` : t('upload.fileTypes')}
              </span>
              <input type="file" className="sr-only" onChange={e => { setFile(e.target.files?.[0] ?? null); setProgress(0); setUploaded(null); e.currentTarget.value = ''; }} />
            </label>
            <Progress value={progress} />
            <Button className="rounded-xl" onClick={handleUpload} disabled={!file || progress === 100}>
              {t('upload.uploadBtn')}
            </Button>
            {uploaded && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-sm">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-medium">{t('upload.storedWith', `Stored with status: ${uploaded.moderationStatus ?? 'pending'}`)}</p>
                  <a className="text-primary underline" href={uploaded.url} target="_blank" rel="noreferrer">{t('upload.openFile')}</a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
