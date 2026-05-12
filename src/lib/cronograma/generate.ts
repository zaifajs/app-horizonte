// Generates the 36 sessions of a PLA batch from its start date & schedule.
//
// Layout: 6 modules × (5 classroom days + 1 autonomous block) = 36 rows.
// Walking rules:
//   - classroom days only land on Mon–Fri
//   - skip Portuguese national holidays (date-holidays "PT")
//   - the autonomous block for a module is dated the same as that module's
//     last classroom day (it's "homework over the following week"; admins
//     mostly care that it follows the classroom days, not its exact date)
//
// Pure: returns specs the caller persists. No DB access here so it is
// trivially testable.

import Holidays from "date-holidays";

export type SessionKind = "CLASSROOM" | "AUTONOMOUS";

export type SessionSpec = {
  moduleNumber: number; // 1..6
  sequenceInModule: number; // CLASSROOM: 1..5, AUTONOMOUS: 1
  kind: SessionKind;
  scheduledDate: Date; // midnight UTC of the date
  startTime: string | null; // "HH:MM" for CLASSROOM, null for AUTONOMOUS
  endTime: string | null;
  hours: number;
};

export type GenerateInput = {
  /** ISO date string "YYYY-MM-DD" or Date object (interpreted as UTC date) */
  startDate: string | Date;
  /** "HH:MM" 24-hour, e.g. "14:00" */
  startTime: string;
  /** Classroom hours per day. PLA defaults to 4. */
  durationHours: number;
  /** Module count. PLA = 6. */
  moduleCount?: number;
  /** Classroom days per module. PLA = 5. */
  classroomDaysPerModule?: number;
  /** Autonomous-work hours per module. PLA = 5. */
  autonomousHoursPerModule?: number;
  /**
   * Optional: override the holiday calendar for testing. Anything truthy
   * means "skip this date as a holiday".
   */
  isHoliday?: (date: Date) => boolean;
};

const PT_HOLIDAYS = new Holidays("PT");

function defaultIsHoliday(date: Date): boolean {
  return Boolean(PT_HOLIDAYS.isHoliday(date));
}

function toUtcDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
    );
  }
  // "YYYY-MM-DD" — parse as UTC midnight.
  const [y, m, d] = input.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addUtcDays(date: Date, n: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n),
  );
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h + hours;
  const hh = String(total).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function generateSessions(input: GenerateInput): SessionSpec[] {
  const {
    startTime,
    durationHours,
    moduleCount = 6,
    classroomDaysPerModule = 5,
    autonomousHoursPerModule = 5,
    isHoliday = defaultIsHoliday,
  } = input;

  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    throw new Error(`startTime must be "HH:MM", got "${startTime}"`);
  }
  if (durationHours <= 0) {
    throw new Error(`durationHours must be > 0, got ${durationHours}`);
  }

  const endTime = addHoursToTime(startTime, durationHours);
  const start = toUtcDate(input.startDate);

  const sessions: SessionSpec[] = [];
  let cursor = start;

  for (let moduleNumber = 1; moduleNumber <= moduleCount; moduleNumber++) {
    let lastClassroomDate: Date | null = null;

    for (let seq = 1; seq <= classroomDaysPerModule; seq++) {
      // Advance to the next eligible weekday.
      while (isWeekend(cursor) || isHoliday(cursor)) {
        cursor = addUtcDays(cursor, 1);
      }
      sessions.push({
        moduleNumber,
        sequenceInModule: seq,
        kind: "CLASSROOM",
        scheduledDate: cursor,
        startTime,
        endTime,
        hours: durationHours,
      });
      lastClassroomDate = cursor;
      cursor = addUtcDays(cursor, 1);
    }

    // Autonomous block follows the classroom days; date == last classroom day.
    if (!lastClassroomDate) {
      // shouldn't happen unless classroomDaysPerModule was 0
      throw new Error("module has no classroom days");
    }
    sessions.push({
      moduleNumber,
      sequenceInModule: 1,
      kind: "AUTONOMOUS",
      scheduledDate: lastClassroomDate,
      startTime: null,
      endTime: null,
      hours: autonomousHoursPerModule,
    });
  }

  return sessions;
}
