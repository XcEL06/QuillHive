import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { QuillHiveLogo } from "@/components/QuillHiveLogo";
import { Footer } from "@/components/Footer";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[4.5rem] flex items-center justify-between">
          <Link href="/" aria-label="QuillHive home">
            <QuillHiveLogo size={34} />
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/" className="text-sm font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                Go to QuillHive
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2">
                  Sign in
                </Link>
                <Link href="/login?mode=register" className="text-sm font-semibold px-4 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  Join free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
