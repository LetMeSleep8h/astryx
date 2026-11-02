// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file calendarSystem.ts
 * @input A calendar identifier and Gregorian PlainDates
 * @output Calendar months located by their Gregorian days, month and year
 *   steps, availability of each calendar, and calendar labels and digits
 * @position Shared date utility; read by the i18n calendar resolution and by
 *   Calendar. Values stay Gregorian PlainDates. Temporal owns the arithmetic of
 *   every calendar whose months are not Gregorian.
 */

import type {Locale} from '../i18n/types';
import type {PlainDate} from './dateTypes';
import {
  plainDateAddDays,
  plainDateAddMonths,
  plainDateFormatStandaloneMonthYear,
  plainDateIsAfter,
  plainDateIsBefore,
  getDaysInMonth,
} from './plainDate';

/**
 * A calendar system that date components can show: the calendars that
 * ECMA-402 and Temporal require. Values stay Gregorian ISO dates in every
 * calendar.
 */
export type CalendarSystem =
  | 'gregory'
  | 'iso8601'
  | 'buddhist'
  | 'roc'
  | 'japanese'
  | 'persian'
  | 'indian'
  | 'hebrew'
  | 'chinese'
  | 'dangi'
  | 'coptic'
  | 'ethiopic'
  | 'ethioaa'
  | 'islamic-civil'
  | 'islamic-tbla'
  | 'islamic-umalqura';

// A record, so the compiler checks that it lists every calendar exactly once.
const KNOWN_CALENDARS: Readonly<Record<CalendarSystem, true>> = {
  gregory: true,
  iso8601: true,
  buddhist: true,
  roc: true,
  japanese: true,
  persian: true,
  indian: true,
  hebrew: true,
  chinese: true,
  dangi: true,
  coptic: true,
  ethiopic: true,
  ethioaa: true,
  'islamic-civil': true,
  'islamic-tbla': true,
  'islamic-umalqura': true,
};

export const CALENDAR_SYSTEMS = Object.keys(
  KNOWN_CALENDARS,
) as ReadonlyArray<CalendarSystem>;

const GREGORIAN_ALIGNED: ReadonlySet<CalendarSystem> = new Set([
  'gregory',
  'iso8601',
  'buddhist',
  'roc',
  'japanese',
]);

/** Whether the calendar's months and days are the Gregorian ones. */
export function isGregorianAligned(calendar: CalendarSystem): boolean {
  return GREGORIAN_ALIGNED.has(calendar);
}

export function isCalendarSystem(value: string): value is CalendarSystem {
  return Object.hasOwn(KNOWN_CALENDARS, value);
}

// The subset of the Temporal API that this module reads. It is declared here
// so that the published types do not need the `esnext.temporal` library.
interface TemporalPlainDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly daysInMonth: number;
  with(fields: {day: number}): TemporalPlainDate;
  add(duration: {months?: number; years?: number}): TemporalPlainDate;
  withCalendar(calendar: 'iso8601'): TemporalPlainDate;
}

interface TemporalNamespace {
  PlainDate: new (
    isoYear: number,
    isoMonth: number,
    isoDay: number,
    calendar: string,
  ) => TemporalPlainDate;
}

function getTemporal(): TemporalNamespace | undefined {
  const temporal = (globalThis as {Temporal?: Partial<TemporalNamespace>})
    .Temporal;
  return typeof temporal?.PlainDate === 'function'
    ? (temporal as TemporalNamespace)
    : undefined;
}

// Keyed by the Temporal object, so a polyfill loaded later is probed again.
const supportedCalendars = new WeakMap<object, Map<CalendarSystem, boolean>>();

/**
 * Whether this runtime can show the calendar. Gregorian-aligned calendars
 * always can. The others need a `Temporal` that knows the calendar: a
 * polyfill build without non-ISO calendars throws for them.
 */
export function isCalendarSystemAvailable(calendar: CalendarSystem): boolean {
  if (isGregorianAligned(calendar)) {
    return true;
  }
  const temporal = getTemporal();
  if (temporal == null) {
    return false;
  }
  let known = supportedCalendars.get(temporal);
  if (known == null) {
    known = new Map();
    supportedCalendars.set(temporal, known);
  }
  let isSupported = known.get(calendar);
  if (isSupported == null) {
    try {
      new temporal.PlainDate(2000, 1, 1, calendar);
      isSupported = true;
    } catch {
      isSupported = false;
    }
    known.set(calendar, isSupported);
  }
  return isSupported;
}

