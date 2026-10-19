import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShieldCheck, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { BackButton } from "@/components/ui/BackButton";
import { QuillHiveLogo } from "@/components/QuillHiveLogo";

export function About() {
  const { user } = useAuthStore();
  return (
    <PublicLayout>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-20">
        <BackButton />
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-14 text-center sm:px-12">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <QuillHiveLogo size={40} showWordmark={false} />
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">About QuillHive</p>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground sm:text-5xl">
              Your quill is your voice. Your hive is where it grows.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Grow, get discovered, and find real opportunities - for everyone.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-2xl font-serif font-bold text-foreground">A place for what you have to say</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            QuillHive is a community for sharing ideas, stories, questions, projects, and perspectives.
            Whether you are here to be seen, find your people, learn something new, or simply enjoy a
            thoughtful conversation, there is room for your voice here.
          </p>
        </section>

        <section className="mt-12 grid gap-5 md:grid-cols-3">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-6">
              <Users className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">Find your hive</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Meet people who are curious about the same questions, subjects, and possibilities.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-6">
              <Heart className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">Share generously</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Make space for long-form thinking, quick sparks, honest feedback, and real connection.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70">
            <CardContent className="p-6">
              <ShieldCheck className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">Stay safe together</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Built-in controls and community standards help QuillHive stay welcoming for everyone.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-16 rounded-2xl border border-border/60 bg-card p-8 text-center sm:p-10">
          <h2 className="text-2xl font-serif font-bold text-foreground">Ready to find your place?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start with a thought, follow a few voices, and let your hive grow from there.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={user ? "/" : "/signup"}>
              <Button className="w-full rounded-xl sm:w-auto">{user ? "Go to QuillHive" : "Join QuillHive"}</Button>
            </Link>
            <Link href="/explore">
              <Button variant="outline" className="w-full rounded-xl sm:w-auto">Explore</Button>
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
