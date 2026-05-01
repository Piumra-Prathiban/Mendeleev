# Mendeleev

A minimalistic, high-performance desktop notes app for macOS.

Built with Tauri 2 (Rust) + React + Vite + Tailwind CSS. SQLite for local persistence. No cloud, no auth, no Electron.

See [`docs/CONTEXT.md`](docs/CONTEXT.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md) for product spec and phase plan.

## Requirements
- Node 20+
- Rust (stable) + Cargo
- Xcode Command Line Tools (for macOS bundling)

## Setup
```bash
npm install
```

## Develop
```bash
npm run tauri dev
```
Opens a native macOS window with hot reload.

## Build
```bash
npm run tauri build
```
Outputs `.app` and `.dmg` under `src-tauri/target/release/bundle/macos/`.
