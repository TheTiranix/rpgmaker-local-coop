# RPG Maker Local Co-op (same keyboard)

Two players, one keyboard, any **RPG Maker MZ / MV** game. Built and tested on **Look Outside**, designed to work on **Fear & Hunger** and other RPG Maker games.

[Leer en español](README.es.md)

## Features

| Feature | Details |
|---|---|
| **Player 2 joins any time** | Press `X` on the map. A "Player 2 has joined" banner appears. |
| **Character picker (Fear & Hunger style)** | In games with several characters, Player 2 gets a menu to choose who to play (Enki, the Barbarian, ...). The pick is added as the 2nd party member. |
| **Split screen** | One camera per player, side by side (or stacked). `G` cycles: shared, split, P1 only, P2 only. |
| **Light for Player 2** | Look Outside's "Darkness" light is applied to both players (merged in shared camera, one each in split screen). |
| **Turn-based combat for two** | Party slots 1, 3, 5 belong to P1 and 2, 4 to P2. During a character's turn **only its owner's keys work**, and a banner shows whose turn it is. |
| **Player 2 movement** | Own walk speed (copies P1's current speed by default) and sprint with Right Shift. |
| **P2 action hook** | Optional second plugin: a key that runs a common event with Player 2's position/direction/actor in variables (for shooting, aiming, interacting...). |

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | `W A S D` | Arrow keys |
| Sprint | Left Shift | Right Shift |
| OK / interact | `Z` / `Space` | `Enter` / `Numpad 0` |
| Cancel / menu | `X` / `Esc` | `Backspace` / `Numpad .` |
| Join | - | `X` (on the map, before joining) |
| Camera | `G` (either player) | |
| P2 action (optional) | - | `Right Ctrl` (configurable) |

## Install

**Easy way (Windows):**

1. Download this repo (Code > Download ZIP) and unzip it.
2. Drag your **game folder** (the one with `Game.exe` / `index.html`) onto `install.bat`.
   Or run: `powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "C:\path\to\game"`

It copies the plugins into `js/plugins`, registers them in `js/plugins.js` (a backup `plugins.js.coop.bak` is made) and works for both `js/` and `www/js/` layouts. Re-running it updates the files. `-Uninstall` removes everything.

**Manual way:**

1. Copy `plugins/LookOutsideOnline.js` (and optionally `LookOutsideOnline_Actions.js`) into the game's `js/plugins/` folder.
2. Add them to the end of `js/plugins.js` (or enable them in the RPG Maker plugin manager):
   ```js
   { "name": "LookOutsideOnline", "status": true, "description": "Local Co-op", "parameters": {} },
   { "name": "LookOutsideOnline_Actions", "status": true, "description": "Local Co-op", "parameters": {} }
   ```
   They must be listed **after** the game's own plugins.

Start the game, walk around, and press `X` to bring in Player 2.

## Parameters (`LookOutsideOnline`)

| Parameter | Default | |
|---|---|---|
| `P2ActorMode` | auto | `auto`: clone on Look Outside, character picker elsewhere. `clone` / `select` force one. |
| `P2ActorChoices` | *(all)* | Comma-separated actor IDs Player 2 may pick, e.g. `2,3,4,5`. |
| `LightPictureNames` | Darkness | Picture name(s) the game uses as the player's light. |
| `DefaultCameraMode` | shared | `shared`, `split`, `p1`, `p2`. |
| `SplitDirection` | vertical | `vertical` = side by side, `horizontal` = stacked. |
| `P2MoveSpeed` | 0 | 0 = copy P1's speed, 1-6 = fixed. |
| `P2DashBonus` | 1 | Extra speed while sprinting. |
| `JoinText` | Player 2 has joined | Banner text. |

## P2 action hook (`LookOutsideOnline_Actions`)

Games implement shooting and sprint differently, so this plugin does not guess: it gives the game a hook. When Player 2 presses the action key (default `Right Ctrl`) on the map:

1. P2's X, Y, direction and actor ID are stored in the variables you choose.
2. The chosen **common event** runs.
3. The chosen **switch** stays ON while the key is held (useful for "aiming").

From JavaScript: `CoopLocalActions.onP2Action((player2, actor) => { ... })`.

## Fear & Hunger notes (read this)

- The plugin was written without access to Fear & Hunger, so the character picker, combat turns and split screen are untested there. Please report issues.
- Fear & Hunger 2 has a sprint and lets you fire ranged weapons on the map before combat. **That logic belongs to the game's own plugins/events**: P2's sprint works with Right Shift and copies P1's speed, but P2 firing a weapon needs the game's shooting event to be pointed at P2. Use the action hook above, or open an issue with the names of the game's shooting plugin/common events so it can be wired up.
- Combat order uses party slot position, so recruited allies alternate between P1 and P2.

## Known limits

- Mouse and gamepad input are not restricted per player in combat.
- Split screen draws full-screen pictures (cutscene art, fades) once over both views; map animations on events may lag a frame in the second view.
- Light merging needs PIXI 5 (MZ). On MV, split screen still gives each player their own light.

## License

MIT. Does not contain any game assets.
