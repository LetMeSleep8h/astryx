---
'@astryxdesign/core': patch
---

[fix] `useMediaQuery` returns its server default where the window has no `matchMedia`, as in a test DOM, instead of throwing. Components that read it, such as SegmentedControl, now render in such a DOM.

@vjeux
