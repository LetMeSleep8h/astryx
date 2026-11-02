---
'@astryxdesign/core': patch
---

[feat] SegmentedControl: a mouse or a pen drags the selection as a finger does. A drag from the selected segment carries it with the pointer, and the release commits the segment under the pointer (`onChange` fires once, at the release). A release outside the control selects nothing, and a drag that starts on another segment commits where it lifts. Under a mouse or a pen, a click, a key or a new `value` slides the selection too, and every slide and settle takes the theme's duration and easing, not UIKit's spring. With Reduce Motion a drag still follows the pointer; the change at the release fades on a touch device and is immediate with a mouse. Keyboard and assistive technology keep the click.

@vjeux
