import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentPath = resolve(
  process.cwd(),
  "src/components/dashboard/dashboard-guidance.tsx",
);
const dashboardPath = resolve(
  process.cwd(),
  "src/components/dashboard/dashboard-client.tsx",
);

describe("dashboard guidance integration points", () => {
  it("keeps recommendation calculation out of the UI", () => {
    const source = readFileSync(componentPath, "utf8");
    expect(source).not.toContain("computeNextBestActions");
    expect(source).not.toContain("detectProgress");
    expect(source).not.toContain("evaluateWorkflow");
    expect(source).not.toContain("getProgressFacts");
  });

  it("uses responsive grid classes and accessible controls", () => {
    const source = readFileSync(componentPath, "utf8");
    expect(source).toContain(
      "mt-2 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-6",
    );
    expect(source).toContain('aria-label="Dismiss getting started progress"');
    expect(source).toContain('aria-label="Getting started progress"');
    expect(source).toContain("role=\"progressbar\"");
    expect(source).toContain("Pending checklist");
    expect(source).toContain("Optional checklist");
  });

  it("wires guidance into the dashboard without removing existing widgets", () => {
    const source = readFileSync(dashboardPath, "utf8");
    expect(source).toContain("<DashboardGuidance insights={insights} />");
    expect(source).toContain("Application Pipeline");
    expect(source).toContain("Recruitment Conversion Funnel");
    expect(source).toContain("router.refresh()");
  });
});
