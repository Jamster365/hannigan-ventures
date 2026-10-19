import { expect, test, type Page } from "@playwright/test";

/**
 * Demo-mode smoke tests. They run against the labelled sample data and
 * exercise the real server actions (votes, comments, prompt edits).
 */

async function viewAs(page: Page, name: string) {
  await page.goto("/");
  const select = page.getByLabel("Switch sample member");
  if ((await select.inputValue()) !== (await select.locator(`option:has-text("${name}")`).getAttribute("value"))) {
    await select.selectOption({ label: name });
    await page.waitForLoadState("networkidle");
  }
}

/** Navigate and wait for hydration so client handlers are attached before interacting. */
async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Demo state is shared across runs: clear whichever vote is currently selected. */
async function clearVote(page: Page) {
  const checked = page.getByRole("radio", { checked: true });
  if ((await checked.count()) > 0) {
    await checked.first().click();
    await page.waitForTimeout(500);
  }
}

test("home renders the editorial feed with bottom navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
  await expect(page.getByRole("heading", { name: "New discoveries" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Our shortlist" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).or(page.getByRole("navigation", { name: "Sidebar" })).first()).toBeVisible();
});

test("company page exposes all seven tabs and keeps unknowns visible", async ({ page }) => {
  await page.goto("/companies/larkspur-photonics");
  for (const tab of ["Overview", "Analysis", "Funding", "Team", "Updates", "Family", "Sources"]) {
    await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toBeVisible();
  }
  await page.goto("/companies/larkspur-photonics?tab=funding");
  await expect(page.getByText("Undisclosed").first()).toBeVisible();
  await expect(page.getByText("Access unknown").first()).toBeVisible();
  await expect(page.getByText("CAN INVEST NOW")).toHaveCount(0);
});

test("second Interested vote promotes a company to the shortlist and demotion is immediate", async ({ page }) => {
  // Quillon Verify starts with one Interested vote (Jamie). Brother's vote makes two.
  await viewAs(page, "Brother");
  await go(page, "/companies/quillon-verify?tab=family");
  await clearVote(page);
  await page.getByRole("radio", { name: "Interested" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Promoted to the family shortlist/ })).toBeVisible();
  await page.goto("/shortlist");
  await expect(page.getByRole("heading", { name: "Quillon Verify" })).toBeVisible();

  // Withdrawing to Unsure removes it straight away.
  await go(page, "/companies/quillon-verify?tab=family");
  await page.getByRole("radio", { name: "Unsure" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Removed from the shortlist/ })).toBeVisible();
  await page.goto("/shortlist");
  await expect(page.getByRole("heading", { name: "Quillon Verify" })).toHaveCount(0);

  // Clean up: clear Brother's vote.
  await go(page, "/companies/quillon-verify?tab=family");
  await clearVote(page);
});

test("comments are shared and notify the other members", async ({ page }) => {
  await viewAs(page, "Dad");
  await go(page, "/companies/northgate-surgical?tab=family");
  const text = `E2E comment ${Date.now()}`;
  await page.getByLabel("Add a comment").fill(text);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText(text)).toBeVisible();
  await viewAs(page, "Jamie");
  await page.goto("/updates?tab=family");
  await expect(page.getByText("Dad commented").first()).toBeVisible();
});

test("research instructions can be edited with a diff preview and versioned", async ({ page }) => {
  await viewAs(page, "Jamie");
  await go(page, "/research/settings");
  await page.getByRole("button", { name: "Edit" }).click();
  const area = page.getByLabel("Research instructions");
  await area.fill((await area.inputValue()) + "\n\nE2E: prefer companies with a signed pilot.");
  await page.getByRole("button", { name: "Preview diff" }).click();
  await expect(page.getByText("+ E2E: prefer companies with a signed pilot.")).toBeVisible();
  await page.getByRole("button", { name: "Save & activate" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Saved and activated as v/ })).toBeVisible();
  await page.goto("/research/settings?tab=history");
  await expect(page.getByText("Active").first()).toBeVisible();
});

test("discover filters and empty state work", async ({ page }) => {
  await page.goto("/discover?q=zzzz-no-match");
  await expect(page.getByText("No companies match")).toBeVisible();
  await page.goto("/discover?filter=shortlist");
  await expect(page.getByText(/compan(y|ies) of \d+ tracked/)).toBeVisible();
});

test("'Improve our research' proposes a change that must be approved before it applies", async ({ page }) => {
  await viewAs(page, "Dad");
  await go(page, "/companies/halyard-pay");
  await page.getByRole("button", { name: "More actions" }).first().click();
  await page.getByRole("menuitem", { name: "Improve our research" }).click();
  await page.getByLabel("Not interested in this model").check();
  await page.getByRole("button", { name: "Propose a change" }).click();
  await expect(page.getByText(/proposed change to the research instructions is waiting for review/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await go(page, "/research/settings");
  const versionBefore = await page.getByText(/Current instructions \(v\d+\)/).textContent();
  const card = page.locator("li", { hasText: "Records a model-level preference" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("proposed", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Show proposed change" }).click();
  await expect(card.getByText(/Deprioritise business models like Halyard Pay/)).toBeVisible();
  // Instructions are unchanged until a member applies it.
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(card.getByText("dismissed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Current instructions \(v\d+\)/)).toHaveText(versionBefore ?? "");
});

test("'Why am I seeing this?' shows the discovery signal, rule and sources", async ({ page }) => {
  await go(page, "/companies/northgate-surgical");
  await page.getByRole("button", { name: "More actions" }).first().click();
  await page.getByRole("menuitem", { name: "Why am I seeing this?" }).click();
  await expect(page.getByText("Research rule matched")).toBeVisible();
  await expect(page.getByText(/Priority 3/)).toBeVisible();
});
