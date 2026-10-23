import { expect, test, type Page } from "@playwright/test";

/**
 * Demo-mode smoke tests. They run against the labelled sample data and
 * exercise the real server actions (votes, comments, prompt edits).
 */

async function viewAs(page: Page, name: string) {
  // The deck's one-time tip has its own test; keep it out of the way elsewhere.
  await page.addInitScript(() => localStorage.setItem("hv-deck-tip-seen", "1"));
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

test("classic home still renders the editorial feed at /home", async ({ page }) => {
  await page.goto("/home");
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

test("classic app: the second Interested vote promotes and withdrawal demotes immediately", async ({ page }) => {
  // Quillon Verify starts with one Interested vote (Jamie). Brother's vote makes two.
  await viewAs(page, "Brother");
  await go(page, "/companies/quillon-verify?tab=family");
  await clearVote(page);
  await page.getByRole("radio", { name: "Interested" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Promoted to the family shortlist/ })).toBeVisible();
  await page.goto("/matches");
  await expect(page.getByRole("link", { name: /Quillon Verify/ })).toBeVisible();

  await go(page, "/companies/quillon-verify?tab=family");
  await page.getByRole("radio", { name: "Unsure" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Removed from the shortlist/ })).toBeVisible();
  await page.goto("/matches");
  await expect(page.getByRole("link", { name: /Quillon Verify/ })).toHaveCount(0);

  await go(page, "/companies/quillon-verify?tab=family");
  await clearVote(page);
});

test("classic app hides other members' votes until a match", async ({ page }) => {
  // Quillon has Jamie's Interested vote but is not a match: Dad must not see it.
  await viewAs(page, "Dad");
  await go(page, "/companies/quillon-verify?tab=family");
  await expect(page.getByText("Each member’s vote stays private until two of you are interested.")).toBeVisible();
  await expect(page.getByText("Private", { exact: true }).first()).toBeVisible();
});

const topCard = (page: Page) => page.getByRole("article").first().getByRole("heading", { level: 2 });

/** Opens the deck with the named company on top (the deck's `?c=` link). */
async function deckWith(page: Page, slug: string, name: string) {
  await go(page, `/?c=${slug}`);
  await expect(topCard(page)).toHaveText(name);
}

test("first visit shows a one-time tip", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "How it works" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog", { name: "How it works" })).toHaveCount(0);
});

test("swipe: skip, almost a match, undo, two ticks make a match, and Decisions changes your mind", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hv-deck-tip-seen", "1"));
  // Quillon Verify: Jamie is interested. Dad says no, so Brother's vote decides it.
  await viewAs(page, "Dad");
  await deckWith(page, "quillon-verify", "Quillon Verify");
  await page.getByRole("button", { name: "Not interested", exact: true }).click();
  await page.waitForTimeout(600);

  await viewAs(page, "Brother");
  await deckWith(page, "quillon-verify", "Quillon Verify");
  await page.getByRole("button", { name: "Not interested", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Almost a match" })).toContainText("One of the others is interested in");
  await page.getByRole("button", { name: "Undo my answer" }).click();
  await expect(topCard(page)).toHaveText("Quillon Verify");

  await page.getByRole("button", { name: "Interested", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "It’s a match!" })).toContainText("You and Jamie are interested in");
  await page.getByRole("button", { name: "Keep going" }).click();
  await page.getByRole("button", { name: "Undo last swipe" }).click();
  await page.waitForTimeout(600);
  await page.goto("/matches");
  await expect(page.getByRole("link", { name: /Quillon Verify/ })).toHaveCount(0);

  // Dad changes his mind from Decisions: the company goes back in his deck.
  await viewAs(page, "Dad");
  await go(page, "/decisions");
  const row = page.getByRole("listitem").filter({ hasText: "Quillon Verify" });
  await row.getByRole("button", { name: "Back to my deck" }).click();
  // No longer decided, so it leaves the list and returns to Dad's deck.
  await expect(page.getByRole("listitem").filter({ hasText: "Quillon Verify" })).toHaveCount(0);
});

