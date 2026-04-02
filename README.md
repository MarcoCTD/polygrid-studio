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

GitHub Actions builds and uploads macOS test artifacts from `src-tauri/target/release/bundle/` on pushes and pull requests.

`npm run tauri:build` is the stable test-build path and generates the macOS app bundle. Use `npm run tauri:bundle` only when you want the full platform bundle flow.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
