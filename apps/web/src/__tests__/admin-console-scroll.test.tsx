import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Gauge } from "lucide-react";
import AdminConsoleShell from "@/pages/admin/components/AdminConsoleShell";
import type { AdminNavItem } from "@/pages/admin/components/AdminConsoleShell";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

describe("AdminConsoleShell scrolling", () => {
  it("gives the fixed navigation a bounded vertical scroll region", () => {
    const groups: readonly { label: string; items: readonly AdminNavItem[] }[] = [
      { label: "Overview", items: [["dashboard", "Dashboard", Gauge]] },
    ];
    const html = renderToStaticMarkup(
      <AdminConsoleShell
        groups={groups}
        activeTab="dashboard"
        onSelectTab={() => {}}
        currentUser={{ role: "admin", displayName: "Admin" }}
        onLogout={() => {}}
      >
        <div>Admin content</div>
      </AdminConsoleShell>,
    );

    expect(html).toContain("h-full min-h-0 flex-col");
    expect(html).toContain("min-h-0 flex-1 overflow-y-auto");
  });
});
