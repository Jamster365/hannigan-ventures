import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./db-harness";

/**
 * Row Level Security and server-side family mechanics, run against a real
 * Postgres engine with the production migration applied unchanged.
 */
let h: Harness;
let household: string;
let other: string;
let jamie: string;
let brother: string;
let dad: string;
let outsider: string;
let company: string;

beforeAll(async () => {
  h = await createHarness();
  jamie = await h.createUser("jamie@example.test", "Jamie");
  brother = await h.createUser("brother@example.test", "Brother");
  dad = await h.createUser("dad@example.test", "Dad");
  outsider = await h.createUser("stranger@example.test", "Stranger");
  household = (await h.admin.query<{ id: string }>("insert into households (name) values ('Test family') returning id"))[0].id;
  other = (await h.admin.query<{ id: string }>("insert into households (name) values ('Other household') returning id"))[0].id;
  for (const [u, role] of [[jamie, "owner"], [brother, "member"], [dad, "member"]] as const) {
    await h.admin.query("insert into household_members (household_id, user_id, role) values ($1, $2, $3)", [household, u, role]);
  }
  await h.admin.query("insert into household_members (household_id, user_id, role) values ($1, $2, 'owner')", [other, outsider]);
  company = (
    await h.admin.query<{ id: string }>("insert into companies (household_id, name, slug) values ($1, 'Larkspur Photonics', 'larkspur-photonics') returning id", [household])
  )[0].id;
  await h.admin.query("insert into companies (household_id, name, slug) values ($1, 'Private Co', 'private-co')", [other]);
  await h.admin.query("insert into research_prompts (household_id, version, prompt_text, active, created_by) values ($1, 1, 'Find early-stage investment opportunities across all sectors.', true, $2)", [household, jamie]);
});

afterAll(async () => {
  await h.close();
});

describe("profiles are created for new auth users", () => {
  it("creates a profile row with the display name from metadata", async () => {
    const rows = await h.admin.query<{ display_name: string; avatar_initial: string }>("select display_name, avatar_initial from profiles where user_id = $1", [jamie]);
    expect(rows[0]).toEqual({ display_name: "Jamie", avatar_initial: "J" });
  });
});

