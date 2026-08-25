# Ai-app-dev

## Cursor Cloud specific instructions

### Current repository state

This repository is currently a freshly initialized placeholder. It contains only
`README.md` and `LICENSE` — there is **no application code, no dependency manifest
(`package.json`, `pyproject.toml`, `go.mod`, etc.), no lockfiles, and no services**.

As a result, there is nothing to install, build, lint, test, or run yet. The startup
update script is intentionally a no-op until real project code is added.

### Available base toolchains

The base VM image already provides common toolchains, so once product code is added you
can generally start developing without extra system installs:

- Node.js 22 (`node`), with `npm`, `pnpm`, and `yarn`
- Python 3.12 (`python3`, `pip3`)
- Go 1.22, Rust 1.83 (`cargo`), Java 21 (`openjdk`)
- `git`

### When product code is added

Once a real stack lands (e.g. a `package.json`, `pyproject.toml`, or similar), update the
Cloud Agent environment:

1. Point the startup **update script** at the appropriate install command
   (e.g. `pnpm install`, `npm ci`, `pip install -r requirements.txt`, `uv sync`).
2. Document how to run/lint/test each service here (or reference the source of truth such
   as `package.json` scripts, a `Makefile`, or the `README`).
3. Add any long-running dev servers/watchers as `terminals` rather than to the update
   script.
