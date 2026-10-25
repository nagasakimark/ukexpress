# UK Express! (UKエクスプレス！)

A Momotetsu-style railway board game that teaches Japanese elementary students about the UK.
HTML5 Canvas + TypeScript, one ES module per file, with all teaching content in editable JSON files.
Version 0.7: Japanese first (only kanji taught by the end of grade 4) with small English underneath, a TV-studio presenter (Mark Sensei),
a Station guide with a write-up for every one of the 114 places, and a layout that fills widescreen windows.

## Play it

Double-click **`start.bat`**. It starts a small local web server and opens the game in your browser at http://localhost:8080.
The server needs either Node.js or Python. It is required because browsers will not load separate module and JSON files from `file://`.
You can also run `npm start`, or `python -m http.server 8080` in this folder and then open http://localhost:8080.

Controls: tap/click, or the keyboard (arrow keys to move, Enter/Space/Z to confirm, Esc/X to go back).
Drag to pan the map, and pinch or use the scroll wheel to zoom. Drag or scroll inside the Station guide to read more; tap its photo to see it big.

## Game set-up

- **Players:** 1 to 4 people share one screen and take turns ("pass the Chromebook"). Each picks a name and avatar. A "Pass to ...!" screen shows before each person's turn.
- **CPU rivals:** 0 to 3 (a solo player always has at least one). Computer players show every message in a box that you click through, so you can see what happened.
- **Game length:** Short (1 year), Medium (3 years), Long (10 years). One turn is one month.
- **Language:** 日本語 + English (default: Japanese big, English small underneath) or English only.

## Learning content

- **The Station guide** (right of the map) always shows a place: where you are, the next destination, or (with the Map button) the place under the magnifier.
  It has the photo (several photos take turns; tap to see them full screen), the region, a small UK map and a scrolling write-up:
  stories, history, famous people, films and fun facts, written for children (`content/guide.json`), plus what the place is famous for and its local team.
- **Mark Sensei's TV studio** introduces the game, every new destination (with a roulette on the TV that slows down and stops on the place), every arrival and every special day.
- **Every month starts with a picture card** (`assets/images/months/`). Each month has one special day (Hogmanay, Burns Night, Pancake Day, Wimbledon, Bonfire Night, Christmas and more; `content/events.json`).
- **Arrivals:** the first train gets a spinner bonus; the next two closest trains get a smaller "photo finish" bonus.
- **Junctions:** the pink arrow is always the shortest way to the destination.
- Heroes appear at their station or on surprise squares and give you their card, with a power you can use once a year. The 📖 UK Book keeps everything you have collected.
- Quizzes are switched off in this version (there is no teacher menu). Hero quizzes remain in the UK Book.

## Pictures

`assets/images/` holds a placeholder for every picture the game can show: `places/` (114 stations), `heroes/` and `events/`.
Replace a placeholder by saving your picture with **exactly the same file name**. See `assets/images/README.md` for the full list,
and `assets/images/manifest.json` for the same list as data. Names are lower-case with no spaces or punctuation (`kingscross.png`, `alanturing.png`, `summersolstice.png`).
If a picture is missing the game shows a coloured card, so nothing breaks. After adding a station, hero or event, run `python tools/make_placeholders.py`.

## Sounds

Put recorded sounds in `assets/sounds/`: `bgm.ogg` (the looping background track) and `choochoo.mp3` (played at the start of each turn, once the train is in view). If a file is missing, the game uses its built-in tune and whistle instead. These files are not included in the zip, so your own copies are never overwritten.

## Performance

The board is drawn once while the camera is still and reused. If a computer is slow, the game steps down its board detail by itself (fewer trees, a coarser ground, a smaller scenery picture) and steps back up when it runs fast again; it remembers the level for next time (browser storage key `ukExpressTier`; clear it to start again at full detail). Words, trains, signs and dialogs always stay sharp. `?lite=1` forces a lighter level.

## Folder layout

