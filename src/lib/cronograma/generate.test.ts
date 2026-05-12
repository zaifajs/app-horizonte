import { describe, it, expect } from "vitest";
import { generateSessions } from "./generate";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

describe("generateSessions", () => {
  it("produces 36 sessions: 30 classroom + 6 autonomous", () => {
    const r = generateSessions({
      startDate: "2026-04-08",
      startTime: "14:00",
      durationHours: 4,
      isHoliday: () => false, // ignore holidays for this test
    });
    expect(r).toHaveLength(36);
    expect(r.filter((s) => s.kind === "CLASSROOM")).toHaveLength(30);
    expect(r.filter((s) => s.kind === "AUTONOMOUS")).toHaveLength(6);
  });

  it("never schedules a classroom day on Sat/Sun", () => {
    const r = generateSessions({
      startDate: "2026-04-08",
      startTime: "14:00",
      durationHours: 4,
      isHoliday: () => false,
    });
    for (const s of r.filter((x) => x.kind === "CLASSROOM")) {
      const day = s.scheduledDate.getUTCDay();
      expect(day, `${fmt(s.scheduledDate)} fell on a weekend`).not.toBe(0);
      expect(day, `${fmt(s.scheduledDate)} fell on a weekend`).not.toBe(6);
    }
  });

  it("matches the reference M9 cronograma layout (2026-04-08 → 2026-05-19)", () => {
    // From the existing PLA cronograma PDF the user shared.
    // 6 modules × 5 classroom days, Wed→Thu→Fri→Mon→Tue rolling.
    const r = generateSessions({
      startDate: "2026-04-08",
      startTime: "14:00",
      durationHours: 4,
      isHoliday: () => false, // the reference image had no holiday skips
    });
    const classroom = r.filter((s) => s.kind === "CLASSROOM").map((s) => fmt(s.scheduledDate));
    expect(classroom).toEqual([
      // Module 1
      "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-13", "2026-04-14",
      // Module 2
      "2026-04-15", "2026-04-16", "2026-04-17", "2026-04-20", "2026-04-21",
      // Module 3
      "2026-04-22", "2026-04-23", "2026-04-24", "2026-04-27", "2026-04-28",
      // Module 4
      "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-04", "2026-05-05",
      // Module 5
      "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-11", "2026-05-12",
      // Module 6
      "2026-05-13", "2026-05-14", "2026-05-15", "2026-05-18", "2026-05-19",
    ]);
  });

  it("skips holidays from the injected calendar", () => {
    // Start on a Monday; treat Tuesday as a holiday.
    const tuesday = "2026-04-14";
    const r = generateSessions({
      startDate: "2026-04-13", // Mon
      startTime: "09:00",
      durationHours: 4,
      classroomDaysPerModule: 3,
      moduleCount: 1,
      isHoliday: (d) => fmt(d) === tuesday,
    });
    const dates = r.filter((s) => s.kind === "CLASSROOM").map((s) => fmt(s.scheduledDate));
    expect(dates).toEqual(["2026-04-13", "2026-04-15", "2026-04-16"]);
    expect(dates).not.toContain(tuesday);
  });

  it("emits classroom rows with correct start/end times derived from durationHours", () => {
    const r = generateSessions({
      startDate: "2026-04-08",
      startTime: "14:00",
      durationHours: 4,
      moduleCount: 1,
      isHoliday: () => false,
    });
    const classroom = r.filter((s) => s.kind === "CLASSROOM");
    expect(classroom[0].startTime).toBe("14:00");
    expect(classroom[0].endTime).toBe("18:00");
    expect(classroom[0].hours).toBe(4);
  });

  it("autonomous block has null times, equals last-classroom-day date, default 5h", () => {
    const r = generateSessions({
      startDate: "2026-04-08",
      startTime: "14:00",
      durationHours: 4,
      moduleCount: 1,
      isHoliday: () => false,
    });
    const auto = r.find((s) => s.kind === "AUTONOMOUS");
    const classroom = r.filter((s) => s.kind === "CLASSROOM");
    expect(auto).toBeDefined();
    expect(auto!.startTime).toBeNull();
    expect(auto!.endTime).toBeNull();
    expect(auto!.hours).toBe(5);
    expect(fmt(auto!.scheduledDate)).toBe(fmt(classroom[classroom.length - 1].scheduledDate));
  });

  it("output is deterministic for identical input", () => {
    const make = () =>
      generateSessions({
        startDate: "2026-06-03",
        startTime: "09:00",
        durationHours: 4,
        isHoliday: () => false,
      });
    const a = make();
    const b = make();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rejects invalid startTime", () => {
    expect(() =>
      generateSessions({
        startDate: "2026-04-08",
        startTime: "2pm",
        durationHours: 4,
        isHoliday: () => false,
      }),
    ).toThrow(/HH:MM/);
  });

  it("uses the real PT holiday calendar by default to roll past Christmas", () => {
    // A batch starting 2026-12-21 (Mon) would otherwise put session 4 on 25 Dec.
    const r = generateSessions({
      startDate: "2026-12-21",
      startTime: "09:00",
      durationHours: 4,
      moduleCount: 1,
      classroomDaysPerModule: 5,
    });
    const dates = r.filter((s) => s.kind === "CLASSROOM").map((s) => fmt(s.scheduledDate));
    expect(dates).not.toContain("2026-12-25"); // Christmas
    expect(dates).not.toContain("2026-12-26"); // not a PT holiday but Saturday
    expect(dates).not.toContain("2026-12-08"); // Immaculate Conception is earlier
  });
});
