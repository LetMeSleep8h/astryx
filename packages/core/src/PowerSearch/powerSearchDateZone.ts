// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file powerSearchDateZone.ts
 * @input A `date_absolute` or range part's `unixSeconds`, the operator's
 *   `isDateOnly`, and the PowerSearch `timezoneID`
 * @output The one zone every reading of such a value uses, and the
 *   conversions between an instant and the calendar day or wall-clock time
 *   shown in that zone
 * @position Shared by the token text, the accessible label, and the value
 *   editors, so a value reads as the same day everywhere in one field
 */

import type {ISODateString} from '../utils/dateTypes';
import type {ISODateTimeString} from '../DateTimeInput/DateTimeInput';
import {
  getTimeZoneParts,
  plainDateFromDate,
  plainDateFromInstant,
  plainDateFromISO,
  plainDateToDate,
  plainDateToInstant,
  plainDateToISO,
} from '../utils/plainDate';

/**
 * The zone a date value is read and written in. A calendar day is stored as
 * midnight in `timezoneID`. With no `timezoneID` the day is the UTC day, so
 * a value written before a zone was given keeps its day. A wall-clock time
 * shows in `timezoneID`, else in the viewer's zone. `undefined` names the
 * viewer's zone, because `Intl` and `Date` default to it.
 */
export function resolveDateZone(
  timezoneID: string | undefined,
  isDateOnly: boolean,
): string | undefined {
  // An empty string is no zone, as the formatter always read it.
  if (timezoneID) {
    return timezoneID;
  }
  return isDateOnly ? 'UTC' : undefined;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function unixSecondsToISODate(
  unixSeconds: number,
  zone: string | undefined,
): ISODateString {
  const instant = unixSeconds * 1000;
  return plainDateToISO(
    zone == null
      ? plainDateFromDate(new Date(instant))
      : plainDateFromInstant(instant, zone),
  );
}

export function isoDateToUnixSeconds(
  date: ISODateString,
  zone: string | undefined,
): number {
  const plain = plainDateFromISO(date);
  const instant =
    zone == null
      ? plainDateToDate(plain).getTime()
      : plainDateToInstant(plain, zone);
  return Math.floor(instant / 1000);
}

export function unixSecondsToISODateTime(
  unixSeconds: number,
  zone: string | undefined,
): ISODateTimeString {
  const instant = unixSeconds * 1000;
  let parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  if (zone == null) {
    const d = new Date(instant);
    parts = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  } else {
    parts = getTimeZoneParts(instant, zone);
  }
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}` as ISODateTimeString;
}

export function isoDateTimeToUnixSeconds(
  value: ISODateTimeString,
  zone: string | undefined,
): number {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  const plain = plainDateFromISO(datePart as ISODateString);
  let instant: number;
  if (zone == null) {
    const d = plainDateToDate(plain);
    d.setHours(hour, minute, 0, 0);
    instant = d.getTime();
  } else {
    instant = plainDateToInstant(plain, zone, hour, minute);
  }
  return Math.floor(instant / 1000);
}