```
index.html            the page: just the canvas, the loading screen and one <script type="module">
css/style.css         page styles and the Pook font
assets/fonts/         Pook.otf (the game's English font)
assets/sprites/       the pre-rendered board pictures (atlases + sprites.json); see its CREDITS.txt
assets/images/        placeholder pictures for places, heroes and events (replace these)
content/              EVERYTHING the game teaches: edit these to change the game
  stations.json       the stations: position, properties, fact, quiz, film facts
  places.json         extra facts, local team and "famous for" for every station
  guide.json          the Station guide write-up for every station (icon, title, text in Japanese and English)
  heroes.json         the Hall of Heroes, plus the Durham hometown guest
  events.json         the special days by month: dates, facts, quiz, effect
  cards.json  game.json  board.json  grid.json  words.json  custom-quiz.json
src/                  TypeScript source (edit this, then run npm run build)
  core/               rules only: no drawing (state, rules, CPU AI, board, calendar, content loading)
  engine/             canvas, input, tweens, UI widgets, particles, synth audio
  game/fake3d/        the board view: ground, scenery, trains, signs
  game/               the game: flow (turns), dialogs, show (studio, month card, spinner), hud (top bar, players, Station guide), layout, profile pages, company books, UK Book, tutorial; scenes/ = title, setup, board, results
  studio/             the sprite studio (three.js) that makes the board pictures
js/                   compiled JavaScript (made by `npm run build`; this is what the browser loads)
tools/                server, sprite and placeholder tools; kanji_check.py / kanji_fix.py (grade 1-4 kanji only); guide/ (the guide write-ups as Python, build guide.json from them)
start.bat             double-click to play on Windows
```

## Develop

```
npm install
npm run dev     # recompiles src/ to js/ on save and serves the game
npm run build   # compiles once
npm run check   # type-check only
```

Test URLs: `?auto=1&years=1&seed=42` makes the computer play every seat at 30x speed (good for finding bugs).
`?play=1&humans=2&rivals=1&years=1&seed=7` skips the set-up screen. `?view=durham&month=9&zoom=1.2` shows a still view of one station in a given month (0 = April).
`?lite=1` forces the lighter drawing. `?lang=en` is English only.

Re-render board pictures after changing a landmark: `BASE=/assets/models/ python3 tools/render_sprites.py lm/durham`, then `python3 tools/pack_sprites.py` (see assets/sprites/CREDITS.txt).

## What's new in v0.7
- Station guide: a "See more" button at the bottom of the scrolling facts, and the little UK map is now a button that opens a big map with every region.
- Month picture is a free-floating sticker with a drop shadow (no frame); art sheet is `assets/images/months/`.
- Basic train only (no upgrades); carriages sit closer together and tilt with the rails when travelling up or down the screen.
- 3D dice, new studio and news art, mic-free presenter, no map flash after the studio intro, scrolling "learn more", scenery culled for widescreen.
- Landmarks sit on their ground (hill plinths flattened, clocks on Big Ben, Brighton pier rebuilt); mountains no longer cover landmarks.
- Title screen train follows a winding stretch of real track.
- Station-arrival scene code (`arrivalScene` in `src/game/show.ts`, art `assets/images/presenter/arr_*.png`) is written but switched off for now.

## What's new in v0.6

- Japanese first, English small underneath. Japanese uses only kanji taught by the end of grade 4: check with `python3 tools/kanji_check.py`; `python3 tools/kanji_fix.py <files>` turns harder kanji into hiragana.
- New screen: the map on the left, the Station guide on the right, every player's money and distance under the map. On a window wider than 16:9 the map and HUD spread out to fill it.
- Mark Sensei's TV studio (chibi art), month picture cards, spinners for card squares, lucky squares and arrival bonuses, and a destination roulette.
- A Station guide write-up for all 114 places (Durham is Mark Sensei's hometown and has St Cuthbert's story; King's Cross has Platform 9¾; Manchester has the first computer, the Suffragettes and more).
- The turn banner only crosses the map; train steam stays on the map, under the HUD and dialogs; cards sit inside the message box.
- Removed: the Boggart, the mean cards (Leaves on the Line, Queue, Richard Turpin, and the cards that only defended against them), the teacher menu, and in-game quizzes.
  Heroes whose powers needed the Boggart or quizzes have new powers (including a new "draw a card" power).

## What's new in v0.5

- Renamed to **UK Express**. Every player's train head and carriages are painted in their colour; only the active train is shown when trains share a square.
- Hot-seat multiplayer (1 to 4 humans), CPU turns shown step by step, pop-ups closed only by buttons.
- Place and event factfiles with turn-based quizzes; one special day a month; 199 placeholder pictures.
- Game lengths Short/Medium/Long; Japanese-only option removed.
- Rarer rain (just one of many reasons for a red square), a fairer Boggart that naps and moves on.
- Seasonal mountains, hills and landmark hills; no pink trees; hill-top landmarks are no longer hidden by scenery.
- Lighter drawing behind pop-ups and a lower pixel-density cap for Chromebooks.

## Not yet

Dice and train sound effects, music and voice audio, region-limited games, a shop list with profit %.