describe("row level security", () => {
  it("members can read their household's companies", async () => {
    const rows = await h.as(jamie, (q) => q.query("select name from companies order by name"));
    expect(rows.map((r) => r.name)).toEqual(["Larkspur Photonics"]);
  });

  it("outside users cannot read household content", async () => {
    const rows = await h.as(outsider, (q) => q.query("select name from companies where household_id = $1", [household]));
    expect(rows).toEqual([]);
    const prompts = await h.as(outsider, (q) => q.query("select id from research_prompts where household_id = $1", [household]));
    expect(prompts).toEqual([]);
  });

  it("anonymous users see nothing", async () => {
    const rows = await h.as(null, (q) => q.query("select id from companies"));
    expect(rows).toEqual([]);
  });

  it("members cannot insert companies directly (research content is service-role only)", async () => {
    await expect(h.as(jamie, (q) => q.query("insert into companies (household_id, name, slug) values ($1, 'Sneaky', 'sneaky')", [household]))).rejects.toThrow(/row-level security/);
  });

  it("a member can only write their own vote", async () => {
    await h.as(jamie, (q) => q.query("insert into member_votes (company_id, user_id, vote, score) values ($1, $2, 'interested', 8)", [company, jamie]));
    await expect(h.as(brother, (q) => q.query("insert into member_votes (company_id, user_id, vote) values ($1, $2, 'pass')", [company, jamie]))).rejects.toThrow(/row-level security/);
    // Updating someone else's vote silently matches zero rows under RLS.
    await h.as(brother, (q) => q.query("update member_votes set vote = 'pass' where company_id = $1 and user_id = $2", [company, jamie]));
    const rows = await h.admin.query<{ vote: string }>("select vote from member_votes where company_id = $1 and user_id = $2", [company, jamie]);
    expect(rows[0].vote).toBe("interested");
  });

  it("outsiders cannot vote on another household's company", async () => {
    await expect(h.as(outsider, (q) => q.query("insert into member_votes (company_id, user_id, vote) values ($1, $2, 'interested')", [company, outsider]))).rejects.toThrow(/row-level security/);
  });

  it("members can only edit their own comments and all members can read them", async () => {
    const id = (await h.as(dad, (q) => q.query<{ id: string }>("insert into comments (company_id, author_user_id, body) values ($1, $2, 'Can you find more on the regulatory pathway?') returning id", [company, dad])))[0].id;
    const seen = await h.as(brother, (q) => q.query("select body from comments where id = $1", [id]));
    expect(seen).toHaveLength(1);
    await h.as(brother, (q) => q.query("update comments set body = 'hacked' where id = $1", [id]));
    const after = await h.admin.query<{ body: string }>("select body from comments where id = $1", [id]);
    expect(after[0].body).toMatch(/regulatory/);
    await expect(h.as(brother, (q) => q.query("insert into comments (company_id, author_user_id, body) values ($1, $2, 'impersonation')", [company, dad]))).rejects.toThrow(/row-level security/);
  });

  it("notifications are visible only to their recipient", async () => {
    const forBrother = await h.as(brother, (q) => q.query("select title from notifications"));
    expect(forBrother.length).toBeGreaterThan(0);
    const leaked = await h.as(brother, (q) => q.query("select id from notifications where recipient_user_id = $1", [dad]));
    expect(leaked).toEqual([]);
  });

  it("only the owner can see or create invitations", async () => {
    await h.as(jamie, (q) => q.query("insert into invitations (household_id, invited_email, token_hash, invited_by, expires_at) values ($1, 'new@example.test', 'hash1', $2, now() + interval '7 days')", [household, jamie]));
    await expect(h.as(brother, (q) => q.query("insert into invitations (household_id, invited_email, token_hash, invited_by, expires_at) values ($1, 'x@example.test', 'hash2', $2, now() + interval '7 days')", [household, brother]))).rejects.toThrow(/row-level security/);
    const seen = await h.as(brother, (q) => q.query("select id from invitations"));
    expect(seen).toEqual([]);
  });
});

describe("family stage is computed server-side (2 of 3 rule)", () => {
  const stage = async () => (await h.admin.query<{ family_stage: string }>("select family_stage from companies where id = $1", [company]))[0].family_stage;

  it("1 Interested = pending", async () => {
    expect(await stage()).toBe("pending");
  });

  it("2 Interested = shortlisted, with one family update and one notification per other member", async () => {
    await h.as(brother, (q) => q.query("insert into member_votes (company_id, user_id, vote, score) values ($1, $2, 'interested', 7)", [company, brother]));
    expect(await stage()).toBe("shortlisted");
    const updates = await h.admin.query("select headline from company_updates where company_id = $1 and update_type = 'family'", [company]);
    expect(updates.map((u) => u.headline)).toEqual(["Promoted to shortlist"]);
    const notes = await h.admin.query<{ recipient_user_id: string }>("select recipient_user_id from notifications where notification_type = 'shortlist_promoted' and company_id = $1", [company]);
    expect(notes.map((n) => n.recipient_user_id).sort()).toEqual([dad, jamie].sort());
  });

  it("withdrawing to Unsure immediately demotes and keeps history", async () => {
    await h.as(brother, (q) => q.query("update member_votes set vote = 'unsure' where company_id = $1 and user_id = $2", [company, brother]));
    expect(await stage()).toBe("pending");
    const updates = await h.admin.query("select headline from company_updates where company_id = $1 and update_type = 'family' order by effective_at", [company]);
    expect(updates.map((u) => u.headline)).toEqual(["Promoted to shortlist", "Left the shortlist"]);
    const audit = await h.admin.query("select action from audit_events where object_id = $1 and action like 'vote.%'", [company]);
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });

  it("2 Pass = passed; a single Pass never deletes anything", async () => {
    await h.as(dad, (q) => q.query("insert into member_votes (company_id, user_id, vote) values ($1, $2, 'pass')", [company, dad]));
    expect(await stage()).toBe("pending");
    await h.as(brother, (q) => q.query("update member_votes set vote = 'pass' where company_id = $1 and user_id = $2", [company, brother]));
    expect(await stage()).toBe("passed");
    const still = await h.admin.query("select id from companies where id = $1", [company]);
    expect(still).toHaveLength(1);
  });

  it("deleting all votes returns to unreviewed", async () => {
    for (const u of [jamie, brother, dad]) await h.as(u, (q) => q.query("delete from member_votes where company_id = $1 and user_id = $2", [company, u]));
    expect(await stage()).toBe("unreviewed");
  });
});

