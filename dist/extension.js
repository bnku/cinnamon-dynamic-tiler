"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.enable = enable;
exports.disable = disable;
const TilingEngine_1 = require("./core/TilingEngine");
const TilingUseCase_1 = require("./core/usecases/TilingUseCase");
const CinnamonAdapters_1 = require("./CinnamonAdapters");
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
class DynamicTilerExtension {
    metadata;
    settings;
    shell;
    cache;
    configProvider;
    useCase;
    bindings = {};
    // Settings values automatically bound by Cinnamon settings system
    gaps;
    gridSize;
    minSpan;
    step;
    enablePreview;
    'keybinding-tile-left';
    'keybinding-tile-right';
    'keybinding-tile-up';
    'keybinding-tile-down';
    'keybinding-shift-left';
    'keybinding-shift-right';
    'keybinding-shift-up';
    'keybinding-shift-down';
    'keybinding-restore';
    constructor(metadata) {
        this.metadata = metadata;
        this.shell = new CinnamonAdapters_1.CinnamonShellAdapter(this);
        this.cache = new CinnamonAdapters_1.CinnamonCache();
        this.configProvider = new CinnamonAdapters_1.CinnamonConfigProvider(this);
        this.useCase = new TilingUseCase_1.TilingUseCase(this.shell, this.cache, this.configProvider);
    }
    enable() {
        try {
            this.settings = new Settings.ExtensionSettings(this, this.metadata.uuid, this.metadata.uuid);
            // Bind basic settings and trigger layout adjustments in real-time
            this.settings.bindProperty(Settings.BindingDirection.IN, 'gaps', 'gaps', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'gridSize', 'gridSize', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'minSpan', 'minSpan', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'step', 'step', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'enablePreview', 'enablePreview', () => { });
            // Bind keybindings
            this.registerKeybinding('keybinding-tile-left', 'left');
            this.registerKeybinding('keybinding-tile-right', 'right');
            this.registerKeybinding('keybinding-tile-up', 'up');
            this.registerKeybinding('keybinding-tile-down', 'down');
            this.registerKeybinding('keybinding-shift-left', 'shift-left');
            this.registerKeybinding('keybinding-shift-right', 'shift-right');
            this.registerKeybinding('keybinding-shift-up', 'shift-up');
            this.registerKeybinding('keybinding-shift-down', 'shift-down');
            this.registerKeybinding('keybinding-restore', 'restore');
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to enable extension: ${e}`);
        }
    }
    disable() {
        try {
            // Remove all keybindings
            for (const key of Object.keys(this.bindings)) {
                Main.keybindingManager.removeHotKey(key);
            }
            this.bindings = {};
            if (this.settings) {
                this.settings.finalize();
            }
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to disable extension: ${e}`);
        }
    }
    applyConfigurationChange() {
        try {
            const config = this.configProvider.getConfig();
            const visibleWindowIds = this.shell.getVisibleWindowIds();
            const monitors = this.shell.getActiveMonitors();
            for (const id of visibleWindowIds) {
                const cached = this.cache.getCachedWindow(id);
                if (!cached)
                    continue;
                try {
                    const currentGeom = this.shell.getWindowGeometry(id);
                    const monitor = this.shell.findMonitorForWindow(currentGeom, monitors);
                    // Re-calculate the physics frame geometry with the new gaps
                    const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(cached.state, monitor, config);
                    // Instantly rearrange windows for buttery-smooth responsiveness when dragging settings slider
                    const win = this.shell._findMetaWindow(id);
                    if (win) {
                        if (win.maximized_horz || win.maximized_vert) {
                            win.unmaximize(Meta.MaximizeFlags.BOTH);
                        }
                        win.move_resize_frame(true, nextGeom.x, nextGeom.y, nextGeom.width, nextGeom.height);
                        this.cache.saveState(id, cached.state, nextGeom, cached.originalGeometry);
                    }
                }
                catch (e) {
                    // Ignore failures for individual windows
                }
            }
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to apply config change: ${e}`);
        }
    }
    registerKeybinding(settingName, action) {
        // Bind setting change to listen to updates
        this.settings.bindProperty(Settings.BindingDirection.IN, settingName, settingName, () => {
            this.updateHotKey(settingName, action);
        });
        // Initial binding
        this.updateHotKey(settingName, action);
    }
    updateHotKey(settingName, action) {
        const key = `dynamic-tiler-${settingName}`;
        const value = this[settingName];
        // Clean up old keybinding if active
        if (this.bindings[key]) {
            Main.keybindingManager.removeHotKey(key);
            delete this.bindings[key];
        }
        if (!value || value === '')
            return;
        try {
            Main.keybindingManager.addHotKey(key, value, () => {
                try {
                    if (action === 'restore') {
                        this.useCase.restore();
                    }
                    else {
                        this.useCase.tile(action);
                    }
                }
                catch (e) {
                    global.logError(`[Dynamic Tiler] Execution error for action ${action}: ${e.message}`);
                }
            });
            this.bindings[key] = value;
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to register hotkey ${value}: ${e}`);
        }
    }
}
// Global instance variable
let extensionInstance = null;
function init(metadata) {
    extensionInstance = new DynamicTilerExtension(metadata);
}
function enable() {
    if (extensionInstance) {
        extensionInstance.enable();
    }
}
function disable() {
    if (extensionInstance) {
        extensionInstance.disable();
    }
}
