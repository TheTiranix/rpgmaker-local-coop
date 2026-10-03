/*:
 * @target MV MZ
 * @plugindesc Co-op local P1/P2 en el mismo teclado: pantalla dividida, luz para P2, turnos de batalla por jugador, selector de personaje. Pensado para Look Outside, Fear & Hunger y otros juegos de RPG Maker.
 * @author TheTiranix
 *
 * @param P2ActorMode
 * @text Modo de personaje de P2
 * @desc auto = clone en Look Outside y selector en cualquier otro juego. clone = P2 copia el aspecto de P1. select = P2 elige un personaje.
 * @type select
 * @option auto
 * @option clone
 * @option select
 * @default auto
 *
 * @param P2ActorChoices
 * @text Personajes elegibles
 * @desc IDs de actores separados por coma que P2 puede elegir (ej: 2,3,4,5). Vacio = todos los actores con nombre e imagen.
 * @type string
 * @default
 *
 * @param LightPictureNames
 * @text Imagenes de luz
 * @desc Nombres (separados por coma) de las imagenes que el juego usa como "luz del jugador" (circulo transparente sobre fondo oscuro).
 * @type string
 * @default Darkness
 *
 * @param DefaultCameraMode
 * @text Camara inicial
 * @type select
 * @option shared
 * @option split
 * @option p1
 * @option p2
 * @default shared
 *
 * @param SplitDirection
 * @text Direccion de la pantalla dividida
 * @desc vertical = una pantalla a cada lado. horizontal = una arriba y otra abajo.
 * @type select
 * @option vertical
 * @option horizontal
 * @default vertical
 *
 * @param P2MoveSpeed
 * @text Velocidad de P2
 * @desc 0 = P2 copia la velocidad actual de P1 (recomendado: hereda sprints/ralentizaciones del juego). 1-6 = velocidad fija.
 * @type number
 * @min 0
 * @max 6
 * @default 0
 *
 * @param P2DashBonus
 * @text Bonus al correr (P2)
 * @desc Velocidad extra de P2 mientras mantiene Shift derecho.
 * @type number
 * @min 0
 * @max 3
 * @default 1
 *
 * @param JoinText
 * @text Cartel de union
 * @type string
 * @default Player 2 has joined
 *
 * @help
 * =========================================================
 *  CONTROLES
 * =========================================================
 *  P1:
 *    WASD                = Movimiento
 *    Shift Izquierdo     = Correr
 *    Z / Espacio         = Aceptar / Interactuar
 *    X / Esc             = Cancelar / Menu
 *
 *  P2:
 *    Flechas             = Movimiento
 *    Shift Derecho       = Correr
 *    Enter / Numpad 0    = Aceptar / Interactuar
 *    Backspace / Numpad . = Cancelar
 *    X                   = Unirse a la partida (mientras P2 no se unio)
 *
 *  CAMARA:
 *    G                   = Compartida -> Pantalla dividida -> Solo P1 -> Solo P2
 *
 * =========================================================
 *  BATALLAS
 * =========================================================
 *  Los miembros del grupo se reparten por posicion:
 *    1.o, 3.o y 5.o  -> Jugador 1
 *    2.o y 4.o       -> Jugador 2
 *  Cuando le toca elegir a un personaje, SOLO responden las teclas de su
 *  dueno, y un cartel arriba indica de quien es el turno.
 *
 * =========================================================
 *  OTROS JUEGOS (Fear & Hunger, etc.)
 * =========================================================
 *  Con P2ActorMode = select (o auto en cualquier juego que no sea Look
 *  Outside), al unirse P2 aparece un menu para elegir que personaje
 *  quiere controlar. Ese personaje se agrega al grupo en la 2.a posicion.
 *
 *  La luz de P2 funciona con el sistema de "imagen de luz" de Look Outside
 *  (ver parametro LightPictureNames). Otros sistemas de iluminacion pueden
 *  requerir adaptacion.
 *
 * =========================================================
 *  LOOK OUTSIDE
 * =========================================================
 *  Menu de pausa: "Dios Conocimiento ($1000)" desbloquea el 5.o integrante.
 */

