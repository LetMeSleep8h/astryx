---
'@astryxdesign/core': patch
---

[feat] SegmentedControl: a mouse or a pen drags the selection as a finger does. A drag from the selected segment carries it with the pointer, and the release commits the segment under the pointer (`onChange` fires once, at the release). A release outside the control selects nothing, and a drag that starts on another segment commits where it lifts. A click still selects with the theme's color transition. Under a mouse or a pen, the selection settles with the theme's duration and easing, not UIKit's spring. Keyboard and assistive technology keep the click.

@vjeux
