---
'@astryxdesign/cli': patch
'@astryxdesign/core': patch
---

[feat] A component doc can mark its component deprecated with `deprecated: {replacement, description}`: the `name` of the component to use instead and the modernization route. `astryx search` results and `astryx build` kit entries for that component carry the field as `deprecated` (a `deprecated:` line in their text output), and the docsite labels the component Deprecated in its page header (beside any stability badge), components index tile, and search, crosses out its sidebar entry, and shows a notice at the top of its page that names and links the replacement. `BottomSheetSwitcher` sets it, naming `BottomSheet`; the component keeps working unchanged.

@imdreamrunner
