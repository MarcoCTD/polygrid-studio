# PolyGrid Studio

PolyGrid Studio is a Tauri + React + TypeScript desktop app for managing products, expenses, orders and related business workflows.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app with the Tauri runtime:

```bash
npm run tauri:dev
```

`npm run dev` only starts the browser preview. Tauri plugins such as SQLite are not available there.

## Checks

```bash
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

## CI

The macOS workflow patch is prepared locally, but publishing it is currently blocked by missing GitHub token scope for workflow file updates.

`npm run tauri:build` is the stable test-build path and generates the macOS app bundle. Use `npm run tauri:bundle` only when you want the full platform bundle flow.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