function inCalendar(
  calendar: CalendarSystem,
  pd: PlainDate,
): TemporalPlainDate {
  const temporal = getTemporal();
  if (temporal == null) {
    throw new Error(`The "${calendar}" calendar needs Temporal.`);
  }
  return new temporal.PlainDate(pd.year, pd.month, pd.day, calendar);
}

function toGregorian(date: TemporalPlainDate): PlainDate {
  const iso = date.withCalendar('iso8601');
  return {year: iso.year, month: iso.month, day: iso.day};
}

/** A month of a calendar, located by its first and last Gregorian days. */
export interface CalendarMonth {
  readonly start: PlainDate;
  readonly end: PlainDate;
  readonly length: number;
}

function makeMonth(start: PlainDate, length: number): CalendarMonth {
  return {start, end: plainDateAddDays(start, length - 1), length};
}

function gregorianMonth(year: number, month: number): CalendarMonth {
  return makeMonth({year, month, day: 1}, getDaysInMonth(year, month));
}

function temporalMonth(firstDay: TemporalPlainDate): CalendarMonth {
  return makeMonth(toGregorian(firstDay), firstDay.daysInMonth);
}

/** The day of the calendar month that a Gregorian date falls on. */
export function calendarDayOfMonth(
  calendar: CalendarSystem,
  pd: PlainDate,
): number {
  return isGregorianAligned(calendar) ? pd.day : inCalendar(calendar, pd).day;
}

/** The calendar month that contains a Gregorian date. */
export function calendarMonthOf(
  calendar: CalendarSystem,
  pd: PlainDate,
): CalendarMonth {
  if (isGregorianAligned(calendar)) {
    return gregorianMonth(pd.year, pd.month);
  }
  return temporalMonth(inCalendar(calendar, pd).with({day: 1}));
}

/** The calendar month `n` months after `month`, or before it when negative. */
export function calendarAddMonths(
  calendar: CalendarSystem,
  month: CalendarMonth,
  n: number,
): CalendarMonth {
  if (n === 0) {
    return month;
  }
  if (isGregorianAligned(calendar)) {
    const {year, month: monthOfYear} = plainDateAddMonths(month.start, n);
    return gregorianMonth(year, monthOfYear);
  }
  return temporalMonth(inCalendar(calendar, month.start).add({months: n}));
}

/**
 * Moves a date by `n` calendar months. It keeps the day of the month and
 * clamps it to the length of the target month.
 */
export function calendarShiftMonths(
  calendar: CalendarSystem,
  pd: PlainDate,
  n: number,
): PlainDate {
  if (isGregorianAligned(calendar)) {
    return plainDateAddMonths(pd, n);
  }
  return toGregorian(inCalendar(calendar, pd).add({months: n}));
}

/**
 * Moves a date by `n` calendar years, to the same month of the target year.
 * It clamps the day of the month. A leap month that the target year does not
 * have becomes its common counterpart, because Temporal keeps the month code
 * and constrains it.
 */
export function calendarShiftYears(
  calendar: CalendarSystem,
  pd: PlainDate,
  n: number,
): PlainDate {
  if (isGregorianAligned(calendar)) {
    return plainDateAddMonths(pd, n * 12);
  }
  return toGregorian(inCalendar(calendar, pd).add({years: n}));
}

/** Whether a Gregorian date falls inside a calendar month. */
export function isInCalendarMonth(
  pd: PlainDate,
  month: CalendarMonth,
): boolean {
  return (
    !plainDateIsBefore(pd, month.start) && !plainDateIsAfter(pd, month.end)
  );
}

/**
 * The stand-alone month and year label of a calendar month, such as
 * "Aban 1405 AP". It formats a day in the middle of the month: in the
 * Japanese calendar an era can start inside a month, and most days of that
 * month then belong to the era of its middle day.
 */
export function formatCalendarMonthLabel(
  calendar: CalendarSystem,
  month: CalendarMonth,
  locale: Locale,
): string {
  return plainDateFormatStandaloneMonthYear(
    plainDateAddDays(month.start, Math.floor(month.length / 2)),
    locale,
    calendar,
  );
}

const dayNumberFormats = new Map<string, Intl.NumberFormat>();

/** A day of the month written in the locale's digits, such as ۸ in `fa`. */
export function formatDayNumber(day: number, locale: Locale): string {
  let format = dayNumberFormats.get(locale);
  if (format == null) {
    format = new Intl.NumberFormat(locale, {useGrouping: false});
    dayNumberFormats.set(locale, format);
  }
  return format.format(day);
}
