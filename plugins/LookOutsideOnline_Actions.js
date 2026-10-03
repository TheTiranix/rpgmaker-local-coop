/*:
 * @target MV MZ
 * @plugindesc Acciones extra para el Jugador 2 (ataque a distancia, sprint, interaccion propia) mediante eventos comunes. Requiere LookOutsideOnline.js.
 * @author TheTiranix
 *
 * @param ActionKey
 * @text Tecla de accion de P2
 * @desc Tecla que dispara la accion de P2. ControlRight, Numpad1, KeyM, etc. (valor de KeyboardEvent.code).
 * @type string
 * @default ControlRight
 *
 * @param ActionCommonEvent
 * @text Evento comun al pulsar
 * @desc ID del evento comun que se ejecuta al pulsar la tecla (0 = ninguno).
 * @type common_event
 * @default 0
 *
 * @param ActionSwitch
 * @text Interruptor mientras se mantiene
 * @desc ID del interruptor que queda ON mientras P2 mantiene la tecla (0 = ninguno). Sirve para "apuntar".
 * @type switch
 * @default 0
 *
 * @param P2XVariable
 * @text Variable X de P2
 * @desc Variable donde se guarda la X de P2 en el mapa al pulsar (0 = no guardar).
 * @type variable
 * @default 0
 *
 * @param P2YVariable
 * @text Variable Y de P2
 * @type variable
 * @default 0
 *
 * @param P2DirVariable
 * @text Variable de direccion de P2
 * @desc 2=abajo 4=izquierda 6=derecha 8=arriba
 * @type variable
 * @default 0
 *
 * @param P2ActorVariable
 * @text Variable con el ID del actor de P2
 * @type variable
 * @default 0
 *
 * @help
 * Este plugin NO adivina como cada juego implementa sus disparos o su sprint:
 * te da un enlace para que un evento comun del juego los ejecute con los
 * datos de P2.
 *
 * Al pulsar la tecla de accion de P2 (y solo si P2 esta en el mapa, sin
 * dialogos ni eventos corriendo):
 *   1. Guarda X, Y, direccion y ID de actor de P2 en las variables elegidas.
 *   2. Reserva el evento comun elegido.
 *   3. Mantiene ON el interruptor elegido mientras la tecla siga pulsada.
 *
 * API de JavaScript (para otros plugins):
 *   window.CoopLocalActions.onP2Action(fn)   -> fn(player2, actor) al pulsar
 *   window.CoopLocalActions.isHeld()         -> true mientras se mantiene
 *
 * El sprint de P2 (Shift derecho) y su velocidad ya vienen en
 * LookOutsideOnline.js (copia la velocidad de P1 + bonus configurable).
 */

(() => {
    const params = PluginManager.parameters('LookOutsideOnline_Actions') || {};
    const KEY = String(params.ActionKey || 'ControlRight');
    const CE = Number(params.ActionCommonEvent || 0);
    const SWITCH = Number(params.ActionSwitch || 0);
    const VAR_X = Number(params.P2XVariable || 0);
    const VAR_Y = Number(params.P2YVariable || 0);
    const VAR_DIR = Number(params.P2DirVariable || 0);
    const VAR_ACTOR = Number(params.P2ActorVariable || 0);

    let held = false;
    const listeners = [];

    function canAct() {
        return typeof SceneManager !== 'undefined' &&
            SceneManager._scene instanceof Scene_Map &&
            window.$gamePlayer2 && !$gameMap.isEventRunning() && !$gameMessage.isBusy();
    }

    function fire() {
        const p2 = window.$gamePlayer2;
        const actor = $gameSystem._coopP2ActorId ? $gameActors.actor($gameSystem._coopP2ActorId) : $gameParty.members()[1];
        if (VAR_X) $gameVariables.setValue(VAR_X, p2.x);
        if (VAR_Y) $gameVariables.setValue(VAR_Y, p2.y);
        if (VAR_DIR) $gameVariables.setValue(VAR_DIR, p2.direction());
        if (VAR_ACTOR && actor) $gameVariables.setValue(VAR_ACTOR, actor.actorId());
        if (CE > 0) $gameTemp.reserveCommonEvent(CE);
        for (const fn of listeners) {
            try { fn(p2, actor); } catch (e) { console.error(e); }
        }
    }

    window.addEventListener('keydown', e => {
        if (e.code !== KEY || e.repeat) return;
        if (!canAct()) return;
        held = true;
        if (SWITCH) $gameSwitches.setValue(SWITCH, true);
        fire();
    });

    window.addEventListener('keyup', e => {
        if (e.code !== KEY) return;
        held = false;
        if (SWITCH && typeof $gameSwitches !== 'undefined' && $gameSwitches) $gameSwitches.setValue(SWITCH, false);
    });

    window.CoopLocalActions = {
        onP2Action(fn) { listeners.push(fn); },
        isHeld() { return held; }
    };
})();
