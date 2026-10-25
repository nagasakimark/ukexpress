# UK Express! (UKエクスプレス！)

A Momotetsu-style railway board game that teaches Japanese elementary students about the UK.
HTML5 Canvas + TypeScript, one ES module per file, with all teaching content in editable JSON files.
Version 0.6, the "education edition" layout: a Momotetsu-style fake-3D board, a Station guide on the side, a TV-studio presenter (Mark Sensei),
Japanese-first text with small English underneath, and very few pop-ups. Japanese text uses only kanji taught by the end of grade 4.

## Play it

Double-click **`start.bat`**. It starts a small local web server and opens the game in your browser at http://localhost:8080.
The server needs either Node.js or Python. It is required because browsers will not load separate module and JSON files from `file://`.
You can also run `npm start`, or `python -m http.server 8080` in this folder and then open http://localhost:8080.

Controls: tap/click, or the keyboard (arrow keys to move, Enter/Space/Z to confirm, Esc/X to go back). Message boxes carry on with a tap or Enter.
Drag to pan the map, and pinch or use the scroll wheel to zoom.

**Teacher panel:** the 🍎 button on the title screen. The PIN starts as **0000**.

## Game set-up

- **Players:** 1 to 4 people share one screen and take turns ("pass the Chromebook"). Each picks a name and avatar. A coloured "…'s turn!" banner shows before each turn.
- **CPU rivals:** 0 to 3 (a solo player always has at least one). Computer players show every message in a box that you click through, so you can see what happened.
- **Game length:** Short (1 year), Medium (3 years), Long (10 years). One turn is one month.
- **Language:** 日本語 + English (default: Japanese big, English small underneath), 日本語だけ, or English only.

## Learning content

- **The Station guide** (right side of the screen) always shows a place: the station you are standing on, the destination, or (with the Map button) the one under the magnifier. It has a picture, the region, a few facts and a small UK map. "もっと しりたい！" opens the full factfile.
- **The presenter, Mark Sensei,** appears on a TV set for the big moments: the start of the game, every new destination (with the place on the TV), arrival, a special day each month, a new year and the end of the game.
- **Every month starts with a picture card** (`assets/images/months/`). Each month has one special day shown on the TV (Hogmanay, Burns Night, Pancake Day, Wimbledon, Bonfire Night, Christmas and more; list in `content/events.json`).
- **Spinners** pick the card on a card square, the prize on a lucky square and the arrival bonus. Tap to stop early.
- **Quizzes are off by default.** In the Teacher panel you can switch them on at each destination, or as a class quiz at the end of each year.
- Heroes appear at their station or on surprise squares and give you their card, with a line about who they were. The 🦸 UK Book keeps everything you have collected.

Re-render board pictures after changing a landmark: `BASE=/assets/models/ python3 tools/render_sprites.py lm/durham`, then `python3 tools/pack_sprites.py` (see assets/sprites/CREDITS.txt).

## What's new in v0.6

- New screen layout: map on the left, Station guide on the right, every player's money and distance under the map, one see-through message box.
- Japanese first with English underneath; Japanese only uses kanji up to grade 4 (check with `python3 tools/kanji_check.py`; `tools/kanji_fix.py` turns harder kanji into hiragana).
- Mark Sensei's TV studio, month picture cards and spinners replace most pop-ups. Quizzes are off by default (Teacher panel).
- The Boggart, Leaves on the Line, Queue and similar mean cards are gone. Red squares cost less.
- `content/*.json` is now the source of truth (the old generators in `tools/data` are kept only for reference).

## What was new in v0.5

- Renamed to **UK Express**. Every player's train head and carriages are painted in their colour; only the active train is shown when trains share a square.
- Hot-seat multiplayer (1 to 4 humans), CPU turns shown step by step.
- Game lengths Short/Medium/Long.
- Seasonal mountains, hills and landmark hills; lighter drawing behind pop-ups and a lower pixel-density cap for Chromebooks.

## Not yet

Dice sound effects, final photos, voice audio, region-limited games.