(() => {

    const PLUGIN_NAME = 'LookOutsideOnline';
    const params = PluginManager.parameters(PLUGIN_NAME) || {};
    const IS_MZ = (typeof Utils !== 'undefined') && Utils.RPGMAKER_NAME === 'MZ';

    const P2_ACTOR_MODE = String(params.P2ActorMode || 'auto');
    const P2_ACTOR_CHOICES = String(params.P2ActorChoices || '')
        .split(',').map(s => Number(s.trim())).filter(n => n > 0);
    const LIGHT_NAMES = String(params.LightPictureNames || 'Darkness')
        .split(',').map(s => s.trim()).filter(s => s.length > 0);
    const SPLIT_VERTICAL = String(params.SplitDirection || 'vertical') !== 'horizontal';
    const JOIN_TEXT = String(params.JoinText || 'Player 2 has joined');

    const CAM_SHARED = 0;
    const CAM_SPLIT = 1;
    const CAM_P1 = 2;
    const CAM_P2 = 3;
    const CAM_NAMES = ['Shared camera', 'Split screen', 'Player 1 camera', 'Player 2 camera'];
    const CAM_BY_NAME = { shared: CAM_SHARED, split: CAM_SPLIT, p1: CAM_P1, p2: CAM_P2 };

    const COLOR_P1 = '#4aa3ff';
    const COLOR_P2 = '#ff6a5c';

    const P2_FIXED_SPEED = Number(params.P2MoveSpeed || 0);
    const P2_RUN_BONUS = (params.P2DashBonus === undefined || params.P2DashBonus === '') ? 1 : Number(params.P2DashBonus);

    const KEY_JOIN = 88;   // X
    const KEY_CAMERA = 71; // G

    window.$gamePlayer2 = null;

    let cameraMode = CAM_BY_NAME[String(params.DefaultCameraMode || 'shared')];
    if (cameraMode === undefined) cameraMode = CAM_SHARED;

    const CoopState = {
        selecting: false,   // menu de seleccion de personaje de P2 abierto
        lastOwner: 0
    };

    const keysP2 = {
        left: false, right: false, up: false, down: false,
        shift: false, ok: false, join: false
    };

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    function gameTitle() {
        return (typeof $dataSystem !== 'undefined' && $dataSystem && $dataSystem.gameTitle) || '';
    }

    function isLookOutside() {
        return /look\s*outside/i.test(gameTitle());
    }

    function coopMode() {
        if (P2_ACTOR_MODE === 'clone' || P2_ACTOR_MODE === 'select') return P2_ACTOR_MODE;
        return isLookOutside() ? 'clone' : 'select';
    }

    function rectArgs(x, y, w, h) {
        return IS_MZ ? [new Rectangle(x, y, w, h)] : [x, y, w, h];
    }

    function mainFont() {
        return (typeof $gameSystem !== 'undefined' && $gameSystem && $gameSystem.mainFontFace)
            ? $gameSystem.mainFontFace() : 'sans-serif';
    }

    function getRenderer() {
        if (Graphics.app && Graphics.app.renderer) return Graphics.app.renderer;
        if (Graphics._renderer && Graphics._renderer.gl) return Graphics._renderer;
        return null;
    }

    function pixiIs5() {
        return typeof PIXI !== 'undefined' && String(PIXI.VERSION).charAt(0) >= '5';
    }

    function makeRenderTexture(w, h) {
        return pixiIs5()
            ? PIXI.RenderTexture.create({ width: w, height: h })
            : PIXI.RenderTexture.create(w, h);
    }

    // Modo de mezcla "DST_IN" (resultado = destino x alfa del origen) para unir huecos de luz.
    // Pixi 5 lo trae; en Pixi 4 (RPG Maker MV) se registra uno propio.
    const CUSTOM_DST_IN = 40;
    function dstInMode() {
        const r = getRenderer();
        if (!r || !r.gl) return null;
        if (pixiIs5()) {
            return (PIXI.BLEND_MODES && PIXI.BLEND_MODES.DST_IN !== undefined) ? PIXI.BLEND_MODES.DST_IN : null;
        }
        const table = PIXI.utils && PIXI.utils.premultiplyBlendMode;
        if (!r.state || !r.state.blendModes || !table) return null;
        if (!r.state.blendModes[CUSTOM_DST_IN]) {
            r.state.blendModes[CUSTOM_DST_IN] = [r.gl.ZERO, r.gl.SRC_ALPHA];
            table[0][CUSTOM_DST_IN] = CUSTOM_DST_IN;
            table[1][CUSTOM_DST_IN] = CUSTOM_DST_IN;
        }
        return CUSTOM_DST_IN;
    }

    function canUnionLights() {
        return dstInMode() !== null;
    }

    function canSplit() {
        return !!getRenderer() && typeof PIXI !== 'undefined' && !!PIXI.RenderTexture;
    }

    function inScene(klass) {
        return typeof klass !== 'undefined' && SceneManager._scene instanceof klass;
    }

    function messageBusy() {
        return typeof $gameMessage !== 'undefined' && $gameMessage && $gameMessage.isBusy();
    }

    // =========================================================================
    // DUENO DE CADA PERSONAJE EN BATALLA
    // Posiciones 1,3,5 -> P1 ; 2,4 -> P2
    // =========================================================================

    function battleOwnerOf(actor) {
        const idx = $gameParty.members().indexOf(actor);
        if (idx < 0) return 1;
        return (idx % 2 === 0) ? 1 : 2;
    }

    // Quien tiene el control del teclado en este momento: 0 = nadie en particular
    function coopInputOwner() {
        if (CoopState.selecting) return 2;
        if (!$gamePlayer2) return 0;
        if (inScene(Scene_Battle) && BattleManager.isInputting()) {
            const actor = BattleManager.actor();
            return actor ? battleOwnerOf(actor) : 1;
        }
        return 0;
    }

    // =========================================================================
    // CONTROLES
    // =========================================================================

    Input.keyMapper[87] = 'up';       // W
    Input.keyMapper[83] = 'down';     // S
    Input.keyMapper[65] = 'left';     // A
    Input.keyMapper[68] = 'right';    // D

    const P2_KEY_MAP = {
        37: 'left', 38: 'up', 39: 'right', 40: 'down',
        13: 'ok', 96: 'ok',
        8: 'escape', 110: 'escape'
    };

    // Devuelve el mapa de teclas valido para cada contexto (sin tocar el original)
    function buildMapper(base, owner) {
        if (owner === 2) return Object.assign({}, P2_KEY_MAP);
        const m = Object.assign({}, base);
        delete m[37]; delete m[38]; delete m[39]; delete m[40];
        delete m[96];
        // P1 siempre tiene WASD (algunos juegos reescriben el mapa de teclas, p.ej. YEP_KeyboardConfig)
        m[87] = 'up'; m[65] = 'left'; m[83] = 'down'; m[68] = 'right';
        if (owner === 1 || (inScene(Scene_Map) && !messageBusy())) delete m[13];
        return m;
    }

    function withMapper(input, fn) {
        const base = input.keyMapper;
        if (!$gamePlayer2 && !CoopState.selecting) {
            fn();
            return;
        }
        input.keyMapper = buildMapper(base, coopInputOwner());
        try {
            fn();
        } finally {
            input.keyMapper = base;
        }
    }

    function isMapIdle() {
        return inScene(Scene_Map) && $gamePlayer && !$gameMap.isEventRunning() &&
            !messageBusy() && !CoopState.selecting && !!$gameParty.leader();
    }

    // El Shift derecho es de P2: P1 solo reacciona al izquierdo (en Termina Shift tambien dispara)
    function isRightShift(e) {
        return e.keyCode === 16 && (e.location === 2 || e.code === 'ShiftRight');
    }

    const _Input_onKeyDown = Input._onKeyDown;
    Input._onKeyDown = function(event) {
        if ($gamePlayer2 && isRightShift(event)) return;
        // X en el mapa antes de que P2 se una = unirse (no abre el menu)
        if (!$gamePlayer2 && event.keyCode === KEY_JOIN && isMapIdle()) {
            return;
        }
        withMapper(this, () => _Input_onKeyDown.call(this, event));
    };

    const _Input_onKeyUp = Input._onKeyUp;
    Input._onKeyUp = function(event) {
        if ($gamePlayer2 && isRightShift(event)) return;
        _Input_onKeyUp.call(this, event);
        if ($gamePlayer2 || CoopState.selecting) {
            // soltar la tecla en todos los contextos para que nunca quede "pegada"
            const base = this.keyMapper;
            for (const owner of [1, 2]) {
                this.keyMapper = buildMapper(base, owner);
                try {
                    _Input_onKeyUp.call(this, event);
                } finally {
                    this.keyMapper = base;
                }
            }
        }
    };

    const _Input_update = Input.update;
    Input.update = function() {
        if ($gamePlayer2 || CoopState.selecting) {
            const owner = coopInputOwner();
            if (owner !== CoopState.lastOwner) {
                CoopState.lastOwner = owner;
                this.clear();
            }
        } else {
            CoopState.lastOwner = 0;
        }
        _Input_update.call(this);
    };

    // =========================================================================
    // TECLAS DE P2 Y CAMARA
    // =========================================================================

    window.addEventListener('keydown', function(e) {
        const onMap = inScene(Scene_Map);

        switch (e.keyCode) {
            case KEY_CAMERA:
                if (!e.repeat && $gamePlayer2) {
                    CoopView.cycleCamera();
                }
                break;
            case KEY_JOIN:
                if (onMap) keysP2.join = true;
                break;
            case 37: keysP2.left = true; break;
            case 38: keysP2.up = true; break;
            case 39: keysP2.right = true; break;
            case 40: keysP2.down = true; break;
            case 13:
            case 96:
                if (onMap) keysP2.ok = true;
                break;
        }

        if (e.code === 'ShiftRight' || (e.keyCode === 16 && e.location === 2)) {
            keysP2.shift = true;
        }
    });

    window.addEventListener('keyup', function(e) {
        switch (e.keyCode) {
            case KEY_JOIN: keysP2.join = false; break;
            case 37: keysP2.left = false; break;
            case 38: keysP2.up = false; break;
            case 39: keysP2.right = false; break;
            case 40: keysP2.down = false; break;
            case 13:
            case 96:
                keysP2.ok = false;
                break;
        }

        if (e.code === 'ShiftRight' || (e.keyCode === 16 && e.location === 2)) {
            keysP2.shift = false;
        }
    });

    // =========================================================================
    // CARTELES (union de P2, camara, etc.)
    // =========================================================================

    function drawBox(bitmap, w, h, color, alpha) {
        bitmap.fillRect(0, 0, w, h, 'rgba(0,0,0,' + (alpha === undefined ? 0.80 : alpha) + ')');
        bitmap.fillRect(0, 0, 6, h, color);
        bitmap.fillRect(0, 0, w, 2, color);
        bitmap.fillRect(0, h - 2, w, 2, color);
    }

    function Sprite_CoopBanner() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CoopBanner.prototype = Object.create(Sprite.prototype);
    Sprite_CoopBanner.prototype.constructor = Sprite_CoopBanner;

    Sprite_CoopBanner.prototype.initialize = function(title, sub, color, duration) {
        Sprite.prototype.initialize.call(this);
        const w = Math.min(Graphics.width - 40, 560);
        const h = sub ? 92 : 62;
        const bitmap = new Bitmap(w, h);
        drawBox(bitmap, w, h, color);
        bitmap.fontFace = mainFont();
        bitmap.textColor = '#ffffff';
        bitmap.outlineColor = 'rgba(0,0,0,0.9)';
        bitmap.outlineWidth = 4;
        bitmap.fontSize = 30;
        bitmap.drawText(title, 18, sub ? 6 : 0, w - 30, sub ? 50 : h, 'center');
        if (sub) {
            bitmap.fontSize = 20;
            bitmap.textColor = '#d8d8d8';
            bitmap.drawText(sub, 18, 50, w - 30, 34, 'center');
        }
        this.bitmap = bitmap;
        this.anchor.x = 0.5;
        this.anchor.y = 0;
        this.x = Graphics.width / 2;
        this._bannerH = h;
        this._targetY = 20;
        this._life = 0;
        this._duration = duration || 160;
        this.y = -h;
    };

    Sprite_CoopBanner.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this._life++;
        const slide = 18;
        const fade = 30;
        if (this._life <= slide) {
            const t = this._life / slide;
            this.y = -this._bannerH + (this._targetY + this._bannerH) * (1 - Math.pow(1 - t, 3));
        } else {
            this.y = this._targetY;
        }
        if (this._life > this._duration - fade) {
            this.opacity = Math.max(0, 255 * (this._duration - this._life) / fade);
        }
        if (this._life >= this._duration) {
            if (this.parent) this.parent.removeChild(this);
            if (this.bitmap && this.bitmap.destroy) this.bitmap.destroy();
            this.bitmap = null;
        }
    };

    const CoopUI = {
        banner(title, sub, color, duration) {
            const scene = SceneManager._scene;
            if (!scene) return;
            // un solo cartel a la vez: reemplaza al anterior
            if (scene._coopBanner && scene._coopBanner.parent) {
                scene._coopBanner.parent.removeChild(scene._coopBanner);
                if (scene._coopBanner.destroy) scene._coopBanner.destroy();
            }
            scene._coopBanner = new Sprite_CoopBanner(title, sub, color || COLOR_P2, duration);
            scene.addChild(scene._coopBanner);
        }
    };

    // =========================================================================
    // CARTEL PERMANENTE DE TURNO EN BATALLA
    // =========================================================================

    function Sprite_CoopTurn() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CoopTurn.prototype = Object.create(Sprite.prototype);
    Sprite_CoopTurn.prototype.constructor = Sprite_CoopTurn;

    Sprite_CoopTurn.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this._w = 250;
        this._h = 30;
        this.bitmap = new Bitmap(this._w, this._h);
        this.anchor.x = 0.5;
        this.x = Graphics.width / 2;
        this.y = 4;
        this._key = '';
        this._pulse = 0;
        this.opacity = 0;
    };

    Sprite_CoopTurn.prototype.currentInfo = function() {
        if (!$gamePlayer2 || !inScene(Scene_Battle) || !BattleManager.isInputting()) return null;
        const actor = BattleManager.actor();
        const owner = actor ? battleOwnerOf(actor) : 1;
        return { owner: owner, name: actor ? actor.name() : 'Party' };
    };

    Sprite_CoopTurn.prototype.redraw = function(info) {
        const bmp = this.bitmap;
        bmp.clear();
        const color = info.owner === 1 ? COLOR_P1 : COLOR_P2;
        drawBox(bmp, this._w, this._h, color, 0.45);
        bmp.fontFace = mainFont();
        bmp.outlineColor = 'rgba(0,0,0,0.8)';
        bmp.outlineWidth = 3;
        bmp.textColor = '#ffffff';
        bmp.fontSize = 18;
        bmp.drawText('P' + info.owner + ' TURN - ' + info.name, 10, 0, this._w - 16, this._h, 'center');
    };

    Sprite_CoopTurn.prototype.update = function() {
        Sprite.prototype.update.call(this);
        const info = this.currentInfo();
        if (!info) {
            this._key = '';
            this.opacity = Math.max(0, this.opacity - 40);
            return;
        }
        const key = info.owner + ':' + info.name;
        if (key !== this._key) {
            this._key = key;
            this._pulse = 0;
            this.redraw(info);
        }
        this._pulse++;
        this.opacity = Math.min(215, this.opacity + 40);
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this._coopTurnSprite = new Sprite_CoopTurn();
        this.addChild(this._coopTurnSprite);
    };

    // =========================================================================
    // CAPACIDAD DEL GRUPO Y 5.o INTEGRANTE (SOLO LOOK OUTSIDE)
    // =========================================================================

    const _Game_Party_maxBattleMembers = Game_Party.prototype.maxBattleMembers;
    Game_Party.prototype.maxBattleMembers = function() {
        if ($gameSystem && $gameSystem._unlockedFifthMember) {
            return 5;
        }
        return _Game_Party_maxBattleMembers ? _Game_Party_maxBattleMembers.call(this) : 4;
    };

    function partyCapacity() {
        return ($gameSystem && $gameSystem._unlockedFifthMember) ? 5 : $gameParty.maxBattleMembers();
    }

    Game_Party.prototype.isFull = function() {
        return this._actors.length >= partyCapacity();
    };

    const _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        if (!this._actors.includes(actorId)) {
            if (this._actors.length < partyCapacity()) {
                this._actors.push(actorId);
                $gamePlayer.refresh();
                $gameMap.requestRefresh();
            }
        }
    };

    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);

        if (!isLookOutside()) return;
        if (this._list.some(cmd => cmd.symbol === 'godOfKnowledge')) return;

        const isUnlocked = ($gameSystem && $gameSystem._unlockedFifthMember);
        const text = isUnlocked ? "5° Miembro Activado" : "Dios Conocimiento ($1000)";
        this.addCommand(text, 'godOfKnowledge', !isUnlocked);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('godOfKnowledge', this.commandGodOfKnowledge.bind(this));
    };

    Scene_Menu.prototype.commandGodOfKnowledge = function() {
        if ($gameSystem._unlockedFifthMember) {
            this._commandWindow.activate();
            return;
        }

        const COST = 1000;

        if ($gameParty.gold() >= COST) {
            $gameParty.loseGold(COST);
            $gameSystem._unlockedFifthMember = true;

            $gameMessage.add("\\clDios del Conocimiento:\\cl");
            $gameMessage.add("Has pagado $1000 de oro al Dios del Conocimiento.");
            $gameMessage.add("Ahora tu grupo puede llevar hasta 5 miembros en combate.");

            if (typeof SoundManager !== 'undefined') {
                SoundManager.playShop();
            }
        } else {
            $gameMessage.add("\\clDios del Conocimiento:\\cl");
            $gameMessage.add("No tienes suficiente dinero ($1000 de oro).");
            $gameMessage.add("Vuelve cuando tengas el tributo necesario.");

            if (typeof SoundManager !== 'undefined') {
                SoundManager.playBuzzer();
            }
        }

        this.popScene();
        if (SceneManager._scene instanceof Scene_Map) {
            SceneManager._scene._messageWindow.startMessage();
        }
    };

    // =========================================================================
    // OCULTAR FOLLOWERS
    // =========================================================================

    if (typeof Game_Followers !== 'undefined') {
        const _Game_Followers_isVisible = Game_Followers.prototype.isVisible;
        Game_Followers.prototype.isVisible = function() {
            if ($gamePlayer2) return false;
            return _Game_Followers_isVisible.call(this);
        };
    } else if (typeof Game_Player !== 'undefined' && Game_Player.prototype.showFollowers) {
        const _Game_Player_showFollowers = Game_Player.prototype.showFollowers;
        Game_Player.prototype.showFollowers = function() {
            if ($gamePlayer2) return false;
            return _Game_Player_showFollowers.call(this);
        };
    }

    // =========================================================================
    // PERSONAJE DE P2
    // =========================================================================

    // Look Outside: P2 usa el actor 1/2 (el que no sea P1) copiando el aspecto de P1
    // (no usa $gameParty.leader() a proposito: eso instancia actores y se llamaria a si mismo
    //  mientras se construye uno nuevo)
    function isP2Actor(actor) {
        if (!actor || typeof $gameParty === 'undefined' || !$gameParty || !$dataSystem) return false;
        if (coopMode() !== 'clone') return false;
        const leaderId = $gameParty._actors[0];
        if (!leaderId) return false;
        const p2Id = (leaderId === 2) ? 1 : 2;
        return actor._actorId === p2Id;
    }

    // P2 siempre ocupa el 2.o lugar del grupo: asi 1,3,5 = P1 y 2,4 = P2
    function moveToSecondSlot(actorId) {
        const arr = $gameParty._actors;
        const i = arr.indexOf(actorId);
        if (i < 0) return;
        arr.splice(i, 1);
        arr.splice(Math.min(1, arr.length), 0, actorId);
        $gamePlayer.refresh();
        $gameMap.requestRefresh();
    }

    function setupPersistentP2Actor() {
        const p1 = $gameParty.leader();
        if (!p1) return null;

        const p2ActorId = (p1.actorId() === 2) ? 1 : 2;
        const p2 = $gameActors.actor(p2ActorId);

        if (!$gameParty._actors.includes(p2ActorId)) {
            p2.setCharacterImage(p1.characterName(), p1.characterIndex());
            p2.setFaceImage(p1.faceName(), p1.faceIndex());
            p2.setBattlerImage(p1.battlerName());
            p2.changeClass(p1._classId, false);
            p2._equipLocks = [];

            const p1Equips = p1.equips();
            for (let i = 0; i < p1Equips.length; i++) {
                if (p1Equips[i]) {
                    p2.changeEquip(i, p1Equips[i]);
                }
            }

            p2._skills = [];
            const p1Skills = p1.skills();
            for (let i = 0; i < p1Skills.length; i++) {
                p2.learnSkill(p1Skills[i].id);
            }

            p2.changeExp(p1.currentExp(), false);
            p2._hp = p1.hp;
            p2._mp = p1.mp;
            p2.setName(p1.name() + " (P2)");

            $gameParty.addActor(p2ActorId);
        }

        if (p2) {
            p2._equipLocks = [];
        }
        moveToSecondSlot(p2ActorId);
        $gameSystem._coopP2ActorId = p2ActorId;
        return p2;
    }

    // Juegos con varios personajes (Fear & Hunger): P2 elige uno
    function setupSelectedP2Actor(actorId) {
        const actor = $gameActors.actor(actorId);
        if (!actor) return null;
        if (!$gameParty._actors.includes(actorId)) {
            $gameParty.addActor(actorId);
            if (!$gameParty._actors.includes(actorId)) return null; // grupo lleno
        }
        moveToSecondSlot(actorId);
        $gameSystem._coopP2ActorId = actorId;
        return actor;
    }

    // Lista para el selector. Usa los datos de la base sin crear actores nuevos en la partida.
    // Fear & Hunger 2: Termina - los 7 personajes con "SELECT" propio en el juego
    const TERMINA_PLAYABLE = [1, 3, 4, 5, 13, 14, 15];

    function selectableActors() {
        const leader = $gameParty.leader();
        const leaderId = leader ? leader.actorId() : 0;
        const choices = (P2_ACTOR_CHOICES.length === 0 && /termina/i.test(gameTitle()))
            ? TERMINA_PLAYABLE : P2_ACTOR_CHOICES;
        const ids = choices.length > 0
            ? choices
            : $dataActors.map((a, i) => (a && a.name && a.characterName) ? i : 0).filter(i => i > 0);
        return ids
            .filter(id => id !== leaderId && $dataActors[id])
            .map(id => {
                const data = $dataActors[id];
                const live = $gameActors._data[id];
                const classId = live ? live._classId : data.classId;
                return {
                    id: id,
                    name: live ? live.name() : data.name,
                    characterName: live ? live.characterName() : data.characterName,
                    characterIndex: live ? live.characterIndex() : data.characterIndex,
                    className: $dataClasses[classId] ? $dataClasses[classId].name : '',
                    level: live ? live.level : data.initialLevel,
                    inParty: $gameParty._actors.includes(id)
                };
            });
    }

    // Equipamiento sin restricciones para el P2 clonado (Look Outside)
    const _Game_Actor_canEquip = Game_Actor.prototype.canEquip;
    Game_Actor.prototype.canEquip = function(item) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_canEquip ? _Game_Actor_canEquip.call(this, item) : true;
    };

    const _Game_Actor_isWeaponProficient = Game_Actor.prototype.isWeaponProficient;
    Game_Actor.prototype.isWeaponProficient = function(wtypeId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isWeaponProficient ? _Game_Actor_isWeaponProficient.call(this, wtypeId) : true;
    };

    const _Game_Actor_isArmorProficient = Game_Actor.prototype.isArmorProficient;
    Game_Actor.prototype.isArmorProficient = function(atypeId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isArmorProficient ? _Game_Actor_isArmorProficient.call(this, atypeId) : true;
    };

    const _Game_Actor_isEquipChangeOk = Game_Actor.prototype.isEquipChangeOk;
    Game_Actor.prototype.isEquipChangeOk = function(slotId) {
        if (isP2Actor(this)) return true;
        return _Game_Actor_isEquipChangeOk ? _Game_Actor_isEquipChangeOk.call(this, slotId) : true;
    };

    const _Game_Actor_equipSlots = Game_Actor.prototype.equipSlots;
    Game_Actor.prototype.equipSlots = function() {
        if (isP2Actor(this)) {
            const p1 = $gameActors._data[$gameParty._actors[0]];
            if (p1 && p1 !== this) return p1.equipSlots();
        }
        return _Game_Actor_equipSlots.call(this);
    };

    const _Window_EquipItem_includes = Window_EquipItem.prototype.includes;
    Window_EquipItem.prototype.includes = function(item) {
        if (this._actor && isP2Actor(this._actor)) {
            if (item === null) return true;
            if (this._slotId < 0) return false;
            const equipSlots = this._actor.equipSlots();
            return item.etypeId === equipSlots[this._slotId];
        }
        return _Window_EquipItem_includes.call(this, item);
    };

    const _Window_EquipItem_isEnabled = Window_EquipItem.prototype.isEnabled;
    Window_EquipItem.prototype.isEnabled = function(item) {
        if (this._actor && isP2Actor(this._actor)) return true;
        return _Window_EquipItem_isEnabled ? _Window_EquipItem_isEnabled.call(this, item) : true;
    };

    // =========================================================================
    // MENU DE SELECCION DE PERSONAJE PARA P2
    // =========================================================================

    function Window_CoopTitle() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopTitle.prototype = Object.create(Window_Base.prototype);
    Window_CoopTitle.prototype.constructor = Window_CoopTitle;

    Window_CoopTitle.prototype.initialize = function(x, y, w, h) {
        Window_Base.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
    };

    Window_CoopTitle.prototype.refresh = function() {
        this.contents.clear();
        const w = this.contents.width;
        this.contents.fontSize = 26;
        this.contents.textColor = COLOR_P2;
        this.contents.drawText('PLAYER 2 - Choose your character', 0, 0, w, 36, 'center');
        this.contents.fontSize = 18;
        this.contents.textColor = '#cfcfcf';
        this.contents.drawText('Arrow keys: move    Enter: select    Backspace: cancel', 0, 38, w, 26, 'center');
    };

    function Window_CoopActorSelect() {
        this.initialize.apply(this, arguments);
    }

    Window_CoopActorSelect.prototype = Object.create(Window_Selectable.prototype);
    Window_CoopActorSelect.prototype.constructor = Window_CoopActorSelect;
    Window_CoopActorSelect.prototype._coopActors = [];

    Window_CoopActorSelect.prototype.initialize = function(x, y, w, h, actors) {
        this._coopActors = actors;
        this._coopBitmaps = actors.map(a => ImageManager.loadCharacter(a.characterName));
        this._coopPending = true;
        Window_Selectable.prototype.initialize.apply(this, rectArgs(x, y, w, h));
        this.refresh();
        this.select(0);
        this.activate();
    };

    // los sprites cargan en segundo plano: redibuja cuando esten listos
    Window_CoopActorSelect.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        if (this._coopPending && this._coopBitmaps.every(b => b.isReady())) {
            this._coopPending = false;
            this.refresh();
        }
    };

    Window_CoopActorSelect.prototype.maxItems = function() {
        return this._coopActors.length;
    };

    Window_CoopActorSelect.prototype.itemHeight = function() {
        return 64;
    };

    Window_CoopActorSelect.prototype.actor = function() {
        return this._coopActors[this.index()] || null;
    };

    Window_CoopActorSelect.prototype.drawItem = function(index) {
        const actor = this._coopActors[index];
        if (!actor) return;
        const rect = this.itemRect(index);
        const pad = this.itemPadding ? this.itemPadding() : this.textPadding();
        const x = rect.x + pad;
        this.drawCharacter(actor.characterName, actor.characterIndex, x + 24, rect.y + 56);
        this.drawText(actor.name, x + 64, rect.y + 14, rect.width - 64 - pad * 2 - 200, 'left');
        this.drawText((actor.className ? actor.className + '  ' : '') + 'Lv' + actor.level +
            (actor.inParty ? '  (in party)' : ''), rect.x + rect.width - pad - 260, rect.y + 14, 260, 'right');
    };

    // =========================================================================
    // GAME_PLAYER2
    // =========================================================================

    function Game_Player2() {
        this.initialize.apply(this, arguments);
    }

    Game_Player2.prototype = Object.create(Game_Character.prototype);
    Game_Player2.prototype.constructor = Game_Player2;

    Game_Player2.prototype.initialize = function() {
        Game_Character.prototype.initialize.call(this);
        this.setPriorityType(1);
        this._moveSpeed = 4;
    };

    // Velocidad base: la de P1 (si el juego acelera/frena a P1, P2 acompana) o la fija del parametro
    Game_Player2.prototype.moveSpeed = function() {
        if (P2_FIXED_SPEED > 0) return P2_FIXED_SPEED;
        return $gamePlayer ? $gamePlayer._moveSpeed : this._moveSpeed;
    };

    Game_Player2.prototype.isDashing = function() {
        if (!keysP2.shift) return false;
        return coopHooks.every(h => !h.canP2Dash || h.canP2Dash());
    };

    Game_Player2.prototype.realMoveSpeed = function() {
        if (this.isDashing()) {
            return this.moveSpeed() + P2_RUN_BONUS;
        }
        return this.moveSpeed();
    };

    Game_Player2.prototype.distancePerFrame = function() {
        return Math.pow(2, this.realMoveSpeed()) / 256;
    };

    // P2 no se mueve durante dialogos, eventos ni menus de seleccion
    Game_Player2.prototype.canMoveP2 = function() {
        return !$gameMap.isEventRunning() && !messageBusy() && !CoopState.selecting;
    };

    Game_Player2.prototype.syncActorImage = function() {
        const actor = CoopView.p2Actor();
        if (!actor) return;
        if (this._characterName !== actor.characterName() || this._characterIndex !== actor.characterIndex()) {
            this.setImage(actor.characterName(), actor.characterIndex());
        }
    };

    Game_Player2.prototype.update = function() {
        this.syncActorImage();
        Game_Character.prototype.update.call(this);

        if (!this.isMoving() && this.canMoveP2()) {
            this.updateMoveP2();
        }

        this.triggerInteractionP2();
    };

    Game_Player2.prototype.updateMoveP2 = function() {
        let horz = 0;
        let vert = 0;

        if (keysP2.left) horz = 4;
        if (keysP2.right) horz = 6;
        if (keysP2.up) vert = 8;
        if (keysP2.down) vert = 2;

        if (horz !== 0 && vert !== 0) {
            this.moveDiagonally(horz, vert);
        } else if (horz !== 0) {
            this.moveStraight(horz);
        } else if (vert !== 0) {
            this.moveStraight(vert);
        }
    };

    Game_Player2.prototype.moveStraight = function(d) {
        Game_Character.prototype.moveStraight.call(this, d);
        if (this.isMovementSucceeded()) {
            this.checkEventTriggerHere([1, 2]);
        }
    };

    Game_Player2.prototype.moveDiagonally = function(horz, vert) {
        Game_Character.prototype.moveDiagonally.call(this, horz, vert);
        if (this.isMovementSucceeded()) {
            this.checkEventTriggerHere([1, 2]);
        }
    };

    Game_Player2.prototype.checkEventTriggerHere = function(triggers) {
        if ($gameMap.isEventRunning()) return;

        const events = $gameMap.eventsXy(this.x, this.y);
        for (const event of events) {
            if (event.isTriggerIn(triggers)) {
                event.start();
                break;
            }
        }
    };

    Game_Player2.prototype.checkEventTriggerThere = function(triggers) {
        if ($gameMap.isEventRunning()) return;

        const x = $gameMap.roundXWithDirection(this.x, this.direction());
        const y = $gameMap.roundYWithDirection(this.y, this.direction());

        const events = $gameMap.eventsXy(x, y);
        for (const event of events) {
            if (event.isTriggerIn(triggers)) {
                event.start();
                break;
            }
        }
    };

    Game_Player2.prototype.triggerInteractionP2 = function() {
        if (!keysP2.ok) return;

        keysP2.ok = false;
        if (!this.canMoveP2()) return;

        this.checkEventTriggerHere([0, 1, 2]);

        if (!$gameMap.isEventRunning()) {
            this.checkEventTriggerThere([0, 1, 2]);
        }
    };

    // =========================================================================
    // ENEMIGOS: REACCIONAN AL JUGADOR MAS CERCANO
    // =========================================================================

    const _Game_Event_update = Game_Event.prototype.update;

    Game_Event.prototype.update = function() {
        let realX = null;
        let realY = null;

        if ($gamePlayer2) {
            const distP1 = $gameMap.distance(this.x, this.y, $gamePlayer.x, $gamePlayer.y);
            const distP2 = $gameMap.distance(this.x, this.y, $gamePlayer2.x, $gamePlayer2.y);

            if (distP2 < distP1) {
                realX = $gamePlayer._x;
                realY = $gamePlayer._y;

                $gamePlayer._x = $gamePlayer2.x;
                $gamePlayer._y = $gamePlayer2.y;
            }
        }

        _Game_Event_update.call(this);

        if (realX !== null && realY !== null) {
            $gamePlayer._x = realX;
            $gamePlayer._y = realY;
        }
    };

    const _Game_Event_checkEventTriggerTouch = Game_Event.prototype.checkEventTriggerTouch;

    Game_Event.prototype.checkEventTriggerTouch = function(x, y) {
        _Game_Event_checkEventTriggerTouch.call(this, x, y);

        if ($gamePlayer2 && !$gameMap.isEventRunning()) {
            if (this._trigger === 1 || this._trigger === 2) {
                if ($gamePlayer2.x === x && $gamePlayer2.y === y) {
                    if (!this.isJumping() && this.isNormalPriority()) {
                        this.start();
                    }
                }
            }
        }
    };

    // Los eventos cerca de P2 tambien se actualizan aunque esten lejos de la camara de P1
    const _Game_CharacterBase_isNearTheScreen = Game_CharacterBase.prototype.isNearTheScreen;
    Game_CharacterBase.prototype.isNearTheScreen = function() {
        if (_Game_CharacterBase_isNearTheScreen.call(this)) return true;
        if (!$gamePlayer2 || this === $gamePlayer2) return !!$gamePlayer2;
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const dx = Math.abs(this._realX - $gamePlayer2._realX) * tw;
        const dy = Math.abs(this._realY - $gamePlayer2._realY) * th;
        return dx <= Graphics.width && dy <= Graphics.height;
    };

    // =========================================================================
    // CAMARA
    // =========================================================================

    // Centra la vista (de vpW x vpH pixeles) en un personaje respetando los bordes del mapa
    function cameraFor(target, vpW, vpH) {
        const tilesX = vpW / $gameMap.tileWidth();
        const tilesY = vpH / $gameMap.tileHeight();
        let x = target._realX - (tilesX - 1) / 2;
        let y = target._realY - (tilesY - 1) / 2;

        if (!$gameMap.isLoopHorizontal()) {
            const endX = $gameMap.width() - tilesX;
            x = endX < 0 ? endX / 2 : Math.max(0, Math.min(x, endX));
        }
        if (!$gameMap.isLoopVertical()) {
            const endY = $gameMap.height() - tilesY;
            y = endY < 0 ? endY / 2 : Math.max(0, Math.min(y, endY));
        }
        return { x: x, y: y };
    }

    function applyCamera(cam) {
        $gameMap._displayX = $gameMap.isLoopHorizontal() ? cam.x.mod($gameMap.width()) : cam.x;
        $gameMap._displayY = $gameMap.isLoopVertical() ? cam.y.mod($gameMap.height()) : cam.y;
        $gameMap._parallaxX = cam.x;
        $gameMap._parallaxY = cam.y;
    }

    const _Game_Player_updateScroll = Game_Player.prototype.updateScroll;

    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        if (!$gamePlayer2) {
            _Game_Player_updateScroll.call(this, lastScrolledX, lastScrolledY);
            return;
        }
        if ($gameMap.isScrolling()) return;

        const W = Graphics.width;
        const H = Graphics.height;
        let target;

        if (cameraMode === CAM_P2) {
            target = $gamePlayer2;
        } else if (cameraMode === CAM_SHARED) {
            target = {
                _realX: ($gamePlayer._realX + $gamePlayer2._realX) / 2,
                _realY: ($gamePlayer._realY + $gamePlayer2._realY) / 2
            };
        } else {
            target = $gamePlayer; // P1 y pantalla dividida (la division se arma aparte)
        }

        applyCamera(cameraFor(target, W, H));
    };

    const _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (CoopState.selecting) return false;
        return _Game_Player_canMove.call(this);
    };

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        if (CoopState.selecting) return; // el mapa se congela mientras P2 elige personaje
        _Game_Map_update.call(this, sceneActive);
    };

    // =========================================================================
    // VISTA: LUZ DE P2 + PANTALLA DIVIDIDA
    // =========================================================================

    const coopHooks = [];

    const CoopView = {
        // Para plugins de juego concreto (ver LocalCoop_FearHunger.js). Un gancho puede definir:
        //   splitPass(spriteset, indice, jugador) / splitPassEnd(spriteset, indice)
        //   canP2Dash() -> false para impedir el sprint de P2 (p.ej. con un arma equipada)
        registerHook(h) { coopHooks.push(h); },
        hooks: coopHooks,
        player2() { return $gamePlayer2; },
        p2ActorId() { return $gameSystem ? $gameSystem._coopP2ActorId || 0 : 0; },
        p2Actor() {
            const id = this.p2ActorId();
            return id ? $gameActors.actor(id) : null;
        },
        cycleCamera() {
            cameraMode = (cameraMode + 1) % 4;
            if (cameraMode === CAM_SPLIT && !canSplit()) cameraMode = CAM_P1;
            if (typeof SoundManager !== 'undefined') SoundManager.playCursor();
            CoopUI.banner(CAM_NAMES[cameraMode], 'Press G to change camera', '#bbbbbb', 90);
        },
        setCamera(name) {
            if (CAM_BY_NAME[name] !== undefined) cameraMode = CAM_BY_NAME[name];
        },
        mode() {
            return cameraMode;
        }
    };
    window.CoopLocal = CoopView;

    // Fuentes de luz del jugador: { sprite, pos(jugador) -> [x, y] en pantalla }.
    //  - Imagenes por nombre (Look Outside: "Darkness"). No se filtra por posicion: el juego a veces
    //    las deja desfasadas unos cuadros, y entonces dejarian de reconocerse y taparian todo.
    //  - Las que aporten los ganchos (h.lightSources(spriteset)), p.ej. el circulo de vision de Termina.
    Spriteset_Map.prototype.coopLightSources = function() {
        const list = [];
        if (this._pictureContainer && LIGHT_NAMES.length > 0) {
            for (const s of this._pictureContainer.children) {
                if (!s.picture) continue;
                const pic = s.picture();
                if (pic && LIGHT_NAMES.indexOf(pic.name()) >= 0) {
                    list.push({ sprite: s, pos: p => [p.screenX(), p.screenY()] });
                }
            }
        }
        coopHooks.forEach(h => {
            if (h.lightSources) h.lightSources(this).forEach(d => list.push(d));
        });
        return list;
    };

    // Sincroniza posiciones de sprites con la camara actual
    Spriteset_Map.prototype.coopSyncToCamera = function() {
        this.updateParallax();
        this.updateTilemap();
        this.updateWeather();
        for (const s of this._characterSprites) {
            s.updatePosition();
        }
        if (this._balloonSprites) {
            for (const b of this._balloonSprites) {
                if (b.updatePosition) b.updatePosition();
            }
        }
        if (this._destinationSprite) this._destinationSprite.visible = false;

        // capas de imagen de GALV_LayerGraphics (arte de los mapas de Look Outside):
        // se reposicionan sin avanzar su animacion
        for (const c of this._tilemap.children) {
            if (typeof c.lValue === 'function' && typeof c.updatePosition === 'function') {
                const v = c.lValue();
                if (!v) continue;
                const cx = v.currentx;
                const cy = v.currenty;
                c.updatePosition(v);
                v.currentx = cx;
                v.currenty = cy;
            }
        }
    };

    // ---- LUZ COMPARTIDA: une el hueco de luz de P1 y P2 -----------------------

    Spriteset_Map.prototype.coopSharedLights = function() {
        const sources = this.coopLightSources();
        const r = getRenderer();
        const W = Graphics.width;
        const H = Graphics.height;
        this._coopLit = this._coopLit || [];

        for (const d of sources) {
            const l = d.sprite;
            if (this._coopLit.indexOf(l) < 0) this._coopLit.push(l);
            if (!canUnionLights() || !l.visible || !l.texture || !l.texture.valid) {
                l.renderable = true;
                if (l._coopLight) l._coopLight.out.visible = false;
                continue;
            }
            let st = l._coopLight;
            if (!st) {
                st = l._coopLight = {
                    rt: makeRenderTexture(W, H),
                    a: new PIXI.Sprite(l.texture),
                    b: new PIXI.Sprite(l.texture),
                    out: null
                };
                st.out = new PIXI.Sprite(st.rt);
                st.b.blendMode = dstInMode();
                if (l.parent) l.parent.addChildAt(st.out, l.parent.children.indexOf(l));
            }
            if (st.rt.width !== W || st.rt.height !== H) st.rt.resize(W, H);
            if (!st.out.parent && l.parent) l.parent.addChildAt(st.out, l.parent.children.indexOf(l));

            for (const s of [st.a, st.b]) {
                s.texture = l.texture;
                s.anchor.set(l.anchor.x, l.anchor.y);
                s.scale.set(l.scale.x, l.scale.y);
            }
            st.a.position.set.apply(st.a.position, d.pos($gamePlayer));
            st.b.position.set.apply(st.b.position, d.pos($gamePlayer2));

            r.render(st.a, st.rt, true);
            r.render(st.b, st.rt, false);

            st.out.visible = true;
            st.out.alpha = l.alpha;
            st.out.blendMode = l.blendMode;
            st.out.z = l.z; // dentro del tilemap se ordena por z
            l.renderable = false;
        }
    };

    Spriteset_Map.prototype.coopLightsOff = function() {
        for (const s of (this._coopLit || [])) {
            if (s._coopLight) {
                s.renderable = true;
                s._coopLight.out.visible = false;
            }
        }
    };

    // ---- PANTALLA DIVIDIDA ------------------------------------------------------

    const SPLIT_GAP = 4;

    Spriteset_Map.prototype.coopSplitRender = function() {
        const r = getRenderer();
        if (!r) return;
        const scene = this.parent;
        if (!scene) return;

        const W = Graphics.width;
        const H = Graphics.height;
        const vpW = SPLIT_VERTICAL ? Math.floor((W - SPLIT_GAP) / 2) : W;
        const vpH = SPLIT_VERTICAL ? H : Math.floor((H - SPLIT_GAP) / 2);

        let st = this._coopSplit;
        if (!st) {
            st = this._coopSplit = {
                rts: [makeRenderTexture(vpW, vpH), makeRenderTexture(vpW, vpH)],
                sprites: [],
                divider: new PIXI.Graphics()
            };
            st.sprites = st.rts.map(rt => new PIXI.Sprite(rt));
        }
        if (st.rts[0].width !== vpW || st.rts[0].height !== vpH) {
            st.rts.forEach(rt => rt.resize(vpW, vpH));
        }
        if (!st.sprites[0].parent || st.sprites[0].parent !== scene) {
            scene.addChildAt(st.sprites[1], 0);
            scene.addChildAt(st.sprites[0], 0);
            scene.addChildAt(st.divider, 2);
        }
        st.sprites[0].position.set(0, 0);
        st.sprites[1].position.set(SPLIT_VERTICAL ? vpW + SPLIT_GAP : 0, SPLIT_VERTICAL ? 0 : vpH + SPLIT_GAP);
        st.divider.clear();
        st.divider.beginFill(0x9a9a9a, 1);
        if (SPLIT_VERTICAL) st.divider.drawRect(vpW, 0, SPLIT_GAP, H);
        else st.divider.drawRect(0, vpH, W, SPLIT_GAP);
        st.divider.endFill();

        // detectar las luces con la camara principal (centrada en P1) antes de moverla
        const sources = this.coopLightSources();
        const lights = sources.map(d => d.sprite);

        const saved = [$gameMap._displayX, $gameMap._displayY, $gameMap._parallaxX, $gameMap._parallaxY];
        const players = [$gamePlayer, $gamePlayer2];

        this.renderable = true;
        this.children.forEach(c => { c.visible = true; });

        for (let i = 0; i < 2; i++) {
            applyCamera(cameraFor(players[i], vpW, vpH));
            this.coopSyncToCamera();
            coopHooks.forEach(h => h.splitPass && h.splitPass(this, i, players[i]));
            for (const pic of this._pictureContainer.children) {
                pic.renderable = lights.indexOf(pic) >= 0;
            }
            for (const d of sources) {
                const l = d.sprite;
                if (l._coopLight && l._coopLight.out) l._coopLight.out.visible = false;
                const pos = d.pos(players[i]);
                l.x = pos[0];
                l.y = pos[1];
            }
            r.render(this, st.rts[i], true);
            coopHooks.forEach(h => h.splitPassEnd && h.splitPassEnd(this, i));
        }

        $gameMap._displayX = saved[0];
        $gameMap._displayY = saved[1];
        $gameMap._parallaxX = saved[2];
        $gameMap._parallaxY = saved[3];
        this.coopSyncToCamera();

        // el render final del escenario solo dibuja las imagenes (a pantalla completa);
        // el mapa, las luces, el clima, etc. ya estan dentro de cada vista
        this.children.forEach(c => {
            if (c !== this._pictureContainer && c !== this._timerSprite) c.visible = false;
        });
        for (const pic of this._pictureContainer.children) {
            pic.renderable = lights.indexOf(pic) < 0;
        }
    };

    Spriteset_Map.prototype.coopSplitOff = function() {
        const st = this._coopSplit;
        if (!st || !st.active) return;
        st.active = false;
        for (const s of st.sprites) if (s.parent) s.parent.removeChild(s);
        if (st.divider.parent) st.divider.parent.removeChild(st.divider);
        this.children.forEach(c => { c.visible = true; });
        for (const pic of this._pictureContainer.children) pic.renderable = true;
        this.coopSyncToCamera();
    };

    const _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);

        if (!$gamePlayer2) {
            this.coopSplitOff();
            this.coopLightsOff();
            return;
        }

        if (cameraMode === CAM_SPLIT && canSplit()) {
            this.coopLightsOff();
            this.coopSplitRender();
            if (this._coopSplit) this._coopSplit.active = true;
        } else {
            this.coopSplitOff();
            this.coopSharedLights();
        }
    };

    const _Spriteset_Map_destroy = Spriteset_Map.prototype.destroy;
    Spriteset_Map.prototype.destroy = function(options) {
        if (this._coopSplit) {
            this._coopSplit.rts.forEach(rt => rt.destroy(true));
            this._coopSplit = null;
        }
        for (const s of (this._coopLit || [])) {
            if (s._coopLight && s._coopLight.rt) {
                s._coopLight.rt.destroy(true);
                s._coopLight = null;
            }
        }
        _Spriteset_Map_destroy.call(this, options);
    };

    // =========================================================================
    // SPRITE DE P2
    // =========================================================================

    const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;

    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);

        if ($gamePlayer2) {
            const sprite = new Sprite_Character($gamePlayer2);
            this._characterSprites.push(sprite);
            this._tilemap.addChild(sprite);
        }
    };

    // =========================================================================
    // SCENE MAP: UNION DE P2
    // =========================================================================

    const _Scene_Map_update = Scene_Map.prototype.update;

    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        if (keysP2.join && !$gamePlayer2 && isMapIdle()) {
            keysP2.join = false;
            this.coopBeginJoin();
        }

        if ($gamePlayer2 && !CoopState.selecting) {
            if (coopMode() === 'select') this.coopFollowSecondMember();
            if ($gamePlayer2) $gamePlayer2.update();
        }
    };

    // Los protagonistas pueden abandonar el grupo: P2 siempre es el miembro en la 2.a posicion.
    // Si el grupo se queda solo con el protagonista, P2 sale hasta que vuelva a unirse con X.
    Scene_Map.prototype.coopFollowSecondMember = function() {
        if ($gameMap.isEventRunning() && !$gameParty.members()[1]) return; // eventos que reordenan el grupo
        const second = $gameParty.members()[1];
        if (!second) {
            this.coopRemovePlayer2();
            CoopUI.banner('Player 2 left the party', 'Press X to rejoin', COLOR_P2, 160);
            return;
        }
        if ($gameSystem._coopP2ActorId !== second.actorId()) {
            $gameSystem._coopP2ActorId = second.actorId();
            CoopUI.banner('Player 2 is now ' + second.name(), '', COLOR_P2, 110);
        }
    };

    Scene_Map.prototype.coopRemovePlayer2 = function() {
        const p2 = $gamePlayer2;
        $gamePlayer2 = null;
        $gameSystem._coopP2ActorId = 0;
        if (this._spriteset) {
            const list = this._spriteset._characterSprites;
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i]._character === p2) {
                    if (list[i].parent) list[i].parent.removeChild(list[i]);
                    list.splice(i, 1);
                }
            }
        }
        CoopState.lastOwner = 0;
        Input.clear();
    };

    Scene_Map.prototype.coopBeginJoin = function() {
        if (coopMode() === 'clone') {
            this.spawnPlayer2(0);
            return;
        }

        // Con 2 o mas personajes en el grupo, P2 pasa a ser automaticamente el 2.o.
        // Con solo el protagonista, se le pregunta a que personaje quiere sumar al grupo.
        const second = $gameParty.members()[1];
        if (second) {
            this.spawnPlayer2(second.actorId());
            return;
        }
        this.coopOpenSelect();
    };

    Scene_Map.prototype.coopOpenSelect = function() {
        const actors = selectableActors();
        if (actors.length === 0) {
            CoopUI.banner('No characters available', 'Check the P2ActorChoices parameter', '#ffaa44', 140);
            return;
        }
        const w = Math.min(Graphics.boxWidth - 40, 560);
        const rows = Math.min(actors.length, 6);
        const listH = rows * 64 + 36;
        const titleH = 92;
        const total = titleH + listH;
        const x = Math.floor((Graphics.boxWidth - w) / 2);
        const y = Math.max(10, Math.floor((Graphics.boxHeight - total) / 2));

        this._coopTitle = new Window_CoopTitle(x, y, w, titleH);
        this._coopSelect = new Window_CoopActorSelect(x, y + titleH, w, listH, actors);
        this._coopSelect.setHandler('ok', this.coopOnSelectOk.bind(this));
        this._coopSelect.setHandler('cancel', this.coopCloseSelect.bind(this));
        this.addWindow(this._coopTitle);
        this.addWindow(this._coopSelect);

        CoopState.selecting = true;
        Input.clear();
        keysP2.ok = false;
    };

    Scene_Map.prototype.coopCloseSelect = function() {
        if (this._coopSelect) {
            this._windowLayer.removeChild(this._coopSelect);
            this._windowLayer.removeChild(this._coopTitle);
            this._coopSelect = null;
            this._coopTitle = null;
        }
        CoopState.selecting = false;
        Input.clear();
        keysP2.join = false;
        keysP2.ok = false;
    };

    Scene_Map.prototype.coopOnSelectOk = function() {
        const actor = this._coopSelect.actor();
        this.coopCloseSelect();
        if (actor) this.spawnPlayer2(actor.id);
    };

    Scene_Map.prototype.spawnPlayer2 = function(actorId) {
        const p2Actor = coopMode() === 'clone' ? setupPersistentP2Actor() : setupSelectedP2Actor(actorId);

        if (!p2Actor) {
            CoopUI.banner('The party is full', 'Make room and press X again', '#ffaa44', 140);
            if (typeof SoundManager !== 'undefined') SoundManager.playBuzzer();
            return;
        }

        $gamePlayer2 = new Game_Player2();
        $gamePlayer2.locate($gamePlayer.x, $gamePlayer.y);
        $gamePlayer2.setImage(p2Actor.characterName(), p2Actor.characterIndex());

        if (this._spriteset && this._spriteset._tilemap) {
            const sprite = new Sprite_Character($gamePlayer2);
            this._spriteset._characterSprites.push(sprite);
            this._spriteset._tilemap.addChild(sprite);
        }

        if (typeof SoundManager !== 'undefined') {
            SoundManager.playOk();
        }
        CoopUI.banner(JOIN_TEXT, p2Actor.name() + '  -  Press G to change camera', COLOR_P2, 200);
    };

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;

    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);

        if ($gamePlayer2) {
            $gamePlayer2.locate($gamePlayer.x, $gamePlayer.y);
            $gamePlayer2.straighten();
            $gamePlayer2.setTransparent($gamePlayer.isTransparent());

            const p2Actor = $gameSystem._coopP2ActorId
                ? $gameActors.actor($gameSystem._coopP2ActorId) : $gameParty.members()[1];
            if (p2Actor) {
                $gamePlayer2.setImage(p2Actor.characterName(), p2Actor.characterIndex());
            }
        }
    };

    // Al cargar o empezar partida, P2 se reinicia (hay que volver a unirse con X)
    function resetCoop() {
        $gamePlayer2 = null;
        CoopState.selecting = false;
        CoopState.lastOwner = 0;
        keysP2.ok = false;
        keysP2.join = false;
    }

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        resetCoop();
        _DataManager_setupNewGame.call(this);
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        resetCoop();
        _DataManager_extractSaveContents.call(this, contents);
    };

    // =========================================================================
    // GAME OVER CONDICIONAL
    // =========================================================================

    const _Game_Party_isAllDead = Game_Party.prototype.isAllDead;

    Game_Party.prototype.isAllDead = function() {
        if ($gamePlayer2) {
            const members = $gameParty.members();

            if (members.length > 1) {
                return (members[0].isDead() || members[1].isDead());
            }
        }

        return _Game_Party_isAllDead.call(this);
    };

})();
