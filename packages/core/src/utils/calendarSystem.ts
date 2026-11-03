// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file calendarSystem.ts
 * @input A calendar identifier and Gregorian PlainDates
 * @output Calendar months located by their Gregorian days, month and year
 *   steps, years and months of a calendar, dates from calendar fields,
 *   availability of each calendar, and calendar labels and digits
 * @position Shared date utility; read by the i18n calendar resolution and by
 *   the date components. Values stay Gregorian PlainDates. Temporal owns the
 *   arithmetic of every calendar whose months are not Gregorian.
 */

import type {Locale} from '../i18n/types';
import type {PlainDate} from './dateTypes';
import {
  DATE_FORMAT_MONTH_ONLY,
  dateTimeFormatFor,
  plainDateAddDays,
  plainDateAddMonths,
  plainDateFormat,
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

/**
 * Whether `<input type="date">` can show the calendar. The native control is
 * Gregorian by specification, so only `gregory` and `iso8601` qualify.
 */
export function isGregorianCalendar(calendar: CalendarSystem): boolean {
  return calendar === 'gregory' || calendar === 'iso8601';
}

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
  readonly monthsInYear: number;
  with(fields: {day: number}): TemporalPlainDate;
  add(duration: {months?: number; years?: number}): TemporalPlainDate;
  until(
    other: TemporalPlainDate,
    options: {largestUnit: 'months'},
  ): {readonly months: number};
  withCalendar(calendar: 'iso8601'): TemporalPlainDate;
}

interface TemporalPlainDateConstructor {
  new (
    isoYear: number,
    isoMonth: number,
    isoDay: number,
    calendar: string,
  ): TemporalPlainDate;
  from(
    fields: CalendarDateFields & {calendar: string},
    options: {overflow: 'reject' | 'constrain'},
  ): TemporalPlainDate;
}

interface TemporalNamespace {
  PlainDate: TemporalPlainDateConstructor;
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
    labelCalendar(calendar),
  );
}

// Intl has no month names for `iso8601`. It drops the month or orders the
// fields oddly, so labels use `gregory`, which has the same months and days.
function labelCalendar(calendar: CalendarSystem): CalendarSystem {
  return calendar === 'iso8601' ? 'gregory' : calendar;
}

function utcMidnight(pd: PlainDate): number {
  const date = new Date(0);
  date.setUTCFullYear(pd.year, pd.month - 1, pd.day);
  return date.getTime();
}

function formatToParts(
  calendar: CalendarSystem,
  pd: PlainDate,
  options: Intl.DateTimeFormatOptions,
  locale: Locale,
): Intl.DateTimeFormatPart[] {
  return dateTimeFormatFor(locale, {
    ...options,
    calendar,
    timeZone: 'UTC',
  }).formatToParts(utcMidnight(pd));
}

const MONTH_PART_TYPES: ReadonlySet<string> = new Set([
  'era',
  'year',
  'relatedYear',
  'yearName',
  'month',
]);

function monthPartsKey(parts: Intl.DateTimeFormatPart[]): string {
  return parts
    .filter(part => MONTH_PART_TYPES.has(part.type))
    .map(part => part.value)
    .join('|');
}

/**
 * Formats a Gregorian date in the calendar, such as "Friday, Aban 8, 1405 AP".
 * The label always names the month and day that the grid shows. Intl and the
 * runtime's Temporal can disagree on a Chinese or Korean month start; the
 * label then takes its month and year from the middle of the Temporal month,
 * its day from Temporal, and its weekday from the date.
 */
