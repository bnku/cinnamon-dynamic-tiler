# Dynamic Tiler

English | [Русский](README.ru.md)

Dynamic Tiler is an intent-aware tiling extension for Cinnamon. It gives a stacking desktop the part people actually want from a tiling window manager: fast keyboard layouts, fluid mouse-driven rearrangement, visible previews, and forgiving behavior when windows are dragged, resized, swapped, extracted, or pushed into tight spaces.

The project is built around a pure TypeScript tiling engine and a Cinnamon extension shell. The engine owns the grid math; the extension owns the user experience: shortcuts, drag-and-drop snapping, monitor-aware settings, previews, and diagnostics.

## Why It Feels Different

- Keyboard tiling is elastic instead of binary: press the same direction repeatedly to grow, shrink, or move by grid steps.
- Opposite-direction resize has short-term memory: if you resize the wrong way and immediately press the opposite arrow, Dynamic Tiler restores the previous shape instead of surprising you with a new expansion.
- Drag-and-drop is layout-aware: drop a window into a stack, between neighbors, at a screen edge, or into a narrow corridor, and the solver tries to preserve the most natural layout.
- Swap is explicit and readable: hold the swap modifier and windows exchange their geometry, with a dedicated preview style.
- Floating extraction is safe: pull a tiled window out with the modifier, and the original slot collapses only when the gesture clearly leaves the source.
- Multi-monitor grids are practical: regular horizontal, vertical, and ultrawide monitors can use different column/row profiles, with optional per-monitor overrides.

## Core Features

- Native Cinnamon extension for live keyboard and mouse workflows.
- Drag-and-drop snapping with insertion into horizontal and vertical stacks.
- Edge insertion between a window and the monitor boundary.
- Intent-aware carving when a wide window is inserted into a narrow stack.
- Window swap mode with configurable modifier.
- Per-monitor grid profiles: horizontal, vertical, ultrawide, and explicit overrides.
- Configurable gaps, preview, shortcuts, DnD modifier, swap modifier, and debug logs.
- Clean TypeScript core with focused unit, regression, and property/fuzz tests.
- Optional legacy CLI/X11 path for direct command experiments.

## Installation

### Requirements

- Linux Mint / Cinnamon on X11.
- Node.js and npm.
- For the legacy CLI path only: `wmctrl`, `xdotool`, and `x11-utils`.

On Ubuntu/Linux Mint:

```bash
sudo apt update
sudo apt install nodejs npm wmctrl xdotool x11-utils
```

### Build And Install The Cinnamon Extension

```bash
npm install
npm test
npm run build:extension
```

`npm run build:extension` does two things:

- builds a local extension bundle into `build/extension/`;
- installs the same bundle into `~/.local/share/cinnamon/extensions/dynamic-tiler@cinnamon.org/`.

After building, reload Cinnamon or reload the extension from the Cinnamon Extensions app so the new `extension.js`, `settings-schema.json`, and `metadata.json` are picked up.

For a full build including the legacy CLI output:

```bash
npm run build
```

## Settings

Open Cinnamon Extensions, select Dynamic Tiler, and use the settings window.

The settings are split into tabs:

- Layout: gaps, preview, default grid, monitor profiles, and per-monitor overrides.
- Drag & Drop: DnD enablement and snap modifier.
- Keyboard: tile, shift, and restore shortcuts.
- Diagnostics: debug logging.

Useful defaults:

- default grid: `12 x 6`;
- regular horizontal monitors: `6 x 6`;
- vertical monitors: `6 x 12`;
- ultrawide monitors: `12 x 6`;
- minimum window size: `2 x 2` grid cells.

Per-monitor overrides use this format:

```text
0:12x6, 1:6x12, 2:12x6
```

Debug logs are disabled by default. When enabled, Dynamic Tiler writes detailed traces to `~/.xsession-errors`.

## Keyboard Workflow

Default shortcuts are configured in the extension settings:

| Action | Default shortcut | Result |
| --- | --- | --- |
| Tile left | `Super + Left` | Move or resize the focused window left |
| Tile right | `Super + Right` | Move or resize the focused window right |
| Tile up | `Super + Up` | Move or resize the focused window upward |
| Tile down | `Super + Down` | Move or resize the focused window downward |
| Shift left/right/up/down | Configurable | Send a window directly toward a side |
| Restore | Configurable | Restore the saved pre-tiling geometry |

The keyboard model is intentionally forgiving. If you resize a window and quickly press the opposite direction, Dynamic Tiler treats that as a correction and restores the previous geometry. After a short delay, the opposite direction becomes a normal resize again.

## Mouse Workflow

Hold the configured DnD modifier while dragging a window to make it participate in the grid.

Typical gestures:

- drop near a screen side to snap into that side;
- drop near a vertical position to choose top half, bottom half, or full height;
- drop between stacked windows to insert into the stack;
- drop between an edge window and the monitor boundary to create a new slot;
- hold the swap modifier to exchange two windows instead of inserting.

The preview should always describe the intended result before the drop. Normal insertion, blocked placement, and swap use different visual treatment.

## Development

```bash
npm install
npm test
npm run build:cli
npm run build:extension
```

Important paths:

- `src/core/` - pure tiling math and use cases.
- `src/DragTiling.ts` - DnD target selection, insertion, carving, swap, and vacancy collapse.
- `src/extension.ts` - Cinnamon integration, settings, shortcuts, previews, and drag hooks.
- `settings-schema.json` - Cinnamon settings UI.
- `tests/` - regression, use-case, and property/fuzz coverage.
- `build/extension/` - generated local Cinnamon extension bundle.
- `~/.local/share/cinnamon/extensions/dynamic-tiler@cinnamon.org/` - installed Cinnamon extension bundle.

## Legacy CLI

The CLI still exists for experiments and direct X11 automation:

```bash
npm run build:cli
node dist/cli.js tile left
node dist/cli.js tile right
node dist/cli.js restore
```

For daily use, the Cinnamon extension is the primary product.

## Status

Dynamic Tiler is an active UX-first tiling experiment. The current focus is polishing edge cases where real users live: narrow stacks, screen edges, multi-monitor grids, modifier mistakes, floating extraction, and the subtle difference between "I want to insert this window" and "I want these two windows to trade places."
