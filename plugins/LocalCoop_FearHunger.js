/*:
 * @target MV MZ
 * @plugindesc Fear & Hunger 2: Termina - luz de linterna para P2 (TerraxLighting), disparo del Jugador 2 con armas de fuego y sprint. NO instalar en Look Outside. Requiere LookOutsideOnline.js (cargado antes).
 * @author TheTiranix
 *
 * @param ShootKey
 * @text Tecla de disparo de P2
 * @desc Valor de KeyboardEvent.code. En Termina el jugador 1 dispara con Shift; P2 con Shift derecho.
 * @type string
 * @default ShiftRight
 *
 * @param ShootRetryFrames
 * @text Cuadros sin disparo antes de reintentar
 * @desc Si el evento de disparo del juego no llega a disparar (sin municion, etc.), espera estos cuadros antes de volver a intentarlo mientras se mantiene la tecla.
 * @type number
 * @min 1
 * @default 20
 *
 * @help
 * Este plugin es solo para Fear & Hunger 2: Termina (y juegos que usen el mismo
 * sistema de disparo por eventos de mapa y TerraxLighting).
 *
 * Que hace
 * --------
 * 1) LUZ / VISION DE P2: el circulo de vision de los exteriores (GALV_VisibilityRange)
 *    y la luz de TerraxLighting siguen solo al Jugador 1. Este plugin da la misma
 *    luz a P2 (en camara compartida se unen las dos; en pantalla dividida cada
 *    vista usa la suya).
 *
 * 2) DISPARO DE P2: en Termina el disparo en el mapa NO es un plugin: cada mapa
 *    tiene un evento paralelo "arrow_check" que, al mantener Shift con un arma
 *    de fuego equipada, lanza el evento "arrow_player" desde la posicion del
 *    jugador. Cuando P2 mantiene su tecla de disparo (Shift derecho) con una
 *    pistola, fusil o escopeta equipada, el plugin hace que ese mismo evento
 *    "vea" a P2 (posicion, direccion, personaje y arma) durante el disparo.
 *    Usa la municion compartida del grupo y los mismos efectos del juego.
 *
 * 3) SPRINT DE P2: Shift derecho corre (copia la velocidad de P1). Igual que en
 *    el juego, con un arma de fuego equipada ese mismo Shift dispara en lugar
 *    de correr.
 */

