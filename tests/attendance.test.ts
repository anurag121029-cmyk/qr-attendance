import { describe, it, expect } from "vitest";
import {
  DEFAULTER_THRESHOLD,
  attendancePercentage,
  defaulterList,
  isSessionEnded,
  isSessionOpen,
  statusForScan,
} from "../lib/attendance";

const START = new Date("2026-11-20T10:00:00.000Z");

describe("statusForScan", () => {
  it("is present within the late-after window", () => {
    expect(statusForScan(START, new Date("2026-11-20T10:00:00.000Z"), 10)).toBe("present");
    expect(statusForScan(START, new Date("2026-11-20T10:10:00.000Z"), 10)).toBe("present");
  });
  it("is late after the window", () => {
    expect(statusForScan(START, new Date("2026-11-20T10:10:01.000Z"), 10)).toBe("late");
    expect(statusForScan(START, new Date("2026-11-20T10:45:00.000Z"), 10)).toBe("late");
  });
  it("respects a custom late-after value", () => {
    expect(statusForScan(START, new Date("2026-11-20T10:04:00.000Z"), 5)).toBe("present");
    expect(statusForScan(START, new Date("2026-11-20T10:06:00.000Z"), 5)).toBe("late");
  });
});

describe("isSessionOpen / isSessionEnded", () => {
  const session = { status: "open", starts_at: "2026-11-20T10:00:00.000Z", ends_at: "2026-11-20T11:00:00.000Z" };
  it("open only inside the window while status is open", () => {
    expect(isSessionOpen(session, new Date("2026-11-20T10:30:00.000Z"))).toBe(true);
    expect(isSessionOpen(session, new Date("2026-11-20T09:59:00.000Z"))).toBe(false);
    expect(isSessionOpen(session, new Date("2026-11-20T11:01:00.000Z"))).toBe(false);
    expect(isSessionOpen({ ...session, status: "closed" }, new Date("2026-11-20T10:30:00.000Z"))).toBe(false);
  });
  it("ended when closed or past ends_at", () => {
    expect(isSessionEnded(session, new Date("2026-11-20T10:30:00.000Z"))).toBe(false);
    expect(isSessionEnded(session, new Date("2026-11-20T11:01:00.000Z"))).toBe(true);
    expect(isSessionEnded({ status: "closed", ends_at: "2026-11-20T11:00:00.000Z" }, new Date("2026-11-20T10:30:00.000Z"))).toBe(true);
  });
});

describe("attendancePercentage", () => {
  it("returns null with no sessions held — never invents a number", () => {
    expect(attendancePercentage([], 0)).toBeNull();
    expect(attendancePercentage([{ student_id: "a", status: "present" }], 0)).toBeNull();
  });
  it("counts present and late as attended", () => {
    const rows = [
      { student_id: "a", status: "present" as const },
      { student_id: "a", status: "late" as const },
    ];
    expect(attendancePercentage(rows, 4)).toBe(50);
    expect(attendancePercentage(rows, 2)).toBe(100);
  });
  it("rounds to one decimal", () => {
    expect(attendancePercentage([{ student_id: "a", status: "present" }], 3)).toBe(33.3);
  });
});

describe("defaulterList", () => {
  it("flags below 75% and ignores no-data students", () => {
    expect(DEFAULTER_THRESHOLD).toBe(75);
    const summaries = [
      { student_id: "a", full_name: "A", roll_no: "1", percentage: 74.9, attended: 3, sessionsHeld: 4 },
      { student_id: "b", full_name: "B", roll_no: "2", percentage: 75, attended: 3, sessionsHeld: 4 },
      { student_id: "c", full_name: "C", roll_no: "3", percentage: null, attended: 0, sessionsHeld: 0 },
      { student_id: "d", full_name: "D", roll_no: "4", percentage: 50, attended: 1, sessionsHeld: 2 },
    ];
    expect(defaulterList(summaries).map((s) => s.student_id)).toEqual(["a", "d"]);
  });
});
