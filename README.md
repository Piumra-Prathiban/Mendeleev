# Mendeleev

A minimalistic, high-performance desktop notes app for macOS.

Built with Electron + React + Vite + Tailwind CSS. SQLite (`better-sqlite3`) for local persistence. No cloud, no auth.

See [`docs/CONTEXT.md`](docs/CONTEXT.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for product spec and phase plan.

## Requirements
- Node 20+
- Xcode Command Line Tools (for native module build + macOS bundling)

## Setup
```bash
npm install
```
On first install, `better-sqlite3` is rebuilt against Electron's Node ABI. If you bump Electron later:
```bash
npm run rebuild
```

## Develop
```bash
npm run dev
```
Opens a native macOS window with HMR.

## Build (.app + .dmg)
```bash
npm run package:mac
```
Outputs under `release/`.
