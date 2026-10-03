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
| **Plugin de Fear & Hunger 2** | Plugin aparte: el J2 dispara armas en el mapa, luz/visión para el J2, unión automática como miembro n.º 2. |

## Controles

| | Jugador 1 | Jugador 2 |
|---|---|---|
| Mover | `W A S D` | Flechas |
| Correr | Shift izquierdo | Shift derecho |
| Aceptar / interactuar | `Z` / `Espacio` | `Enter` / `Numpad 0` |
| Cancelar / menú | `X` / `Esc` | `Backspace` / `Numpad .` |
| Unirse | - | `X` (en el mapa, antes de unirse) |
| Cámara | `G` (cualquiera) | |

## Instalación

**Fácil (Windows):**

1. Descarga el repo (Code > Download ZIP) y descomprímelo.
2. Arrastra la **carpeta del juego** (la que tiene `Game.exe` / `index.html`) encima de `install.bat`.
   O ejecuta: `powershell -ExecutionPolicy Bypass -File install.ps1 -GamePath "C:\ruta\al\juego"`

El instalador detecta el juego (por `data/System.json`): **Look Outside** recibe solo el plugin base; **Fear & Hunger** recibe además `LocalCoop_FearHunger.js` (disparo de P2 antes del combate, luz de visión y unión automática; en Look Outside no existe). Se puede forzar con `-Profile lookoutside|fearhunger|generic`.

Copia los plugins a `js/plugins`, los registra en `js/plugins.js` (hace copia de seguridad `plugins.js.coop.bak`) y funciona con las carpetas `js/` y `www/js/`. Si lo vuelves a ejecutar, actualiza los archivos. `-Uninstall` lo quita todo.

**Manual:**

1. Copia `plugins/LookOutsideOnline.js` (y opcionalmente `LocalCoop_FearHunger.js`) a `js/plugins/` del juego.
2. Agrégalos al final de `js/plugins.js` (o actívalos en el gestor de plugins de RPG Maker):
   ```js
   { "name": "LookOutsideOnline", "status": true, "description": "Local Co-op", "parameters": {} },
   { "name": "LocalCoop_FearHunger", "status": true, "description": "Local Co-op", "parameters": {} }
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

## Fear & Hunger 2: Termina (`LocalCoop_FearHunger`)

Termina es RPG Maker **MV** con sistemas propios, así que este plugin aparte (se instala solo para Fear & Hunger, nunca en Look Outside) adapta el mod:

- **Unirse:** pulsa `X` en el mapa. Si el grupo tiene **solo al protagonista**, un menú pregunta qué personaje sumar (Levi, Marina, Daan, Abella, Marcoh, Karin, Olivia). Si el grupo **ya tiene 2 o más miembros**, el Jugador 2 pasa automáticamente a ser el **miembro n.º 2**, sin menú.
- **Personajes que abandonan el grupo:** el Jugador 2 siempre sigue a la posición n.º 2 del grupo. Si ese personaje se va, pasa a ser quien quede en esa posición (sale un cartel). Si el grupo queda solo con el protagonista, el Jugador 2 sale hasta volver a pulsar `X`. El mod nunca obliga a nadie a quedarse en el grupo, así que la historia no se toca.
- **Disparar antes del combate:** en Termina, mantener Shift con un arma de fuego equipada dispara en el mapa (cada mapa tiene un evento `arrow_check`). El Jugador 2 hace lo mismo con **Shift derecho** cuando *su* personaje tiene pistola, fusil o escopeta equipada: mientras dura el disparo, el evento del propio juego ve la posición, dirección, personaje y arma del J2. La munición es la del grupo y se usan los sprites, sonidos y proyectil del juego. Sin arma de fuego, Shift derecho es el sprint.
- **Sprint:** el J2 copia la velocidad actual del J1 (así valen los cambios de velocidad del propio juego) más el bonus de sprint.
- **Visión / luz:** el círculo de visión de la niebla (GALV_VisibilityRange) y TerraxLighting también se le dan al J2: unidos en cámara compartida, uno por vista en pantalla dividida.
- **Combate:** funciona con el sistema de batalla de Termina. Las posiciones 1, 3 y 5 del grupo son del J1 y la 2 y 4 del J2.
- **Teclas:** el J1 conserva `WASD` aunque el plugin de configuración de teclado del juego remapee teclas. El Shift derecho es exclusivo del J2.

### Estado en Fear & Hunger 2

Probado en un entorno de navegador con los datos reales del juego: unión (menú y automática), cambios de grupo, cámara compartida y dividida con el círculo de visión, turnos de combate con bloqueo de teclas y un disparo de pistola del J2 (el proyectil sale del J2, se gasta munición y se ve la pose de disparo). **No** probado en una partida completa, con fusil/escopeta, con el requisito de armadura de la Botánica, ni con todos los enemigos reaccionando a las balas del J2; si algo falla, abre un issue. Fear & Hunger 1 no está soportado por este plugin.

## Límites conocidos

- El mouse y el mando no se restringen por jugador en combate.
- En pantalla dividida, las imágenes a pantalla completa (arte de cinemáticas, fundidos) se dibujan una vez sobre las dos vistas; las animaciones de eventos pueden ir un cuadro atrasadas en la segunda vista.
- La unión de luces requiere PIXI 5 (MZ). En MV la pantalla dividida igual da luz propia a cada jugador.

## Licencia

MIT. No incluye ningún recurso de ningún juego.
