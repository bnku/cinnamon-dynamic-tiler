// Declare GJS globals
declare const imports: any;
declare const global: any;

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

export class TilePreview {
  private actor: any;
  private _showing: boolean = false;
  private _rect: any = null;
  private _monitorIndex: number = -1;
  private anim_time: number = 150;

  constructor() {
    this.actor = new St.Bin({ style_class: 'tile-preview', important: true });
    this.actor.set_style('background-color: rgba(52, 152, 219, 0.32); border: 2.5px solid #3498db; border-radius: 8px;');
    global.window_group.add_actor(this.actor);
    this._reset();
  }

  public show(
    window: any,
    tileRect: { x: number; y: number; width: number; height: number },
    monitorIndex: number,
    animate: boolean,
    animTime?: number,
    customOpacity?: number,
    isSecondary?: boolean,
    variant?: 'normal' | 'blocked'
  ) {
    this.anim_time = animTime || 150;

    // Apply appropriate styling based on whether it is the primary focus landing or secondary shifted window
    if (variant === 'blocked') {
      this.actor.set_style('background-color: rgba(231, 76, 60, 0.16); border: 2.5px dashed rgba(231, 76, 60, 0.92); border-radius: 8px;');
    } else if (isSecondary) {
      this.actor.set_style('background-color: rgba(52, 152, 219, 0.08); border: 1.5px dashed rgba(52, 152, 219, 0.5); border-radius: 6px;');
    } else {
      this.actor.set_style('background-color: rgba(52, 152, 219, 0.32); border: 2.5px solid #3498db; border-radius: 8px;');
    }

    if (this._rect && 
        this._rect.x === tileRect.x && 
        this._rect.y === tileRect.y && 
        this._rect.width === tileRect.width && 
        this._rect.height === tileRect.height) {
      return;
    }

    const changeMonitor = (this._monitorIndex === -1 || this._monitorIndex !== monitorIndex);

    this._monitorIndex = monitorIndex;
    this._rect = tileRect;
    const { x, y, width, height } = tileRect;

    if (!this._showing || changeMonitor) {
      try {
        const monitor = Main.layoutManager.monitors[monitorIndex];
        const monitorRect = new Meta.Rectangle({
          x: monitor.x,
          y: monitor.y,
          width: monitor.width,
          height: monitor.height
        });
        const [intersected, rect] = window.get_buffer_rect().intersect(monitorRect);
        if (intersected) {
          this.actor.set_size(rect.width, rect.height);
          this.actor.set_position(rect.x, rect.y);
        } else {
          this.actor.set_size(width, height);
          this.actor.set_position(x, y);
        }
      } catch (e) {
        // Robust fallback if window is currently grabbed or unavailable
        this.actor.set_size(width, height);
        this.actor.set_position(x, y);
      }
      this.actor.opacity = 0;
    }

    this._showing = true;
    this.actor.show();

    const targetOpacity = customOpacity !== undefined ? customOpacity : (isSecondary ? 120 : 180);
    const props = {
      x,
      y,
      width,
      height,
      opacity: targetOpacity,
    };

    if (animate && Main.animations_enabled) {
      this.actor.remove_all_transitions();
      Object.assign(props, {
        duration: this.anim_time,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD
      });
      this.actor.ease(props);
      return;
    }

    // Direct application if not animated
    this.actor.x = x;
    this.actor.y = y;
    this.actor.width = width;
    this.actor.height = height;
    this.actor.opacity = targetOpacity;
  }

  public hide() {
    if (!this._showing) return;

    this._showing = false;
    this.actor.remove_all_transitions();

    if (Main.animations_enabled) {
      this.actor.ease({
        opacity: 0,
        duration: this.anim_time,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => this._reset()
      });
    } else {
      this._reset();
    }
  }

  private _reset() {
    this.actor.hide();
    this._rect = null;
    this._monitorIndex = -1;
  }

  public destroy() {
    this.actor.destroy();
  }
}
