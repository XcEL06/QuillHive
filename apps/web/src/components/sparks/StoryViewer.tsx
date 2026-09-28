import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiUrl, getStoredToken, mediaUrl } from "@/lib/api";
import { formatPostTimestamp } from "@/lib/postTimestamp";

interface StorySpark {
  id: number;
  content: string;
  mediaUrl?: string | null;
  createdAt?: string | Date | null;
}

interface StoryGroup {
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  sparks: StorySpark[];
}

export function StoryViewer({
  group,
  onClose,
}: {
  group: StoryGroup;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const current = group.sparks[index];
  const currentTimestamp = current?.createdAt ? formatPostTimestamp(current.createdAt) : null;

  useEffect(() => {
    if (!current) {
      onClose();
      return;
    }

    setProgress(0);
    const token = getStoredToken();
    fetch(apiUrl(`/api/sparks/${current.id}/view`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});

    const duration = 5000;
    const stepMs = 50;
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += stepMs;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (index < group.sparks.length - 1) {
          setIndex((currentIndex) => currentIndex + 1);
        } else {
          onClose();
        }
      }
    }, stepMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, group.sparks.length, index, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) setIndex((currentIndex) => currentIndex - 1);
      if (event.key === "ArrowRight") {
        if (index < group.sparks.length - 1) setIndex((currentIndex) => currentIndex + 1);
        else onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [group.sparks.length, index, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Stories from ${group.authorDisplayName}`}
    >
      <div className="absolute left-3 right-3 top-3 z-10 flex gap-1">
        {group.sparks.map((spark, sparkIndex) => (
          <div key={spark.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: sparkIndex < index ? "100%" : sparkIndex === index ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-8 z-10 text-white"
        aria-label="Close story viewer"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="absolute left-4 top-8 z-10 flex items-center gap-2 text-white">
        <img
          src={group.authorAvatarUrl || "/images/default-avatar.png"}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/images/logo-icon.png";
          }}
        />
        <div>
          <span className="block text-sm font-medium">{group.authorDisplayName}</span>
          {currentTimestamp && (
            <time className="block text-xs text-white/70" dateTime={currentTimestamp.dateTime} title={currentTimestamp.title}>
              {currentTimestamp.label}
            </time>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => index > 0 && setIndex((currentIndex) => currentIndex - 1)}
        className="absolute bottom-0 left-0 top-0 flex w-1/3 items-center justify-start pl-2"
        aria-label="Previous story"
      >
        {index > 0 && <ChevronLeft className="h-6 w-6 text-white/50" />}
      </button>
      <button
        type="button"
        onClick={() => (index < group.sparks.length - 1 ? setIndex((currentIndex) => currentIndex + 1) : onClose())}
        className="absolute bottom-0 right-0 top-0 flex w-1/3 items-center justify-end pr-2"
        aria-label="Next story"
      >
        <ChevronRight className="h-6 w-6 text-white/50" />
      </button>

      <div className="w-full max-w-md px-8 text-center">
        {current.mediaUrl ? (
          <img
            src={mediaUrl(current.mediaUrl)}
            alt={current.content || "Spark media"}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        ) : (
          <p className="text-xl font-medium leading-relaxed text-white">{current.content}</p>
        )}
      </div>
    </div>
  );
}
