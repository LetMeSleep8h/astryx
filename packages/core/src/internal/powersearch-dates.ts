// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file powersearch-dates.ts
 * @input PowerSearch's date zone module
 * @output `@astryxdesign/core/internal/powersearch-dates`: the zone rule and
 *   the instant-to-day and instant-to-wall-clock conversions PowerSearch's
 *   token, label and editors share, re-exported by name for Lab
 * @position An internal entry reserved for Astryx's own packages:
 *   undocumented, outside the public API and its compatibility promise,
 *   versioned in lockstep with Core, and allowed only in Core and Lab by the
 *   `@astryx/no-core-internal-import` lint rule. Core imports the same module
 *   by relative path. Named re-exports only, never a gathering object.
 */

export {
  isoDateTimeToUnixSeconds,
  isoDateToUnixSeconds,
  resolveDateZone,
  unixSecondsToISODate,
  unixSecondsToISODateTime,
} from '../PowerSearch/powerSearchDateZone';
