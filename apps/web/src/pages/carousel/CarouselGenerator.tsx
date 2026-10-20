import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, getStoredToken } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, RefreshCw, Download, ChevronLeft, ChevronRight,
  Image as ImageIcon, Layers, Layout, Palette, Globe,
  Search, Zap, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";

type SlideImage = {
  url: string;
  thumb: string;
  alt: string;
  credit: string;
  creditUrl: string;
  source: "unsplash" | "pexels";
};

type Slide = {
  index: number;
  image: SlideImage;
  layout: string;
  textPlacement: string;
};

type CarouselResult = {
  topic: string;
  style: string;
  orientation: string;
  slideCount: number;
  slides: Slide[];
  generatedAt: string;
  seed: string;
};

type TopicCategories = Record<string, string[]>;

const STYLES = [
  { value: "editorial", label: "Editorial", desc: "Clean, magazine-style" },
  { value: "vibrant", label: "Vibrant", desc: "Bold, energetic colors" },
  { value: "minimal", label: "Minimal", desc: "Quiet, spacious layouts" },
  { value: "dark", label: "Dark", desc: "Moody, dramatic feel" },
  { value: "nature", label: "Nature", desc: "Organic, earthy textures" },
  { value: "urban", label: "Urban", desc: "City life, architecture" },
];

const ORIENTATIONS = [
  { value: "landscape", label: "Landscape (16:9)" },
  { value: "portrait", label: "Portrait (9:16)" },
  { value: "squarish", label: "Square (1:1)" },
];

const SOURCES = [
  { value: "both", label: "Unsplash + Pexels" },
  { value: "unsplash", label: "Unsplash only" },
  { value: "pexels", label: "Pexels only" },
];

