import { TilingEngine } from './core/TilingEngine';
import { TilingUseCase } from './core/usecases/TilingUseCase';
import { CinnamonShellAdapter, CinnamonCache, CinnamonConfigProvider } from './CinnamonAdapters';

declare const imports: any;
declare const global: any;

const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;

class DynamicTilerExtension {
  private metadata: any;
  private settings: any;
  private shell: CinnamonShellAdapter;
  private cache: CinnamonCache;
  private configProvider: CinnamonConfigProvider;
  private useCase: TilingUseCase;
  private bindings: Record<string, string> = {};

  // Settings values automatically bound by Cinnamon settings system
  public gaps!: number;
  public gridSize!: number;
  public minSpan!: number;
  public step!: number;
  public enablePreview!: boolean;

  public 'keybinding-tile-left'!: string;
  public 'keybinding-tile-right'!: string;
  public 'keybinding-tile-up'!: string;
  public 'keybinding-tile-down'!: string;
  public 'keybinding-shift-left'!: string;
  public 'keybinding-shift-right'!: string;
  public 'keybinding-shift-up'!: string;
  public 'keybinding-shift-down'!: string;
  public 'keybinding-restore'!: string;

  constructor(metadata: any) {
    this.metadata = metadata;
    this.shell = new CinnamonShellAdapter(this);
    this.cache = new CinnamonCache();
    this.configProvider = new CinnamonConfigProvider(this);
    this.useCase = new TilingUseCase(this.shell, this.cache, this.configProvider);
  }

  public enable(): void {
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
      this.settings.bindProperty(Settings.BindingDirection.IN, 'enablePreview', 'enablePreview', () => {});

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
    } catch (e) {
      global.logError(`[Dynamic Tiler] Failed to enable extension: ${e}`);
    }
  }

  public disable(): void {
    try {
      // Remove all keybindings
      for (const key of Object.keys(this.bindings)) {
        Main.keybindingManager.removeHotKey(key);
      }
      this.bindings = {};

      if (this.settings) {
        this.settings.finalize();
      }
    } catch (e) {
      global.logError(`[Dynamic Tiler] Failed to disable extension: ${e}`);
    }
  }

  private applyConfigurationChange(): void {
    try {
      const config = this.configProvider.getConfig();
      const visibleWindowIds = this.shell.getVisibleWindowIds();
      const monitors = this.shell.getActiveMonitors();

      for (const id of visibleWindowIds) {
        const cached = this.cache.getCachedWindow(id);
        if (!cached) continue;

        try {
          const currentGeom = this.shell.getWindowGeometry(id);
          const monitor = this.shell.findMonitorForWindow(currentGeom, monitors);
          
          // Re-calculate the physics frame geometry with the new gaps
          const nextGeom = TilingEngine.stateToGeometry(cached.state, monitor, config);
          
          // Instantly rearrange windows for buttery-smooth responsiveness when dragging settings slider
          const win = (this.shell as any)._findMetaWindow(id);
          if (win) {
            if (win.maximized_horz || win.maximized_vert) {
              win.unmaximize(Meta.MaximizeFlags.BOTH);
            }
            win.move_resize_frame(true, nextGeom.x, nextGeom.y, nextGeom.width, nextGeom.height);
            this.cache.saveState(id, cached.state, nextGeom, cached.originalGeometry);
          }
        } catch (e) {
          // Ignore failures for individual windows
        }
      }
    } catch (e) {
      global.logError(`[Dynamic Tiler] Failed to apply config change: ${e}`);
    }
  }

  private registerKeybinding(settingName: string, action: string): void {
    // Bind setting change to listen to updates
    this.settings.bindProperty(Settings.BindingDirection.IN, settingName, settingName, () => {
      this.updateHotKey(settingName, action);
    });

    // Initial binding
    this.updateHotKey(settingName, action);
  }

  private updateHotKey(settingName: string, action: string): void {
    const key = `dynamic-tiler-${settingName}`;
    const value = (this as any)[settingName];

    // Clean up old keybinding if active
    if (this.bindings[key]) {
      Main.keybindingManager.removeHotKey(key);
      delete this.bindings[key];
    }

    if (!value || value === '') return;

    try {
      Main.keybindingManager.addHotKey(key, value, () => {
        try {
          if (action === 'restore') {
            this.useCase.restore();
          } else {
            this.useCase.tile(action as any);
          }
        } catch (e: any) {
          global.logError(`[Dynamic Tiler] Execution error for action ${action}: ${e.message}`);
        }
      });
      this.bindings[key] = value;
    } catch (e) {
      global.logError(`[Dynamic Tiler] Failed to register hotkey ${value}: ${e}`);
    }
  }
}

// Global instance variable
let extensionInstance: DynamicTilerExtension | null = null;

export function init(metadata: any): void {
  extensionInstance = new DynamicTilerExtension(metadata);
}

export function enable(): void {
  if (extensionInstance) {
    extensionInstance.enable();
  }
}

export function disable(): void {
  if (extensionInstance) {
    extensionInstance.disable();
  }
}
