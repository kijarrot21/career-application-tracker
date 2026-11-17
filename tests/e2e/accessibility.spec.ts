import { expect, test } from "@playwright/test";

// DEF-11-007 regression: accessibility & keyboard operability checks.
// Uses only built-in Playwright APIs, no additional dependencies.

test.describe("Accessibility & Keyboard Navigation", () => {
  test("sign-in page: document language, heading, labelled inputs, focus order, visible focus", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    // Document language is declared
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang && lang.length > 0).toBeTruthy();

    // A main heading exists for screen readers
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // Every visible input is labelled (label[for], aria-label, aria-labelledby)
    const unlabeledCount = await page
      .locator("input:not([type='hidden'])")
      .evaluateAll((elements) =>
        elements.filter((el) => {
          const id = el.id;
          const label = id
            ? document.querySelector(`label[for="${CSS.escape(id)}"]`)
            : null;
          return (
            !label &&
            !el.getAttribute("aria-label") &&
            !el.getAttribute("aria-labelledby")
          );
        }).length,
      );
    expect(unlabeledCount).toBe(0);

    // Keyboard focus order: email -> password -> submit
    await page.locator("#email").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("button[type='submit']")).toBeFocused();

    // Focused element (submit button, where focus now rests) has a visible
    // focus indicator
    const focusStyles = await page
      .locator("button[type='submit']")
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });
    const hasVisibleFocus =
      (focusStyles.outlineStyle !== "none" &&
        focusStyles.outlineWidth !== "0px") ||
      focusStyles.boxShadow !== "none";
    expect(hasVisibleFocus).toBeTruthy();
  });

  test("sign-in form is keyboard operable (Enter submits)", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("#email").fill(`a11y.${Date.now()}@example.com`);
    await page.locator("#password").fill("SecurePass1234!");
    await page.locator("#password").press("Enter");
    // Invalid (unregistered) credentials must produce a visible error message,
    // proving the form submitted via keyboard and surfaced feedback.
    await expect(page.locator("body")).toContainText(/invalid|incorrect|error/i);
  });

  test("authenticated shell: landmarks and accessible button names", async ({
    page,
  }) => {
    const uniqueEmail = `a11y.shell.${Date.now()}@example.com`;
    await page.goto("/sign-up");
    await page.fill("#name", "A11y Candidate");
    await page.fill("#email", uniqueEmail);
    await page.fill("#password", "SecurePass1234!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/dashboard/);

    // Primary landmarks exist (sidebar ships three labelled navigation
    // regions, Pipeline, Career assets, Settings, so require at least one)
    await expect(page.locator("main")).toHaveCount(1);
    const navCount = await page.getByRole("navigation").count();
    expect(navCount).toBeGreaterThanOrEqual(1);

    // All rendered buttons have accessible names (text, aria-label, or title)
    const unnamedButtons = await page
      .locator("button:visible")
      .evaluateAll((buttons) =>
        buttons.filter(
          (b) =>
            !(b.textContent ?? "").trim() &&
            !b.getAttribute("aria-label") &&
            !b.getAttribute("title") &&
            !b.querySelector("img[alt], svg[aria-label]"),
        ).length,
      );
    expect(unnamedButtons).toBe(0);

    // Sidebar navigation is keyboard operable: focus a nav link, press Enter
    // (href-based locator keeps the test locale-independent, the sidebar
    // renders in Indonesian by default, e.g. "Cari Lowongan")
    const jobsLink = page.locator("nav a[href='/jobs']").first();
    await jobsLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/jobs/);
  });
});