test("swipe: a match has one shared chat", async ({ page }) => {
  await viewAs(page, "Dad");
  await go(page, "/matches/larkspur-photonics");
  const text = `E2E chat ${Date.now()}`;
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(text)).toBeVisible();
  await viewAs(page, "Jamie");
  await go(page, "/matches");
  await expect(page.getByRole("link", { name: /Larkspur Photonics/ })).toContainText(text.slice(0, 12));
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
  await expect(page.getByText("Dad · Northgate Surgical").first()).toBeVisible();
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

test("match chat: Research posts company updates alongside the family", async ({ page }) => {
  await viewAs(page, "Jamie");
  await go(page, "/matches");
  await expect(page.getByRole("link", { name: /Tidewell Diagnostics/ })).toBeVisible();
  await go(page, "/matches/tidewell-diagnostics");
  const chat = page.getByLabel("Chat about Tidewell Diagnostics");
  await expect(chat.getByText("Research · AI").first()).toBeVisible();
  await expect(chat.getByText(/Tidewell reports £1.4m first close/)).toBeVisible();
  await expect(chat.getByRole("img", { name: "Research (AI)" }).first()).toBeVisible();
});

test("Me shows phone notifications as live-app only in the demo", async ({ page }) => {
  await go(page, "/me");
  await expect(page.getByText("Phone notifications")).toBeVisible();
  await expect(page.getByText("Available in the live app (not the demo).")).toBeVisible();
});

test("owner's upload screen checks a Claude batch and splits it into runs", async ({ page }) => {
  await viewAs(page, "Jamie");
  await go(page, "/me");
  await page.getByRole("link", { name: /Upload research/ }).click();
  await expect(page.getByRole("button", { name: "Copy the Claude prompt" })).toBeVisible();
  const company = (name: string) => ({ candidate: { name, website: null, legalName: null, sector: "Fintech", subSector: null, city: "London", country: "United Kingdom", stage: "Seed", teaser: `${name} test company.`, description: "Test.", discoverySignal: "Test", researchRuleMatched: "Test", access: { status: "unknown", sourceUrls: [] }, eis: { status: "unknown", note: null, sourceUrls: [] }, round: null } });
  const payload = { writeUp: "Test batch.", companies: Array.from({ length: 14 }, (_, i) => company(`Batch Co ${i + 1}`)).concat([{ candidate: { name: "Broken" } } as never]) };
  await page.getByLabel("Claude’s reply (the JSON)").fill("```json\n" + JSON.stringify(payload) + "\n```");
  await page.getByRole("button", { name: "Upload" }).click();
  const status = page.getByRole("status").filter({ hasText: "Checked" });
  await expect(status).toContainText("14 companies would be queued in 2 run(s)");
  await expect(status).toContainText("Broken");
});

test("members other than the owner cannot open the upload screen", async ({ page }) => {
  await viewAs(page, "Dad");
  await go(page, "/me");
  await expect(page.getByRole("link", { name: /Upload research/ })).toHaveCount(0);
  await page.goto("/research/upload");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy the Claude prompt" })).toHaveCount(0);
});

test("three tabs: Your picks lives under Profile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hv-deck-tip-seen", "1"));
  await go(page, "/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveCount(3);
  await nav.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("link", { name: /Your picks/ }).click();
  await expect(page.getByRole("heading", { name: "Your picks" })).toBeVisible();
});

test("an optional reason can be added after a yes or no, and edited in Your picks", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("hv-deck-tip-seen", "1"));
  await viewAs(page, "Brother");
  await deckWith(page, "northgate-surgical", "Northgate Surgical");
  await page.getByRole("button", { name: "Not interested", exact: true }).click();
  await page.getByRole("button", { name: /Say why you said no to Northgate Surgical/ }).click();
  const sheet = page.getByRole("dialog", { name: "Why no to Northgate Surgical?" });
  await sheet.getByRole("button", { name: "Valuation too high" }).click();
  await sheet.getByRole("button", { name: "Save reason" }).click();
  await expect(sheet).toHaveCount(0);
  await go(page, "/decisions");
  const row = page.getByRole("listitem").filter({ hasText: "Northgate Surgical" });
  await expect(row.getByText("Valuation too high")).toBeVisible();
  await row.getByRole("button", { name: "Back to my deck" }).click();
  await expect(row).toHaveCount(0);
});

test("Your taste shows what the app learned and saves preferences", async ({ page }) => {
  await viewAs(page, "Brother");
  await go(page, "/me");
  await page.getByRole("link", { name: /Your taste/ }).click();
  await expect(page.getByRole("heading", { name: "Your taste" })).toBeVisible();
  await expect(page.getByText("What the app has learned about you")).toBeVisible();
  await page.getByRole("button", { name: "Essential", exact: true }).click();
  await page.getByRole("button", { name: "Pre-seed", exact: true }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Saved. Your deck now uses these.")).toBeVisible();
  await expect(page.getByText("What the family’s answers say")).toBeVisible();
});

test("the deal room: checklist, decision and documents for a match", async ({ page }) => {
  await viewAs(page, "Brother");
  await go(page, "/matches");
  const match = page.getByRole("link", { name: /Larkspur Photonics/ }).first();
  await match.click();
  await page.getByRole("link", { name: /Deal room/ }).click();
  await expect(page.getByRole("heading", { name: "Due diligence" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Speak to the founders" }).click();
  await expect(page.getByText("1 of 16 done")).toBeVisible();
  await page.getByRole("button", { name: "Invested", exact: true }).click();
  await page.getByLabel("Brother").fill("25,000");
  await page.getByRole("button", { name: "SEIS", exact: true }).click();
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.setInputFiles('input[type="file"]', { name: "term-sheet.txt", mimeType: "text/plain", buffer: Buffer.from("Sample term sheet") });
  await expect(page.getByRole("link", { name: "term-sheet.txt" })).toBeVisible();
  await go(page, "/matches/larkspur-photonics");
  await expect(page.getByText(/Invested £25,000 · due diligence 1 of 16 · 1 document/)).toBeVisible();
  await expect(page.getByText("added a document: term-sheet.txt").first()).toBeVisible();
  await go(page, "/portfolio");
  await expect(page.getByText("£25,000", { exact: false }).first()).toBeVisible();
  // Put the demo back.
  await go(page, "/matches/larkspur-photonics/deal");
  await page.getByRole("checkbox", { name: "Speak to the founders" }).click();
  await page.getByRole("button", { name: "Considering", exact: true }).click();
  await page.getByRole("button", { name: "Save decision" }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove term-sheet.txt" }).click();
  await expect(page.getByRole("link", { name: "term-sheet.txt" })).toHaveCount(0);
});