export function formatCalendarDate(
  calendar: CalendarSystem,
  pd: PlainDate,
  options: Intl.DateTimeFormatOptions,
  locale: Locale,
): string {
  if (isGregorianAligned(calendar)) {
    return plainDateFormat(
      pd,
      {...options, calendar: labelCalendar(calendar)},
      locale,
    );
  }
  const date = inCalendar(calendar, pd);
  const parts = formatToParts(calendar, pd, options, locale);
  const middle = plainDateAddDays(
    pd,
    Math.floor(date.daysInMonth / 2) - (date.day - 1),
  );
  const middleParts = formatToParts(calendar, middle, options, locale);
  const intlDay = formatToParts(
    calendar,
    pd,
    {day: 'numeric'},
    'en-u-nu-latn',
  ).find(part => part.type === 'day')?.value;
  if (
    Number(intlDay) === date.day &&
    monthPartsKey(parts) === monthPartsKey(middleParts)
  ) {
    return parts.map(part => part.value).join('');
  }
  const {numberingSystem} = dateTimeFormatFor(locale, {
    ...options,
    calendar,
    timeZone: 'UTC',
  }).resolvedOptions();
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  return middleParts
    .map(part =>
      part.type === 'day'
        ? formatDayNumber(date.day, locale, numberingSystem)
        : part.type === 'weekday' && weekday != null
          ? weekday
          : part.value,
    )
    .join('');
}

const dayNumberFormats = new Map<string, Intl.NumberFormat>();

/**
 * A day of the month written in the locale's digits, such as ۸ in `fa`, or in
 * the given numbering system.
 */
export function formatDayNumber(
  day: number,
  locale: Locale,
  numberingSystem?: string,
): string {
  const key = `${locale}|${numberingSystem ?? ''}`;
  let format = dayNumberFormats.get(key);
  if (format == null) {
    format = new Intl.NumberFormat(locale, {
      useGrouping: false,
      numberingSystem,
    });
    dayNumberFormats.set(key, format);
  }
  return format.format(day);
}

/**
 * The fields of a date written in a calendar. A field gives either `year` or
 * `era` with `eraYear`, and either `monthCode` (such as `M05L` for a leap
 * month) or `month`, the month's position in its year.
 */
export interface CalendarDateFields {
  readonly year?: number;
  readonly era?: string;
  readonly eraYear?: number;
  readonly monthCode?: string;
  readonly month?: number;
  readonly day: number;
}

/**
 * The Gregorian date for fields written in a calendar that needs Temporal,
 * or null when the calendar does not have that date. Temporal validates the
 * fields and never adjusts them: 30 Esfand in a common Persian year is null.
 */
