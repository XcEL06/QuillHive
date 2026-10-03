import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-full overflow-hidden px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
