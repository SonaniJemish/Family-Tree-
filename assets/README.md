# Art used by the tree

The tree, leaves and background are real-looking pictures made with Figma's image maker.

Folders
- `photo/` - the 4 big source pictures (background, leaves sheet, foliage, bark). Figma file: https://www.figma.com/design/gvjCkS8VE7Z2n8Vsqix3qP
- `photo/processed/` - the small pieces made from them (8 cut-out leaves, seamless bark tile, seamless foliage tile, background)
- `leaf-*.svg`, `bark*.jpg` - the older drawn art (not used any more, kept for history)

How to change the art
1. Put a new picture in `photo/` with the same file name.
2. `python3 tools/make-photo-assets.py`  (cuts the leaves, makes the seamless tiles)
3. `node tools/build-assets.js`  (puts everything into `js/assets.js`)

The pictures are placed inside `js/assets.js` on purpose: when the tree is saved as PNG or PDF, the SVG is turned into an image, and an image made that way cannot load other files.
