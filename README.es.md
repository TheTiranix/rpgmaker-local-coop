# Co-op local para RPG Maker (mismo teclado)

Dos jugadores, un teclado, cualquier juego de **RPG Maker MZ / MV**. Hecho y probado en **Look Outside**, pensado para **Fear & Hunger** y otros juegos de RPG Maker.

[Read in English](README.md)

## Qué hace

| Función | Detalle |
|---|---|
| **El Jugador 2 se une cuando quiere** | Pulsa `X` en el mapa. Sale un cartel "Player 2 has joined". |
| **Selector de personaje (estilo Fear & Hunger)** | En juegos con varios personajes, el J2 elige a quién controlar (Enki, el Bárbaro, ...). Entra al grupo en la 2.ª posición. |
| **Pantalla dividida** | Una cámara por jugador, lado a lado (o una arriba y otra abajo). `G` alterna: compartida, dividida, solo J1, solo J2. |
| **Luz para el Jugador 2** | La luz "Darkness" de Look Outside se aplica a los dos (unida en cámara compartida, una por pantalla en dividida). |
| **Combate por turnos para dos** | Las posiciones 1, 3 y 5 del grupo son del J1; la 2 y la 4 del J2. En el turno de cada personaje **solo responden las teclas de su dueño** y un cartel muestra de quién es el turno. |
| **Movimiento del J2** | Velocidad propia (copia la actual del J1 por defecto) y sprint con Shift derecho. |
| **Gancho de acción del J2** | Segundo plugin opcional: una tecla que ejecuta un evento común con la posición/dirección/actor del J2 en variables (para disparar, apuntar, interactuar...). |

## Controles

| | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover | `W A S D` | Flechas |
| Correr | Shift izquierdo | Shift derecho |
| Aceptar / interactuar | `Z` / `Espacio` | `Enter` / `Numpad 0` |
| Cancelar / menú | `X` / `Esc` | `Backspace` / `Numpad .` |
| Unirse | - | `X` (en el mapa, antes de unirse) |
| Cámara | `G` (cualquiera) | |
| Acción del J2 (opcional) | - | `Ctrl derecho` (configurable) |

## Instalación

**Fácil (Windows):**

1. Descarga el repo (Code > Download ZIP) y descomprímelo.
2. Arrastra la **carpeta del juego** (la que tiene `Game.exe` / `index.html`) encima de `install.bat`.
   O ejecuta: `powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "C:\ruta\al\juego"`

Copia los plugins a `js/plugins`, los registra en `js/plugins.js` (hace copia de seguridad `plugins.js.coop.bak`) y funciona con las carpetas `js/` y `www/js/`. Si lo vuelves a ejecutar, actualiza los archivos. `-Uninstall` lo quita todo.

**Manual:**

1. Copia `plugins/LookOutsideOnline.js` (y opcionalmente `LookOutsideOnline_Actions.js`) a `js/plugins/` del juego.
2. Agrégalos al final de `js/plugins.js` (o actívalos en el gestor de plugins de RPG Maker):
   ```js
   { "name": "LookOutsideOnline", "status": true, "description": "Local Co-op", "parameters": {} },
   { "name": "LookOutsideOnline_Actions", "status": true, "description": "Local Co-op", "parameters": {} }
   ```
   Deben quedar **después** de los plugins propios del juego.

Entra al juego, camina un poco y pulsa `X` para traer al Jugador 2.

## Parámetros (`LookOutsideOnline`)

| Parámetro | Por defecto | |
|---|---|---|
| `P2ActorMode` | auto | `auto`: clon en Look Outside, selector en el resto. `clone` / `select` fuerzan uno. |
| `P2ActorChoices` | *(todos)* | IDs de actores que el J2 puede elegir, separados por coma: `2,3,4,5`. |
| `LightPictureNames` | Darkness | Nombre(s) de la imagen que el juego usa como luz del jugador. |
| `DefaultCameraMode` | shared | `shared`, `split`, `p1`, `p2`. |
| `SplitDirection` | vertical | `vertical` = lado a lado, `horizontal` = apiladas. |
| `P2MoveSpeed` | 0 | 0 = copia la velocidad del J1, 1-6 = fija. |
| `P2DashBonus` | 1 | Velocidad extra al correr. |
| `JoinText` | Player 2 has joined | Texto del cartel. |

## Gancho de acción del J2 (`LookOutsideOnline_Actions`)

Cada juego implementa los disparos y el sprint a su manera, así que este plugin no adivina: le da un gancho al juego. Cuando el J2 pulsa la tecla de acción (por defecto `Ctrl derecho`) en el mapa:

1. Guarda la X, Y, dirección e ID de actor del J2 en las variables que elijas.
2. Ejecuta el **evento común** elegido.
3. Mantiene en ON el **interruptor** elegido mientras la tecla siga pulsada (útil para "apuntar").

Desde JavaScript: `CoopLocalActions.onP2Action((player2, actor) => { ... })`.

## Notas para Fear & Hunger (léelas)

- El plugin se escribió sin acceso a Fear & Hunger, así que el selector de personaje, los turnos de combate y la pantalla dividida **no están probados ahí**. Si algo falla, abre un issue.
- Fear & Hunger 2 tiene sprint y permite disparar armas a distancia en el mapa antes del combate. **Esa lógica es de los plugins/eventos del propio juego**: el sprint del J2 funciona con Shift derecho y copia la velocidad del J1, pero que el J2 dispare requiere apuntar el evento de disparo del juego al J2. Usa el gancho de arriba, o abre un issue con los nombres del plugin/eventos comunes de disparo del juego para conectarlo.
- El orden en combate usa la posición en el grupo, así que los aliados que reclutes se alternan entre J1 y J2.

## Límites conocidos

- El mouse y el mando no se restringen por jugador en combate.
- En pantalla dividida, las imágenes a pantalla completa (arte de cinemáticas, fundidos) se dibujan una vez sobre las dos vistas; las animaciones de eventos pueden ir un cuadro atrasadas en la segunda vista.
- La unión de luces requiere PIXI 5 (MZ). En MV la pantalla dividida igual da luz propia a cada jugador.

## Licencia

MIT. No incluye ningún recurso de ningún juego.
