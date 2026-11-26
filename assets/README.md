# Tree art (made in Figma)

These pictures were made in Figma and are used by the Tree view (`js/tree-view.js`).

| File | What it is |
|---|---|
| `leaf-1.svg` ... `leaf-4.svg` | Four shaded leaves (olive-yellow, light green, deep green, pale green). Transparent background. |
| `bark.jpg` | Seamless bark picture, made a little lighter. It is used on the trunk, the roots and every branch. |
| `bark-original.jpg` | The bark picture exactly as it came from Figma (before making it lighter). |

Figma file: https://www.figma.com/design/gvjCkS8VE7Z2n8Vsqix3qP
(page 1, frame "leaf sheet" has 8 leaves; `leaf-1..4` are the first four. The bark picture is the second frame.)

## How to change the art

1. Change the file in Figma and export it again (SVG for leaves, picture for bark).
2. Put the new files in this folder with the same names.
3. Run `node tools/build-assets.js`. It rewrites `js/assets.js`.
4. Open the app and look at the Tree view.

`js/assets.js` is made by that command. Do not edit it by hand.
If two leaves are not the same size, set where the leaf touches the twig in `tools/build-assets.js` (`BASES`).
