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
