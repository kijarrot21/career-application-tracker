import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  process.env.PLAYWRIGHT_ARTIFACT_DIR || resolve("test-results", "screenshots");
mkdirSync(ARTIFACT_DIR, { recursive: true });

test.describe("Career Application Tracker End-to-End Journey", () => {
  test("signs up, saves a vacancy, records submission, moves stages, classifies emails, manages interviews & documents, and checks responsive layouts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const uniqueEmail = `e2e.${Date.now()}@example.com`;

    // 1. Sign up
    await page.goto("/sign-up");
    await page.fill("#name", "Alex Candidate");
    await page.fill("#email", uniqueEmail);
    await page.fill("#password", "SecurePass1234!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: "Welcome back, Alex Candidate" }),
    ).toBeVisible();

    // Load sample data first to verify sample banner & dashboard charts
    await page.click('button:has-text("Load Sample Data")');
    await expect(page.getByText(/Sample data is loaded/i)).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "01-dashboard-desktop.png"),
      fullPage: true,
    });

    // 2. Add a real Job Vacancy with a LinkedIn URL
    await page.goto("/jobs/new");
    await page.fill(
      'input[placeholder="https://www.linkedin.com/jobs/view/..."]',
      "https://www.linkedin.com/jobs/view/5544332211",
    );
    await expect(page.getByText(/Detected platform: LinkedIn/i)).toBeVisible();

    await page.fill("#vacancy-company", "PT GoTo E2E");
    await page.fill("#vacancy-title", "Staff Full-Stack Engineer");
    await page.click('button:has-text("Save Job Vacancy")');

    // Should redirect to Job Detail page
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { name: "Staff Full-Stack Engineer" }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "02-job-detail-suitability.png"),
      fullPage: true,
    });

    // 3. Record Application Submission
    await page.click('button:has-text("Record Submission")');
    await page.click('button:has-text("Record Application")');

    await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { name: "Staff Full-Stack Engineer" }),
    ).toBeVisible();

    // 4. Phase 3: Open Email Center, analyze an incoming assessment email, and confirm stage update
    await page.goto("/emails");
    await expect(
      page.getByRole("heading", {
        name: "Recruitment Email Center & Correspondence Classifier",
      }),
    ).toBeVisible();

    await page.click('button:has-text("Analyze / Log Email")');
    await page.fill(
      "#analyzer-subject",
      "Technical Assessment Invitation for Staff Full-Stack Engineer at PT GoTo E2E",
    );
    await page.fill(
      "#analyzer-snippet",
      "Hi Alex, please complete the online coding challenge on HackerRank within 72 hours.",
    );
    await page.click('button:has-text("Classify & Save Email")');

    const classifiedCard = page.getByTestId("email-card-assessment_invitation");
    await expect(classifiedCard).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "08-email-center.png"),
      fullPage: true,
    });

    await classifiedCard
      .getByRole("button", { name: "Confirm Stage Update" })
      .click();

    // 5. Phase 4: Open Interviews Module & Calendar
    await page.goto("/interviews");
    await expect(
      page.getByRole("heading", {
        name: "Interview & Technical Assessment Management",
      }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "09-interviews-calendar.png"),
      fullPage: true,
    });

    // 6. Phase 4: Open Career Document Repository & upload a Customized CV
    await page.goto("/documents");
    await expect(
      page.getByRole("heading", {
        name: "Career Document Repository & Version Control",
      }),
    ).toBeVisible();

    await page.click('button:has-text("Upload Document")');
    await page.fill("#doc-title", "Customized CV - PT GoTo E2E");
    await page.fill("#doc-version-label", "v1.0 (GoTo Staff Eng)");
    await page.click('button:has-text("Save Document Version")');

    await expect(page.getByText("Customized CV - PT GoTo E2E")).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "10-documents-repository.png"),
      fullPage: true,
    });

    // 7. Open Kanban Board, move stage to Final Interview
    await page.goto("/applications?view=board");
    const card = page.getByTestId("app-card-APP-0005");
    await expect(card).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "03-applications-kanban.png"),
      fullPage: false,
    });

    const moveSelect = page.getByLabel("Move stage for APP-0005");
    await moveSelect.selectOption({ label: "Final Interview" });

    // Switch to Table View and verify the application row
    await page.click('button:has-text("Data Table")');
    await expect(page.getByRole("cell", { name: "PT GoTo E2E" })).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "04-applications-table.png"),
      fullPage: false,
    });

    // 8. Verify Timeline & Status History
    await page.click("a:has-text('APP-0005')");
    await page.click('button:has-text("Timeline & Status History")');
    await expect(page.getByText(/Confirmed from email/i)).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "05-application-timeline.png"),
      fullPage: true,
    });

    // 9. Phase 5: Open Analytics & Reporting module and verify charts + breakdowns
    await page.goto("/analytics?sampleMode=include");
    await expect(
      page.getByRole("heading", {
        name: "Result & Career Performance Analytics",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Response Rate by Company" }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "11-analytics-dashboard.png"),
      fullPage: true,
    });

    // 10. Verify responsive viewports (375px mobile, 768px tablet, 1440px desktop)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(page.getByText("Total Applications")).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "06-dashboard-mobile-375.png"),
      fullPage: false,
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/shortlist");
    await expect(
      page.getByRole("heading", {
        name: "Job Shortlist & Suitability Comparison",
      }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, "07-shortlist-tablet-768.png"),
      fullPage: false,
    });
  });
});
