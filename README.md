# Family Tree (પરિવાર વૃક્ષ)

A simple web app to make your family tree.

- You type a name in English letters (Gujlish), for example `jemish`. The app suggests the Gujarati name.
- The tree arranges itself. You never have to move boxes by hand.
- You can see the family as a flowchart (Canvas) or as a real tree (Tree view).
- Your data is saved in a file (JSON or CSV). No database is needed.

## How to run

You do not need to install anything.

**Easy way:** open the file `index.html` in your browser (double click).

**Better way** (the Gujarati suggestions work more safely this way):

1. Open a terminal in this folder.
2. Run this command:

```
python -m http.server 8000
```

3. Open `http://localhost:8000` in your browser.

## How to use

| What you want | What to do |
|---|---|
| Add the first person | Click the "Pehla vyakti" button |
| Add a child | Click a box, then click **+ Child** (or press `Tab`) |
| Add a brother or sister | Click a box, then click **+ Sibling** (or press `Enter`) |
| Change a name | Double click the box (or press `F2`) |
| Delete a person | Click a box, then click **Delete**. The people below will also be deleted. |
| Start a second family line | Click **+ Naya root** at the top |
| Undo or redo | `Ctrl+Z` and `Ctrl+Y` |
| Move around | Drag the background. Use the mouse wheel to zoom. Click **Fit** to see the whole tree. |

### Typing a name

1. Type the name in English letters, for example `jemish`.
2. Press `Enter` to pick the first Gujarati suggestion. You can also use the arrow keys.
3. Press `Enter` again to save.

To add many names one after another, press `Shift+Enter` instead of the last `Enter`.

## Two views

- **Canvas:** a flowchart with boxes and lines. You do all your editing here.
- **Tree (ped):** the same family drawn as a real tree. The oldest person is at the bottom (the trunk) and the children grow up like branches. This view is for looking and sharing.

## Saving your data

- The app saves your work in the browser by itself.
- To keep a safe copy, click **Export** and choose **JSON** or **CSV**. A file is downloaded. Keep this file.
- To get your tree back later, click **Import** and choose the same file. Everything comes back and you can keep editing.
- If you see "File export baki" at the top, it means you changed something after your last export.
- **Export > Tree image (PNG)** and **Print / PDF** give you a picture of the tree view.

The CSV file has three columns: `id`, `name` and `parent_id`. It opens in Excel with Gujarati letters shown correctly.

## About the Gujarati suggestions

- With internet, the suggestions come from Google Input Tools.
- Without internet, the app uses a simple built-in guess. It is less accurate.

## Folders and files

```
index.html          the page of the app
css/style.css       colors and design
js/layout.js        puts the boxes in the right place automatically
js/store.js         keeps the data, undo/redo, auto-save
js/io.js            JSON and CSV import/export and checking
js/translit.js      English letters to Gujarati suggestions
js/canvas-view.js   the Canvas view
js/tree-view.js     the Tree (ped) drawing
js/app.js           connects everything
sample/             a small example family (JSON and CSV)
tests/              tests
```

## Tests (optional)

```
node --test tests/unit.test.js
```

The browser test needs Playwright:

```
NODE_PATH=<folder where playwright is installed> node tests/e2e.js
```

## Changing the tree design later

The tree is drawn by code in `js/tree-view.js`. Later, your own illustration or Figma design can replace this file. The rest of the app stays the same.
