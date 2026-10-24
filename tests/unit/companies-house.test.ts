import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allotments, normaliseName, parseFilingHistory, parseSearch, pickCompany } from "@/lib/research/companies-house";

const history = readFileSync("tests/fixtures/companies-house-filing-history.html", "utf8");

describe("Companies House filings", () => {
  it("reads the filing history and finds share allotments", () => {
    const filings = parseFilingHistory(history);
    expect(filings.length).toBeGreaterThan(5);
    expect(filings[0]).toMatchObject({ date: "2026-09-30", type: "AA" });
    const sh01 = allotments(filings);
    expect(sh01.length).toBeGreaterThanOrEqual(2);
    expect(sh01[0]).toMatchObject({ date: "2026-07-01", type: "SH01", allottedOn: "2026-06-04", capital: "GBP 26.85" });
  });

  it("matches a search result only on the company's own name", () => {
    const results = parseSearch('<a class="govuk-link" href="/company/11800189">HACIEN LTD</a><a href="/company/00000001">HACIEN BARBERSHOP LTD</a><a href="/company/00000002">HACIENDA LIMITED</a>');
    expect(results).toHaveLength(3);
    expect(pickCompany(results, ["HACIEN"])).toEqual({ number: "11800189", name: "HACIEN LTD" });
    expect(pickCompany(results, ["Hacienda Capital"])).toBeNull();
    expect(normaliseName("Crust Bros (UK) Ltd.")).toBe("crust bros");
    const json = parseSearch(JSON.stringify({ items: [{ title: "HACIEN LTD", company_number: "11800189", company_status: "active" }, { title: "HACIEN OLD LTD", company_number: "00000009", company_status: "dissolved" }] }));
    expect(json).toEqual([{ number: "11800189", name: "HACIEN LTD" }]);
  });
});