(() => {
    'use strict';

    const coop = window.CoopLocal;
    if (!coop || !coop.registerHook) {
        console.error('LocalCoop_FearHunger: falta LookOutsideOnline.js (debe cargarse ANTES que este plugin).');
        return;
    }

    const params = PluginManager.parameters('LocalCoop_FearHunger') || {};
    const SHOOT_KEY = String(params.ShootKey || 'ShiftRight');
    const RETRY_FRAMES = Math.max(1, Number(params.ShootRetryFrames || 20));

    // Interruptores y objetos de Termina
    const SW_GUN_OK = 2251;
    const SW_RIFLE = 2252;
    const SW_SHOTGUN = 2253;
    const SW_PISTOL = 2254;
    const SW_CANNOT_USE_BOW = 410;
    const SW_ARROW = 297;        // player_arrow: el disparo esta en curso
    const SW_ARROW_FLYING = 300; // player_arrow2: la flecha/bala esta volando
    const SW_BOW_USED = 299;     // Player_whileBow_used

    // actor -> interruptor "SELECT" que usan Rifle_CHECK / Pistol_CHECK / Shotgun_CHECK
    const SELECT_SWITCH = { 1: 246, 3: 242, 4: 243, 5: 244, 15: 2402, 13: 2403, 14: 2404 };
    const GUN_WEAPONS = { rifle: [10, 11], shotgun: [12], pistol: [13] };
    const GUN_SWITCH = { rifle: SW_RIFLE, shotgun: SW_SHOTGUN, pistol: SW_PISTOL };

    // =========================================================================
    // ARMA DE FUEGO DE P2
    // =========================================================================

    function p2Actor() {
        return coop.p2Actor();
    }

    function gunTypeOf(actor) {
        if (!actor) return null;
        const ids = actor.weapons().map(w => w.id);
        for (const type of ['rifle', 'shotgun', 'pistol']) {
            if (GUN_WEAPONS[type].some(id => ids.includes(id))) return type;
        }
        return null;
    }

    // Con un arma de fuego equipada, Shift dispara en lugar de correr (igual que P1)
    coop.registerHook({
        canP2Dash() {
            return !gunTypeOf(p2Actor());
        }
    });

    // =========================================================================
    // SESION DE DISPARO: durante unos cuadros, los eventos "ven" a P2 como jugador
    // =========================================================================

    let held = false;
    let session = null;
    let cooldown = 0;

    window.addEventListener('keydown', e => {
        if (e.code === SHOOT_KEY) held = true;
    });
    window.addEventListener('keyup', e => {
        if (e.code === SHOOT_KEY) held = false;
    });

    function sw(id) {
        return $gameSwitches.value(id);
    }

    function canStartShot() {
        if (!window.$gamePlayer2 || !held || session) return false;
        if (!(SceneManager._scene instanceof Scene_Map)) return false;
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return false;
        if (sw(SW_CANNOT_USE_BOW) || sw(SW_ARROW) || sw(SW_ARROW_FLYING)) return false;
        const actor = p2Actor();
        return !!(actor && SELECT_SWITCH[actor.actorId()] && gunTypeOf(actor));
    }

    function startSession() {
        const actor = p2Actor();
        const type = gunTypeOf(actor);
        const saved = {};

        // el juego decide con que personaje y que arma se dispara mediante estos interruptores
        for (const a of Object.keys(SELECT_SWITCH)) {
            const id = SELECT_SWITCH[a];
            saved[id] = sw(id);
            $gameSwitches.setValue(id, Number(a) === actor.actorId());
        }
        for (const t of Object.keys(GUN_SWITCH)) {
            const id = GUN_SWITCH[t];
            saved[id] = sw(id);
            $gameSwitches.setValue(id, t === type);
        }
        saved[SW_GUN_OK] = sw(SW_GUN_OK);

        session = { frames: 0, sawArrow: false, saved: saved };
    }

    function endSession() {
        if (!session) return;
        for (const id of Object.keys(session.saved)) {
            $gameSwitches.setValue(Number(id), session.saved[id]);
        }
        session = null;
        cooldown = RETRY_FRAMES;
    }

    // Intercambia temporalmente a P1 con P2 (solo mientras corren los eventos del mapa)
    function swapPlayers() {
        const p1 = $gamePlayer;
        const p2 = $gamePlayer2;
        const keys = ['_x', '_y', '_realX', '_realY', '_direction'];
        const saved = {};
        keys.forEach(k => { saved[k] = p1[k]; p1[k] = p2[k]; });
        return saved;
    }

    function restorePlayers(saved) {
        Object.keys(saved).forEach(k => { $gamePlayer[k] = saved[k]; });
    }

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if (!session || !window.$gamePlayer2) {
            _Game_Map_update.call(this, sceneActive);
            return;
        }

        const savedPlayer = swapPlayers();
        const shiftBefore = Input._currentState.shift;
        Input._currentState.shift = true; // el evento comprueba "boton Shift pulsado"
        try {
            _Game_Map_update.call(this, sceneActive);
        } finally {
            if (shiftBefore === undefined) delete Input._currentState.shift;
            else Input._currentState.shift = shiftBefore;
            restorePlayers(savedPlayer);
        }

        session.frames++;
        const arrow = sw(SW_ARROW);
        if (arrow) session.sawArrow = true;
        const finished = session.sawArrow && !arrow && !sw(SW_BOW_USED);
        const noShot = !session.sawArrow && session.frames > 12;
        if (finished || noShot || session.frames > 240) endSession();
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (cooldown > 0) {
            cooldown--;
        } else if (canStartShot()) {
            startSession();
        }
    };

    // =========================================================================
    // LUZ / VISION DE P2
    // =========================================================================

    // GALV_VisibilityRange: el circulo de vision de Termina (una imagen oscura con un hueco)
    // que sigue al jugador. El plugin base une el hueco de P1 y el de P2 (camara compartida)
    // o lo recoloca para cada vista (pantalla dividida).
    coop.registerHook({
        lightSources(spriteset) {
            const v = spriteset._galvVisRange;
            if (!v) return [];
            return [{ sprite: v, pos: p => [p.screenX(), p.screenY() - 24] }];
        }
    });

    // TerraxLighting: luces de linterna/antorcha alrededor del jugador

    const terraxParams = PluginManager.parameters('TerraxLighting') || {};
    const FLASHLIGHT_OFFSET = Number(terraxParams['Flashlight offset'] || 0);
    let duplicating = false;

    function playerLightMatches(x1, y1) {
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const ex = tw / 2 + ($gamePlayer._realX - $gameMap.displayX()) * tw;
        const ey = th / 2 + ($gamePlayer._realY - $gameMap.displayY()) * th;
        return Math.abs(x1 - ex) <= 2 &&
            (Math.abs(y1 - ey) <= 2 || Math.abs(y1 - (ey - FLASHLIGHT_OFFSET)) <= 2);
    }

    function wrapGradient(name, dirIndex) {
        const orig = Bitmap.prototype[name];
        if (typeof orig !== 'function') return false;
        Bitmap.prototype[name] = function(x1, y1) {
            orig.apply(this, arguments);
            if (duplicating || !window.$gamePlayer2 || !$gameMap) return;
            if (coop.mode() === 1) return; // en pantalla dividida cada vista dibuja su propia luz
            if (SceneManager._scene && !(SceneManager._scene instanceof Scene_Map)) return;
            if (!playerLightMatches(x1, y1)) return;

            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            const args = Array.prototype.slice.call(arguments);
            args[0] = x1 + ($gamePlayer2._realX - $gamePlayer._realX) * tw;
            args[1] = y1 + ($gamePlayer2._realY - $gamePlayer._realY) * th;
            if (dirIndex !== undefined) args[dirIndex] = $gamePlayer2._direction;
            duplicating = true;
            try {
                orig.apply(this, args);
            } finally {
                duplicating = false;
            }
        };
        return true;
    }

    const hasTerrax = wrapGradient('radialgradientFillRect') && wrapGradient('radialgradientFillRect2', 6);

    // Pantalla dividida: el mapa de luz se recalcula para cada vista, con el jugador de esa vista
    let splitSwap = null;

    function patchLightmask(lm) {
        const proto = Object.getPrototypeOf(lm);
        if (proto._coopPatched) return;
        proto._coopPatched = true;
        const orig = proto.update;
        proto.update = function() {
            // en pantalla dividida solo se actualiza durante cada vista (ver splitPass)
            if (coop.mode() === 1 && window.$gamePlayer2 && !this._coopForce) return;
            orig.call(this);
        };
    }

    coop.registerHook({
        splitPass(spriteset, index, player) {
            const lm = spriteset._lightmask;
            if (!hasTerrax || !lm || typeof lm.update !== 'function') return;
            patchLightmask(lm);
            if (index === 1) splitSwap = swapPlayers();
            lm._coopForce = true;
            try {
                lm.update();
            } finally {
                lm._coopForce = false;
            }
        },
        splitPassEnd() {
            if (splitSwap) {
                restorePlayers(splitSwap);
                splitSwap = null;
            }
        }
    });

    if (!hasTerrax) {
        console.warn('LocalCoop_FearHunger: TerraxLighting no encontrado; P2 no tendra luz propia.');
    }
})();
