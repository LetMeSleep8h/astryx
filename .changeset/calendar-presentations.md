---
'@astryxdesign/core': patch
---

[feat] DateInput, DateTimeInput, DateRangeInput: show every picker in the calendar. With a `calendar` other than `gregory` or `iso8601`, such as `'persian'` or `'hebrew'`, DateInput and DateTimeInput never show the native date control, which can show only Gregorian dates: `adaptive-native` (the default), the deprecated `nativePicker` values, and `presentation="native"` use the calendar popover on a mouse and the bottom sheet on a touch screen. An explicit `presentation="native"` also warns in development. The bottom sheet shows months of the calendar, with its month names and the locale's digits, in panes of one fixed height; its month wheel lists the months of the selected calendar year, including leap months such as Adar I and Adar II, and a year change keeps the month or moves to its common counterpart (Adar I becomes Adar); year labels carry the era, such as `令和8`, and a year in which the era changes names both, such as `平成31 / 令和元`. DateRangeInput takes a `calendar` prop, defaulting to the `InternationalizationProvider` calendar, and writes its trigger text and shows its popover calendar in it. Values stay Gregorian ISO dates. Without `Temporal`, calendars other than `gregory`, `iso8601`, `buddhist`, `roc`, and `japanese` show Gregorian dates and the native control as before.

@nynexman4464
