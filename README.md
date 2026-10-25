# UK Express! (UKエクスプレス！) — playable build

A Momotetsu-style railway board game that teaches Japanese elementary students about the UK.
This repo holds the built game only (no TypeScript source or dev tools).

## Play it

Double-click **`start.bat`**, or run one of these in this folder:

```
node server.mjs
python -m http.server 8080
```

then open http://localhost:8080 in your browser.
(A local server is required because browsers will not load the game's files from `file://`.)

Controls: tap/click, or the keyboard (arrow keys to move, Enter/Space/Z to confirm, Esc/X to go back).
Drag to pan the map, pinch or scroll to zoom. 1 to 4 players share one screen and take turns.

## Contents

```
index.html      the page: canvas + one <script type="module">
css/            page styles and fonts
js/             compiled game (built from TypeScript source)
content/        everything the game teaches (stations, places, heroes, events, cards)
assets/         pictures, sounds and pre-rendered board sprites
server.mjs      tiny static web server (no dependencies)
start.bat       double-click to play on Windows
```

## What's new in v0.6

- Japanese first, English small underneath. Japanese uses only kanji taught by the end of grade 4: check with `python3 tools/kanji_check.py`; `python3 tools/kanji_fix.py <files>` turns harder kanji into hiragana.
- New screen: the map on the left, the Station guide on the right, every player's money and distance under the map. On a window wider than 16:9 the map and HUD spread out to fill it.
- Mark Sensei's TV studio (chibi art), month picture cards, spinners for card squares, lucky squares and arrival bonuses, and a destination roulette.
- A Station guide write-up for all 114 places (Durham is Mark Sensei's hometown and has St Cuthbert's story; King's Cross has Platform 9¾; Manchester has the first computer, the Suffragettes and more).
- The turn banner only crosses the map; train steam stays on the map, under the HUD and dialogs; cards sit inside the message box.
- Removed: the Boggart, the mean cards (Leaves on the Line, Queue, Richard Turpin, and the cards that only defended against them), the teacher menu, and in-game quizzes.
  Heroes whose powers needed the Boggart or quizzes have new powers (including a new "draw a card" power).