export function calendarDateFromFields(
  calendar: CalendarSystem,
  fields: CalendarDateFields,
): PlainDate | null {
  const temporal = getTemporal();
  if (temporal == null) {
    throw new Error(`The "${calendar}" calendar needs Temporal.`);
  }
  try {
    return toGregorian(
      temporal.PlainDate.from({...fields, calendar}, {overflow: 'reject'}),
    );
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

/** The number of months in the calendar year that contains a date. */
export function calendarMonthsInYear(
  calendar: CalendarSystem,
  pd: PlainDate,
): number {
  return isGregorianAligned(calendar)
    ? 12
    : inCalendar(calendar, pd).monthsInYear;
}

/**
 * The number of calendar months from the month `from` to the month `to`:
 * positive when `to` is later.
 */
export function calendarMonthsBetween(
  calendar: CalendarSystem,
  from: CalendarMonth,
  to: CalendarMonth,
): number {
  if (isGregorianAligned(calendar)) {
    return (
      (to.start.year - from.start.year) * 12 +
      (to.start.month - from.start.month)
    );
  }
  return inCalendar(calendar, from.start).until(
    inCalendar(calendar, to.start),
    {largestUnit: 'months'},
  ).months;
}

/**
 * The year of the calendar that a date falls in, and the position of its month
 * in that year (1 for the first month). Gregorian-aligned calendars count
 * Gregorian years; the others count the calendar's own years, as Temporal
 * does, so a Hebrew leap year has months 1 to 13.
 */
export function calendarYearMonthOf(
  calendar: CalendarSystem,
  pd: PlainDate,
): {readonly year: number; readonly month: number} {
  if (isGregorianAligned(calendar)) {
    return {year: pd.year, month: pd.month};
  }
  const {year, month} = inCalendar(calendar, pd);
  return {year, month};
}

/**
 * The calendar month at a position in a year of the calendar, as
 * {@link calendarYearMonthOf} counts them. A position past the last month of
 * the year is the last month.
 */
export function calendarMonthOfYear(
  calendar: CalendarSystem,
  year: number,
  month: number,
): CalendarMonth {
  if (isGregorianAligned(calendar)) {
    return gregorianMonth(year, month);
  }
  const temporal = getTemporal();
  if (temporal == null) {
    throw new Error(`The "${calendar}" calendar needs Temporal.`);
  }
  return temporalMonth(
    temporal.PlainDate.from(
      {calendar, year, month, day: 1},
      {overflow: 'constrain'},
    ),
  );
}

/** The number of months in a year of the calendar. */
export function calendarMonthsInCalendarYear(
  calendar: CalendarSystem,
  year: number,
): number {
  return isGregorianAligned(calendar)
    ? 12
    : calendarMonthsInYear(
        calendar,
        calendarMonthOfYear(calendar, year, 1).start,
      );
}

/**
 * The name of a calendar month, such as "Adar I". It formats the middle day of
 * the month, for the reason {@link formatCalendarMonthLabel} gives.
 */
export function formatCalendarMonthName(
  calendar: CalendarSystem,
  month: CalendarMonth,
  locale: Locale,
): string {
  return formatCalendarDate(
    calendar,
    plainDateAddDays(month.start, Math.floor(month.length / 2)),
    DATE_FORMAT_MONTH_ONLY,
    locale,
  );
}

const YEAR_PART_TYPES: ReadonlySet<string> = new Set([
  'era',
  'year',
  'relatedYear',
]);

/** The era and year parts of a date, as the locale writes them in a long date. */
function eraYearAt(
  calendar: CalendarSystem,
  pd: PlainDate,
  locale: Locale,
): {readonly era: string | undefined; readonly label: string | null} {
  const parts = formatToParts(
    calendar,
    pd,
    {era: 'short', year: 'numeric', month: 'long', day: 'numeric'},
    locale,
  );
  const era = parts.find(part => part.type === 'era')?.value;
  const first = parts.findIndex(part => YEAR_PART_TYPES.has(part.type));
  if (first === -1) {
    return {era, label: null};
  }
  let last = first;
  parts.forEach((part, index) => {
    if (YEAR_PART_TYPES.has(part.type)) {
      last = index;
    }
  });
  const label = parts
    .slice(first, last + 1)
    .filter(part => YEAR_PART_TYPES.has(part.type) || part.type === 'literal')
    .map(part => part.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return {era, label};
}

/**
 * The label of a year of the calendar, with its era where the locale writes
 * one in a date, such as "令和8" in `ja-JP` or "1405 AP" in English. It uses the
 * era and year parts of a long date, in the locale's order and digits, with the
 * text between them. A year whose first and last days fall in different eras
 * names both era years in order, such as "平成31 / 令和元"; any other year uses
 * its middle day. Gregorian years are plain numbers.
 */
export function formatCalendarYearLabel(
  calendar: CalendarSystem,
  year: number,
  locale: Locale,
): string {
  if (isGregorianCalendar(calendar)) {
    return String(year);
  }
  const months = calendarMonthsInCalendarYear(calendar, year);
  const start = eraYearAt(
    calendar,
    calendarMonthOfYear(calendar, year, 1).start,
    locale,
  );
  const end = eraYearAt(
    calendar,
    calendarMonthOfYear(calendar, year, months).end,
    locale,
  );
  // Only an era change splits a year. Other parts, such as a Chinese related
  // year, can disagree at the edges of a year when Intl and Temporal place a
  // month start one day apart.
  if (start.era !== end.era && start.label != null && end.label != null) {
    return `${start.label} / ${end.label}`;
  }
  const middle = eraYearAt(
    calendar,
    calendarMonthOfYear(calendar, year, Math.floor(months / 2) + 1).start,
    locale,
  );
  return middle.label ?? String(year);
}
