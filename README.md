# Homerun Hero

A Pawapuro-inspired web baseball hitting game built with Three.js.

**[Play Now](https://popcornylu.github.io/homerun-hero/)**

## Gameplay

Face off against a pitcher and try to hit as many home runs as possible! Click or tap on the strike zone to swing at pitches. The closer your click is to the ball marker, the better the contact.

- **10 strikes and you're out** (swinging strikes, called strikes, and outs all count)
- Watch the yellow marker on the strike zone — it shows where the ball is heading
- Different pitch types break in different directions
- Hit a home run and the crowd goes wild!

## Features

- **9 Pitch Types**: Four-Seam Fastball, Two-Seam Fastball, Cutter, Slider, Curveball, Changeup, Splitter, Sinker, Knuckleball
- **3 Difficulty Levels**:
  - **Easy** — Slow pitches, small break, 3 pitch types
  - **Normal** — Moderate speed, full break, 8 pitch types
  - **Hard** — MLB-speed fastballs (95-101 mph), big break, all 9 types
- **Knuckleballer Mode** — 1/3 chance on Hard difficulty. The pitcher (red cap) throws unpredictable knuckleballs that zig-zag on the way in
- **MLB-Style Stadium** — Daytime field with outfield grandstands, scoreboard, warning track, and 10,000+ animated spectators
- **Pawapuro-Style Swing** — 5-step bat animation inspired by Power Pro Baseball
- **Leaderboard** — Per-difficulty high scores saved to localStorage
- **Mobile Support** — Responsive UI, touch controls
- **Pause Menu** — ESC key or tap the pause button

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:8134

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

Push to `main` branch — GitHub Actions automatically builds and deploys to GitHub Pages.

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [Vite](https://vitejs.dev/) — Dev server & build tool
- Vanilla JavaScript ES modules
- GitHub Pages

## License

MIT
