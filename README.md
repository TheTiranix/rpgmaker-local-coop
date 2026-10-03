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
| **Fear & Hunger 2 plugin** | Separate plugin: P2 shoots guns on the map, light/vision for P2, auto-join as party member #2. |

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move | `W A S D` | Arrow keys |
| Sprint | Left Shift | Right Shift |
| OK / interact | `Z` / `Space` | `Enter` / `Numpad 0` |
| Cancel / menu | `X` / `Esc` | `Backspace` / `Numpad .` |
| Join | - | `X` (on the map, before joining) |
| Camera | `G` (either player) | |

## Install

**Easy way (Windows):**

1. Download this repo (Code > Download ZIP) and unzip it.
2. Drag your **game folder** (the one with `Game.exe` / `index.html`) onto `install.bat`.
   Or run: `powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "C:\path\to\game"`

The installer detects the game (from `data/System.json`): **Look Outside** gets only the base plugin; **Fear & Hunger** also gets `LocalCoop_FearHunger.js` (P2 shooting before combat, vision light and automatic join, which do not exist in Look Outside). Force it with `-Profile lookoutside|fearhunger|generic`.

It copies the plugins into `js/plugins`, registers them in `js/plugins.js` (a backup `plugins.js.coop.bak` is made) and works for both `js/` and `www/js/` layouts. Re-running it updates the files. `-Uninstall` removes everything.

**Manual way:**

1. Copy `plugins/LookOutsideOnline.js` (and optionally `LocalCoop_FearHunger.js`) into the game's `js/plugins/` folder.
2. Add them to the end of `js/plugins.js` (or enable them in the RPG Maker plugin manager):
   ```js
   { "name": "LookOutsideOnline", "status": true, "description": "Local Co-op", "parameters": {} },
   { "name": "LocalCoop_FearHunger", "status": true, "description": "Local Co-op", "parameters": {} }
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

## Fear & Hunger 2: Termina (`LocalCoop_FearHunger`)

Termina is RPG Maker **MV** with its own systems, so this separate plugin (installed only for Fear & Hunger, never for Look Outside) adapts the mod to them:

- **Joining:** press `X` on the map. If the party has **only the protagonist**, a menu asks which character to add (Levi, Marina, Daan, Abella, Marcoh, Karin, Olivia). If the party **already has 2+ members**, Player 2 automatically becomes **party member #2**, no menu.
- **Characters leaving the party:** Player 2 always follows party slot #2. If that character leaves, Player 2 switches to whoever is now in slot #2 (a banner says so). If the party is left with only the protagonist, Player 2 drops out until `X` is pressed again. The mod never forces anyone to stay in the party, so the story is untouched.
- **Shooting before combat:** in Termina, holding Shift with a gun equipped fires on the map (each map has an `arrow_check` event). Player 2 does the same with **Right Shift** when *their* character has a pistol, rifle or shotgun equipped: while the shot runs, the game's own event sees Player 2's position, facing, character and weapon. Ammo is the shared party ammo and the game's own sprites, sounds and projectile are used. Without a gun equipped, Right Shift is the sprint.
- **Sprint:** Player 2 copies Player 1's current speed (so the game's own speed changes apply) plus the sprint bonus.
- **Vision / light:** the fog vision circle (GALV_VisibilityRange) and TerraxLighting are given to Player 2 too: merged in shared camera, one per view in split screen.
- **Combat:** works with Termina's battle system. Party slots 1, 3, 5 belong to P1 and 2, 4 to P2.
- **Keys:** P1 keeps `WASD` even if the game's keyboard-config plugin remaps keys. Right Shift is exclusive to Player 2.

### Fear & Hunger 2 status

Tested in a browser harness running the real game data: joining (picker and automatic), party changes, shared and split camera with the vision circle, combat turns with key locking, and a Player 2 pistol shot (projectile spawned from Player 2, ammo consumed, firing pose shown). **Not** tested through a full playthrough, with rifle/shotgun, with the Botanist's armor requirement, or with every enemy type reacting to Player 2's bullets, so please report issues. Fear & Hunger 1 is not supported by this plugin.

## Known limits

- Mouse and gamepad input are not restricted per player in combat.
- Split screen draws full-screen pictures (cutscene art, fades) once over both views; map animations on events may lag a frame in the second view.
- Light merging needs PIXI 5 (MZ). On MV, split screen still gives each player their own light.

## License

MIT. Does not contain any game assets.
