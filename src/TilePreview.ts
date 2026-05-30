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
    global.window_group.add_actor(this.actor);
    this._reset();
  }

  public show(window: any, tileRect: { x: number; y: number; width: number; height: number }, monitorIndex: number, animate: boolean, animTime?: number) {
    this.anim_time = animTime || 150;

    const windowActor = window.get_compositor_private();
    if (!windowActor) return;

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
      this.actor.opacity = 0;
    }

    this._showing = true;
    this.actor.show();

    const props = {
      x,
      y,
      width,
      height,
      opacity: 180, // Slightly semi-transparent preview
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
    this.actor.opacity = 180;
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
