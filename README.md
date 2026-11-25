# Family Tree (પરિવાર વૃક્ષ)

Gujarati family tree app. Naam Gujlish me type karo, Gujarati suggestion milega. Layout poora automatic hai, kuch bhi manually nahi rakhna.
Koi install ya database nahi chahiye. Data aapki JSON / CSV file me rehta hai.

## Chalane ka tarika

Option 1 (sabse easy): `index.html` par double click karo.

Option 2 (Google suggestion ke liye ye zyada safe): folder me terminal kholo aur

```
python -m http.server 8000
```

phir browser me `http://localhost:8000` kholo.

## Kaise use karna hai

| Kaam | Kaise |
|---|---|
| Pehla vyakti | "Pehla vyakti" button |
| Bacha add | Box par click, phir **+ Child** (ya `Tab`) |
| Bhai / behen add | Box par click, phir **+ Sibling** (ya `Enter`) |
| Naam badlo | Box par double click (ya `F2`) |
| Delete | **Delete** (ya `Delete` key). Neeche ke log bhi jayenge, Undo se wapas aa sakte hain |
| Alag shuruaat (2nd root) | Upar **+ Naya root** |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Ghoomna / zoom | Background drag karo, mouse wheel se zoom, **Fit** se poora tree |

Naam likhte time: `jemish` type karo, `Enter` (suggestion chun jata hai), phir `Enter` (save). Ek saath kai naam daalne ke liye `Shift+Enter` (save karke agla naam).

## Do view

- **Canvas**: flowchart jaisa, yahin sab edit hota hai.
- **Tree (ped)**: wahi data, asli ped ke roop me (trunk neeche, branches upar). Ye sirf dekhne aur export ke liye hai.

## Data save / wapas lana

- Browser me apne aap auto-save hota hai.
- **Export > JSON** ya **CSV**: file download hoti hai. Isi ko save karke rakho.
- **Import**: wahi file upload karo, sab wapas aa jayega, aur aage edit kar sakte ho.
- Header me "File export baki" dikhe to matlab last export ke baad changes hue hain.
- **Export > Tree image (PNG)** aur **Print / PDF** se ped ka design nikalta hai.

CSV ke columns: `id,name,parent_id`. Excel me kholne par Gujarati sahi dikhta hai.

## Suggestion (Gujlish to Gujarati)

Internet ho to Google Input Tools se suggestion aata hai. Internet na ho to basic offline suggestion aata hai (kam accurate).

## Folder

```
index.html        app ka page
css/style.css     design
js/layout.js      automatic layout
js/store.js       data, undo/redo, auto-save
js/io.js          JSON/CSV import-export aur checking
js/translit.js    Gujlish suggestion
js/canvas-view.js canvas view
js/tree-view.js   ped design (SVG)
js/app.js         sab ko jodta hai
sample/           demo family (JSON + CSV)
tests/            tests
```

## Tests (optional)

```
node --test tests/unit.test.js
NODE_PATH=<playwright wali jagah> node tests/e2e.js
```

## Ped ka design badalna

Abhi ped code se banta hai (`js/tree-view.js`). Aapki illustration ya Figma design aane par is file ko badal denge, baaki app waisa hi rahega.
