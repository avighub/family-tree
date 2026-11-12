# Our Family Tree

A kid-friendly, illustrated family tree you can explore, grow, and dress up. It runs entirely in
the browser — no build step, no server, no account. Everything you add stays on your own device.

![Preview](https://img.shields.io/badge/type-static%20site-2f7d4f)

## What it is

A single-page static app (plain HTML, CSS, and vanilla JavaScript — no framework, no bundler) that
draws an illustrated tree:

- Each person is a round portrait hanging from a branch, with a name tag underneath.
- Couples sit side by side, and children grow from the branch below their parents.
- Branches are drawn as organic curves over a sky-and-grass background rendered as SVG.
- Panning, zooming, and "fit the whole tree" keep it usable even on a phone.

The app ships with a sample family (great-grandparents down to cousins) so there is something to
poke at on first open. Replace it with your own family and the sample can always be restored from
the menu.

## Features

| Area | What it does |
| --- | --- |
| Explore | Drag the sky to pan, scroll or pinch to zoom, double-click to zoom in, `0` to fit the whole tree |
| Edit people | Click a name tag to open the editor: name, relation, fun fact, photo, frame, stickers |
| Grow the tree | `＋ Child`, `＋ Partner`, `＋ Sibling` from the editor; `＋ Grown-up` adds a new root |
| Photos | Any image file, center-cropped to a square and downscaled to 640×640 JPEG before storing |
| Frames & stickers | Four frame colors (leaf, apple, flower, nest) and a tray of emoji stickers (up to 3 per person) |
| Fold branches | Collapse a couple's descendants; a `＋3` chip shows how many people are hidden |
| Story time | A guided tour through the family, oldest generation first, flying the camera to each person |
| Photo viewer | Click a portrait for a big view with name, relation, and fun fact; arrows move through the family |
| Poster & print | Renders the current tree to a PNG canvas you can download or send straight to the printer |
| Backups | Export the whole tree as JSON and load it back later (including photos) |
| Undo | A short toast window after deleting or adding lets you take the action back |
| Sound | Small synthesized chimes and blips, muted with one button |

## How to use it

### Open it

Just open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No install, no build.

```text
family-tree/
  index.html      ← double-click this
  styles.css
  js/
```

If you prefer a local server (useful on a phone over your network):

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

The page loads the "Baloo 2" font from Google Fonts, so the rounded look needs an internet
connection on first load. Everything else works offline; without the font it falls back to a
comic-style system font.

### Move around the tree

- **Drag the sky** (any empty space) to pan. Dragging a person does not pan — it selects them.
- **Scroll** or **pinch** to zoom around the pointer.
- **Double-click** empty space to zoom in.
- Use the **− / 0 / ＋** dock at the bottom right. `0` fits the entire tree on screen.
- On a keyboard: arrow keys pan (when the tree area has focus), `+` and `-` zoom, `0` fits.

### Edit a person

1. **Click a name tag** (or press Enter on a focused person) to open the side panel.
2. Change the **name**, **relation** ("Mom", "Grandpa", "Cousin"…), and **fun fact**
   (140 characters, shown in story time and the photo viewer).
3. Pick a **frame** color and up to three **stickers** from the trays.
4. **Change photo** opens a file picker. Images are cropped to a square, resized to
   640×640, and stored as JPEG data in the browser's local storage.
5. Close the panel with `Esc` or the ✕ button. Every change saves automatically.

### Add and remove people

With someone selected, use the buttons at the bottom of the panel:

- **＋ Child** — adds a child of the selected person (and their partner, if they have one).
- **＋ Partner** — adds a spouse/partner beside them.
- **＋ Sibling** — adds someone with the same parents.
- **Remove** — deletes the person and unlinks them everywhere. A toast offers **Undo**.

The **＋ Grown-up** button in the top bar adds a brand-new root to the tree — handy for starting
from a blank tree, or for adding a family that married in.

### Photos and the viewer

- Click a **portrait** to open the big photo view. Use the `‹` / `›` buttons to flip through
  everyone, and `Esc` to close.
- If a person has no photo, their emoji stands in (🙂, 🧒, 👵 …) so the tree still reads well.

### Fold long branches

A small **−** chip sits above every couple that has descendants. Click it to fold that side away;
the chip becomes `＋3`, meaning three people are tucked inside. Click it again to open the branch.
The **⊟** and **⊞** buttons in the top bar fold or open every branch at once.

### Story time

Press **▶ Story time** for a narrated tour. The camera flies from the oldest generation to the
newest, highlighting one person at a time and reading their fun fact (or guessing a description
from their place in the tree). Use **Next →** / **← Back**, or the arrow keys, and finish with a
confetti burst. Story time opens every folded branch first.

### Poster and printing

- **🖼 Poster** draws the whole current tree onto a canvas and downloads it as
  `family-tree-YYYY-MM-DD.png` — great for framing or a birthday card.
- **Print the tree** (in the `⋯` menu) does the same and opens the browser's print dialog with just
  the poster on the page.

Photos are never uploaded anywhere; the poster is rendered locally in the browser.

### Back up and restore

The `⋯` menu has:

- **Export a backup** — downloads `family-tree-YYYY-MM-DD.json` containing every person, photo,
  and view setting.
- **Load a backup** — validates and imports a JSON file, replacing the current tree. The loader is
  defensive: unknown fields are dropped, bad ids are unlinked, and an invalid file is rejected
  rather than half-applied.
- **Start from the sample** — wipes your data and restores the demo family.

Export before you do anything drastic. Browser storage can be cleared by the browser itself, and
one family with many photos can approach the ~5 MB local-storage limit (the app warns when a save
fails).

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `+` / `-` | Zoom in / out |
| `0` | Fit the whole tree |
| Arrow keys | Pan (when the tree area is focused) |
| `Enter` / `Space` | Open the selected person (when a person is focused) |
| `←` / `→` | Previous / next person during Story time |
| `Esc` | Close the lightbox, dialog, menu, story, or editor — whichever is open |

## How it works

No framework, no build step. Each script is a small IIFE that hangs an object off `window.FT`, and
`main.js` boots them in dependency order:

| File | Responsibility |
| --- | --- |
| `js/data.js` | State shape, sample family, validation, local-storage load/save, JSON export/import |
| `js/layout.js` | Generation calculation, couple/sibling grouping, tidy-tree placement, world size, branch paths |
| `js/camera.js` | Pan/zoom transform, clamping, pinch and wheel handling, animated "fly to" |
| `js/art.js` | Procedural SVG scenery — sky, hills, leaves, trunks, flowers |
| `js/render.js` | Builds the DOM nodes and chips from the layout model |
| `js/ui.js` | Panels, editing, adding/removing, photos, lightbox, story mode, menus, undo, sound |
| `js/poster.js` | Canvas re-render of the tree for PNG download and printing |
| `js/main.js` | Boot |

State lives in one object (`people`, `collapsed`, `view`) serialized to
`localStorage["familyTree.v2"]`. Photos are data URLs inside that object, which is why the export
file is self-contained and why storage can fill up.

## Notes and limits

- **Local only.** Nothing is sent to a server. Clear your browser data and the tree is gone unless
  you exported a backup.
- **Photos are small.** They are cropped to a square and capped at 640×640 JPEG, so a photo viewer
  on a big screen will look a little soft.
- **Two parents, two partners** per person. The layout draws one couple per unit and places
  children under the primary parent pair, so a tree with blended families will render, but not
  always symmetrically.
- **Mobile-friendly.** Pointer events handle touch pan and pinch-zoom, and the layout is
  responsive.
- **Reduced motion** is respected: camera animation is skipped when the OS asks for it.
