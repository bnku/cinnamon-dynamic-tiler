import { execSync } from 'child_process';
import { Geometry, ScreenInfo } from '../engine/types';

export class ShellAdapter {
  /**
   * Выполняет команду и возвращает строку вывода (stdout)
   */
  private static runCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
      throw new Error(`Failed to execute shell command: "${command}". Make sure dependencies are installed.`);
    }
  }

  /**
   * Получает ID активного окна
   */
  public static getActiveWindowId(): string {
    return this.runCommand('xdotool getactivewindow');
  }

  /**
   * Получает реальную геометрию окна по его ID
   */
  public static getWindowGeometry(windowId: string): Geometry {
    const output = this.runCommand(`xwininfo -id ${windowId}`);

    const xMatch = output.match(/Absolute upper-left X:\s+(-?\d+)/);
    const yMatch = output.match(/Absolute upper-left Y:\s+(-?\d+)/);
    const wMatch = output.match(/Width:\s+(\d+)/);
    const hMatch = output.match(/Height:\s+(\d+)/);

    if (!xMatch || !yMatch || !wMatch || !hMatch) {
      throw new Error(`Failed to parse geometry from xwininfo for window ${windowId}`);
    }

    return {
      x: parseInt(xMatch[1], 10),
      y: parseInt(yMatch[1], 10),
      width: parseInt(wMatch[1], 10),
      height: parseInt(hMatch[1], 10),
    };
  }

  /**
   * Проверяет, развернуто ли окно во весь экран (maximized)
   */
  public static isWindowMaximized(windowId: string): boolean {
    try {
      const output = this.runCommand(`xprop -id ${windowId} _NET_WM_STATE`);
      return output.includes('_NET_WM_STATE_MAXIMIZED_HORZ') || output.includes('_NET_WM_STATE_MAXIMIZED_VERT');
    } catch {
      return false;
    }
  }

  /**
   * Снимает с окна флаг "развернуто" (maximized)
   */
  public static unmaximizeWindow(windowId: string): void {
    if (this.isWindowMaximized(windowId)) {
      this.runCommand(`wmctrl -ir ${windowId} -b remove,maximized_vert,maximized_horz`);
      // Небольшая пауза, чтобы оконный менеджер успел применить изменения
      execSync('sleep 0.05');
    }
  }

  /**
   * Получает размеры невидимых теней и рамок (декораций) окна в формате left, right, top, bottom
   */
  public static getFrameExtents(windowId: string): { left: number; right: number; top: number; bottom: number } {
    try {
      const output = this.runCommand(`xprop -id ${windowId} _GTK_FRAME_EXTENTS`);
      // Ожидаемый вывод: _GTK_FRAME_EXTENTS(CARDINAL) = 35, 35, 15, 55
      const match = output.match(/_GTK_FRAME_EXTENTS\(CARDINAL\)\s*=\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          left: parseInt(match[1], 10),
          right: parseInt(match[2], 10),
          top: parseInt(match[3], 10),
          bottom: parseInt(match[4], 10),
        };
      }
    } catch {
      // Игнорируем ошибки (если окно не поддерживает GTK CSD)
    }
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  /**
   * Перемещает и изменяет размер окна с компенсацией теней
   * Возвращает физические координаты, отправленные в X11
   */
  public static applyGeometry(windowId: string, geom: Geometry): Geometry {
    const extents = this.getFrameExtents(windowId);

    // Расширяем физические размеры окна на величину теней,
    // чтобы видимая часть окна встала идеально пиксель-в-пиксель
    const physical: Geometry = {
      x: geom.x - extents.left,
      y: geom.y - extents.top,
      width: geom.width + extents.left + extents.right,
      height: geom.height + extents.top + extents.bottom,
    };

    // wmctrl использует формат: gravity,x,y,width,height
    this.runCommand(`wmctrl -ir ${windowId} -e 0,${physical.x},${physical.y},${physical.width},${physical.height}`);
    
    return physical;
  }

  /**
   * Применяет физические координаты напрямую к wmctrl (для восстановления исходного вида)
   */
  public static applyRawPhysicalGeometry(windowId: string, geom: Geometry): void {
    this.runCommand(`wmctrl -ir ${windowId} -e 0,${geom.x},${geom.y},${geom.width},${geom.height}`);
  }

  /**
   * Получает глобальную полезную рабочую область всего экрана (с учетом таскбаров)
   */
  public static getGlobalWorkarea(): Geometry {
    try {
      const output = this.runCommand('xprop -root _NET_WORKAREA');
      // Пример вывода: _NET_WORKAREA(CARDINAL) = 0, 40, 3840, 1040 (может быть несколько наборов для разных рабочих столов)
      const match = output.match(/_NET_WORKAREA\(CARDINAL\)\s*=\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          x: parseInt(match[1], 10),
          y: parseInt(match[2], 10),
          width: parseInt(match[3], 10),
          height: parseInt(match[4], 10),
        };
      }
    } catch {
      // Игнорируем и возвращаем null, если не удалось спарсить
    }

    // Резервный вариант, если xprop не отработал (например, DE не поддерживает EWMH полностью)
    const screenMatch = this.runCommand('xrandr | grep -w connected').match(/(\d+)x(\d+)\+(\d+)\+(\d+)/);
    if (screenMatch) {
      return {
        x: parseInt(screenMatch[3], 10),
        y: parseInt(screenMatch[4], 10),
        width: parseInt(screenMatch[1], 10),
        height: parseInt(screenMatch[2], 10),
      };
    }

    throw new Error('Could not determine screen workarea');
  }

  /**
   * Возвращает список геометрических параметров всех активных окон рабочего стола
   * Оптимизировано: мгновенный поиск окон только класса "nemo-desktop" через xdotool (занимает ~15-20мс на всё)
   */
  public static getDesktopGeometries(): Geometry[] {
    const desktops: Geometry[] = [];
    try {
      const output = this.runCommand('xdotool search --class "nemo-desktop"');
      const ids = output.split('\n').map(s => s.trim()).filter(Boolean);

      for (const id of ids) {
        try {
          const geom = this.getWindowGeometry(id);
          desktops.push(geom);
        } catch {
          // Игнорируем ошибки для отдельных окон
        }
      }
    } catch {
      // Игнорируем общие ошибки (например, если xdotool ничего не нашел)
    }
    return desktops;
  }

  /**
   * Возвращает список активных физических мониторов с умным расчетом рабочей области
   */
  public static getActiveMonitors(): ScreenInfo[] {
    const output = this.runCommand('xrandr --listactivemonitors');
    const lines = output.split('\n');
    const monitors: ScreenInfo[] = [];

    const globalWorkarea = this.getGlobalWorkarea();
    const desktops = this.getDesktopGeometries();

    // Регулярное выражение поддерживает форматы вроде:
    //  0: +*HDMI-A-0 1920/531x1080/299+0+0  HDMI-A-0
    //  1: +DP-1 2560x1440+1920+0  DP-1
    const monitorRegex = /^\s*\d+:\s+\+\*?([^\s]+)\s+(\d+)(?:\/\d+)?x(\d+)(?:\/\d+)?\+(\d+)\+(\d+)/;

    for (const line of lines) {
      const match = line.match(monitorRegex);
      if (match) {
        const id = match[1];
        const width = parseInt(match[2], 10);
        const height = parseInt(match[3], 10);
        const x = parseInt(match[4], 10);
        const y = parseInt(match[5], 10);

        // Ищем desktop-окно, которое принадлежит этому монитору
        let workarea: Geometry | null = null;
        for (const desktop of desktops) {
          const centerX = desktop.x + Math.round(desktop.width / 2);
          const centerY = desktop.y + Math.round(desktop.height / 2);

          const isInside = centerX >= x && centerX <= x + width &&
                           centerY >= y && centerY <= y + height;

          if (isInside) {
            workarea = desktop;
            break;
          }
        }

        // Если нашли десктоп-окно — используем его точные границы в качестве рабочей зоны!
        // Иначе откатываемся на пересечение с глобальной рабочей областью панели задач
        if (!workarea) {
          const workAreaX = Math.max(x, globalWorkarea.x);
          const workAreaY = Math.max(y, globalWorkarea.y);
          const workAreaWidth = Math.min(x + width, globalWorkarea.x + globalWorkarea.width) - workAreaX;
          const workAreaHeight = Math.min(y + height, globalWorkarea.y + globalWorkarea.height) - workAreaY;

          workarea = {
            x: workAreaX,
            y: workAreaY,
            width: workAreaWidth,
            height: workAreaHeight,
          };
        }

        monitors.push({
          id,
          width,
          height,
          x,
          y,
          workarea,
        });
      }
    }

    if (monitors.length === 0) {
      throw new Error('No active monitors found via xrandr');
    }

    return monitors;
  }

  /**
   * Находит монитор, на котором расположен центр переданного окна
   */
  public static findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo {
    const centerX = geom.x + Math.round(geom.width / 2);
    const centerY = geom.y + Math.round(geom.height / 2);

    for (const monitor of monitors) {
      const isInsideX = centerX >= monitor.x && centerX <= monitor.x + monitor.width;
      const isInsideY = centerY >= monitor.y && centerY <= monitor.y + monitor.height;

      if (isInsideX && isInsideY) {
        return monitor;
      }
    }

    // Если центр окна почему-то вне мониторов, возвращаем первый попавшийся
    return monitors[0];
  }
}
