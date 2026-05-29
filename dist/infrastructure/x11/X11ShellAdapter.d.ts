import { Geometry, ScreenInfo } from '../../core/types';
import { IShellAdapter } from '../../core/ports/IShellAdapter';
export declare class X11ShellAdapter implements IShellAdapter {
    /**
     * Выполняет команду и возвращает строку вывода (stdout)
     */
    private runCommand;
    /**
     * Получает ID активного окна
     */
    getActiveWindowId(): string;
    /**
     * Получает реальную геометрию окна по его ID
     */
    getWindowGeometry(windowId: string): Geometry;
    /**
     * Проверяет, развернуто ли окно во весь экран (maximized)
     */
    isWindowMaximized(windowId: string): boolean;
    /**
     * Снимает с окна флаг "развернуто" (maximized)
     */
    unmaximizeWindow(windowId: string): void;
    /**
     * Получает размеры невидимых теней и рамок (декораций) окна в формате left, right, top, bottom
     */
    getFrameExtents(windowId: string): {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    /**
     * Перемещает и изменяет размер окна с компенсацией теней
     */
    applyGeometry(windowId: string, geom: Geometry): void;
    /**
     * Получает глобальную полезную рабочую область всего экрана (с учетом таскбаров)
     */
    getGlobalWorkarea(): Geometry;
    /**
     * Возвращает список геометрических параметров всех активных окон рабочего стола
     */
    getDesktopGeometries(): Geometry[];
    /**
     * Возвращает список активных физических мониторов с умным расчетом рабочей области
     */
    getActiveMonitors(): ScreenInfo[];
    /**
     * Получает список ID всех видимых окон в X11
     */
    getVisibleWindowIds(): string[];
    /**
     * Поднимает окно на передний план
     */
    raiseWindow(windowId: string): void;
    /**
     * Находит монитор, на котором расположено окно, по максимальной площади пересечения с его рабочей областью
     */
    findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo;
}