export default function CarouselGenerator() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [style, setStyle] = useState("editorial");
  const [orientation, setOrientation] = useState("landscape");
  const [sources, setSources] = useState("both");
  const [generating, setGenerating] = useState(false);
  const [carousel, setCarousel] = useState<CarouselResult | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [topics, setTopics] = useState<TopicCategories | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const loadTopics = useCallback(async () => {
    if (topics) return;
    setLoadingTopics(true);
    try {
      const r = await fetch(apiUrl("/api/carousel/topics"));
      if (r.ok) setTopics(await r.json().then((d: any) => d.categories));
    } finally {
      setLoadingTopics(false);
    }
  }, [topics]);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      toast({ title: "Enter a topic first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const token = getStoredToken();
      const r = await fetch(apiUrl("/api/carousel/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ topic: topic.trim(), slideCount, style, orientation, sources }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as any;
        throw new Error(err?.error || "Generation failed");
      }
      const data: CarouselResult = await r.json();
      setCarousel(data);
      setCurrentSlide(0);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [topic, slideCount, style, orientation, sources, toast]);

  const prev = () => setCurrentSlide((c) => Math.max(0, c - 1));
  const next = () => setCurrentSlide((c) => Math.min((carousel?.slides.length ?? 1) - 1, c + 1));

  const aspectClass = {
    landscape: "aspect-video",
    portrait: "aspect-[9/16] max-h-[70vh]",
    squarish: "aspect-square",
  }[orientation] ?? "aspect-video";

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <BackButton fallback="/admin" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Layers className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Carousel Generator</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate unique, high-quality image carousels for social media - powered by millions of photos.
              Every generation picks fresh images that have never been shown to you before.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Controls Panel */}
          <div className="space-y-5">
            {/* Topic Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Topic</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                  placeholder="e.g. content creator, morning routine…"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Curated Topic Pills */}
            <div className="space-y-2">
              <button
                onClick={loadTopics}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                {loadingTopics ? "Loading…" : topics ? "Browse topics ▾" : "Browse curated topics →"}
              </button>
              {topics && (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(topics).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-xs text-muted-foreground font-medium mb-1.5">{cat}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((t) => (
                          <button
                            key={t}
                            onClick={() => setTopic(t)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-all",
                              topic === t
                                ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                                : "border-border hover:border-violet-500/40 hover:text-violet-300",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Style */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                Visual Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={cn(
                      "text-left p-2.5 rounded-xl border transition-all",
                      style === s.value
                        ? "bg-violet-500/15 border-violet-500/50"
                        : "border-border hover:border-violet-500/30",
                    )}
                  >
                    <p className="text-xs font-semibold">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Layout className="w-4 h-4 text-muted-foreground" />
                Orientation
              </label>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIENTATIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                Image Source
              </label>
              <Select value={sources} onValueChange={setSources}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Slide Count */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                Slides: <span className="text-violet-400 font-bold">{slideCount}</span>
              </label>
              <input
                type="range"
                min={2}
                max={20}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2</span><span>10</span><span>20</span>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={generate}
              disabled={generating || !topic.trim()}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold h-11 shadow-lg shadow-violet-500/25"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {carousel ? "Regenerate" : "Generate Carousel"}
                </>
              )}
            </Button>

            {carousel && (
              <p className="text-xs text-center text-muted-foreground">
                Each generation pulls fresh images - you'll never see the same carousel twice.
              </p>
            )}
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            {!carousel && !generating && (
              <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                <Layers className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Your carousel will appear here</p>
                <p className="text-xs mt-1">Enter a topic and click Generate</p>
              </div>
            )}

            {generating && (
              <div className="flex flex-col items-center justify-center h-80 border border-border rounded-2xl bg-muted/20">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 animate-pulse" />
                  <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-white" />
                </div>
                <p className="mt-4 text-sm font-medium animate-pulse">Fetching unique images…</p>
                <p className="text-xs text-muted-foreground mt-1">Finding photos you haven't seen yet</p>
              </div>
            )}

            {carousel && !generating && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={carousel.seed}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Main slide preview */}
                  <div className="relative group rounded-2xl overflow-hidden border border-border shadow-2xl">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={cn("relative", aspectClass, "max-h-[520px]")}
                      >
                        {carousel.slides[currentSlide] && (
                          <>
                            <img
                              src={carousel.slides[currentSlide]!.image.url}
                              alt={carousel.slides[currentSlide]!.image.alt}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                            {/* Slide info overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="flex items-center justify-between">
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-black/50 text-white border-white/20 backdrop-blur-sm"
                                >
                                  {carousel.slides[currentSlide]!.layout}
                                </Badge>
                                <a
                                  href={carousel.slides[currentSlide]!.image.creditUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/70 hover:text-white transition-colors"
                                >
                                  Photo: {carousel.slides[currentSlide]!.image.credit} ·{" "}
                                  <span className="capitalize">
                                    {carousel.slides[currentSlide]!.image.source}
                                  </span>
                                </a>
                              </div>
                            </div>

                            {/* Slide number */}
                            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-white font-medium">
                              {currentSlide + 1} / {carousel.slides.length}
                            </div>
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Nav arrows */}
                    {currentSlide > 0 && (
                      <button
                        onClick={prev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-100 transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    {currentSlide < carousel.slides.length - 1 && (
                      <button
                        onClick={next}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white opacity-100 transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Thumbnails strip */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {carousel.slides.map((slide, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={cn(
                          "flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all",
                          i === currentSlide
                            ? "border-violet-500 shadow-lg shadow-violet-500/30 scale-105"
                            : "border-transparent opacity-60 hover:opacity-100",
                        )}
                      >
                        <img
                          src={slide.image.thumb}
                          alt={slide.image.alt}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>

                  {/* Metadata */}
                  <Card className="border-border bg-muted/20">
                    <CardContent className="pt-4 pb-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">
                            {carousel.topic}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {carousel.style}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {carousel.orientation}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Unique images
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={generate}
                            disabled={generating}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            New Set
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Image grid for quick scan */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {carousel.slides.map((slide, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={cn(
                          "aspect-square rounded-lg overflow-hidden border transition-all",
                          i === currentSlide
                            ? "border-violet-500 ring-2 ring-violet-500/30"
                            : "border-transparent opacity-70 hover:opacity-100",
                        )}
                      >
                        <img
                          src={slide.image.thumb}
                          alt={slide.image.alt}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
