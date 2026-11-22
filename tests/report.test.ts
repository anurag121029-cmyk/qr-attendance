import { describe, it, expect } from "vitest";
import { csvCell, sanitizeForPdf, toCsv, wrapText } from "../lib/report";

describe("sanitizeForPdf / wrapText", () => {
  it("replaces unencodable glyphs instead of throwing", () => {
    expect(sanitizeForPdf("Anurag ✓")).toBe("Anurag ?");
    expect(sanitizeForPdf("plain text")).toBe("plain text");
  });
  it("wraps lines to the max width", () => {
    const lines = wrapText("one two three four", (t) => t.length * 5, 30);
    expect(lines).toEqual(["one", "two", "three", "four"]);
    expect(wrapText("", (t) => t.length, 10)).toEqual([""]);
  });
});

describe("csvCell / toCsv", () => {
  it("quotes cells with commas or quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(75)).toBe("75");
  });
  it("builds a header + rows CSV", () => {
    const csv = toCsv(["Name", "Roll"], [["Anurag", "25/CSE/63"], ["Chetna", "25/CSE/10"]]);
    expect(csv).toBe("Name,Roll\r\nAnurag,25/CSE/63\r\nChetna,25/CSE/10\r\n");
  });
});
