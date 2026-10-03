import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageContainer } from "@/components/layout/PageContainer";

describe("PageContainer responsive guard", () => {
  it("keeps page content constrained to the viewport width", () => {
    const html = renderToStaticMarkup(
      <PageContainer className="test-class">
        <div>content</div>
      </PageContainer>
    );

    expect(html).toContain("w-full");
    expect(html).toContain("max-w-full");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("test-class");
  });
});