describe("research prompt activation", () => {
  it("creates a new active version and refuses stale bases (optimistic concurrency)", async () => {
    const active = (await h.admin.query<{ id: string }>("select id from research_prompts where household_id = $1 and active", [household]))[0].id;
    const v2 = (
      await h.as(brother, (q) =>
        q.query<{ activate_prompt_version: string }>("select activate_prompt_version($1, $2, $3, $4, $5, $6)", [household, "Find early-stage investment opportunities across all sectors. Prefer pre-seed.", {}, "Prefer pre-seed", active, brother]),
      )
    )[0].activate_prompt_version;
    const rows = await h.admin.query<{ id: string; version: number; active: boolean }>("select id, version, active from research_prompts where household_id = $1 order by version", [household]);
    expect(rows.map((r) => [r.version, r.active])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(rows[1].id).toBe(v2);
    await expect(h.as(dad, (q) => q.query("select activate_prompt_version($1, $2, $3, $4, $5, $6)", [household, "Something else entirely for the research.", {}, "", active, dad]))).rejects.toThrow(/prompt_conflict/);
    await expect(h.as(outsider, (q) => q.query("select activate_prompt_version($1, $2, $3, $4, $5, $6)", [household, "Outsider text that should never be accepted.", {}, "", v2, outsider]))).rejects.toThrow(/not a household member/);
  });
});

describe("invitation redemption", () => {
  it("adds the invited user to the household and rejects mismatched emails", async () => {
    const newcomer = await h.createUser("new@example.test", "Newcomer");
    const wrong = await h.createUser("wrong@example.test", "Wrong");
    await expect(h.as(wrong, (q) => q.query("select redeem_invitation('hash1')"))).rejects.toThrow(/different email/);
    const hid = (await h.as(newcomer, (q) => q.query<{ redeem_invitation: string }>("select redeem_invitation('hash1')")))[0].redeem_invitation;
    expect(hid).toBe(household);
    const member = await h.admin.query("select role from household_members where household_id = $1 and user_id = $2", [household, newcomer]);
    expect(member[0].role).toBe("member");
    await expect(h.as(newcomer, (q) => q.query("select redeem_invitation('hash1')"))).rejects.toThrow(/expired|invalid/);
  });
});

describe("deleting a company", () => {
  it("removes its votes, comments and stories with it (the vote trigger stands aside)", async () => {
    const doomed = (await h.admin.query<{ id: string }>("insert into companies (household_id, name, slug, is_demo) values ($1, 'Sample Co', 'sample-co', true) returning id", [household]))[0].id;
    await h.as(jamie, (q) => q.query("insert into member_votes (company_id, user_id, vote, score) values ($1, $2, 'interested', 8)", [doomed, jamie]));
    await h.as(brother, (q) => q.query("insert into member_votes (company_id, user_id, vote) values ($1, $2, 'interested')", [doomed, brother]));
    await h.as(dad, (q) => q.query("insert into comments (company_id, author_user_id, body) values ($1, $2, 'Test')", [doomed, dad]));
    await h.admin.query("delete from companies where id = $1", [doomed]);
    const left = await h.admin.query<{ n: number }>("select (select count(*) from member_votes where company_id = $1) + (select count(*) from comments where company_id = $1) + (select count(*) from notifications where company_id = $1) as n", [doomed]);
    expect(Number(left[0].n)).toBe(0);
  });
});
