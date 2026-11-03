// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file powerSearchDateZone.ts
 * @input A `date_absolute` instant's `unixSeconds` and the PowerSearch
 *   `timezoneID`
 * @output The zone a date-and-time value is read and written in, and the
 *   conversions between an instant and its wall-clock time there
 * @position Shared by the token text and the date-and-time editor, so a value
 *   with a time reads as the same time everywhere in one field
 */

import type {ISODateString} from '../utils/dateTypes';
import type {ISODateTimeString} from '../DateTimeInput/DateTimeInput';
import {
  getTimeZoneParts,
  plainDateFromISO,
  plainDateToDate,
  plainDateToInstant,
} from '../utils/plainDate';

/**
 * A date-and-time value is an instant shown in `timezoneID`, else the
 * viewer's zone, which `undefined` names: `Intl` and `Date` both default to
 * it, so no zone name is needed for it. An empty string is no zone, as the
 * formatter always read it.
 */
export function resolveDateTimeZone(
  timezoneID: string | undefined,
): string | undefined {
  return timezoneID ? timezoneID : undefined;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

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
