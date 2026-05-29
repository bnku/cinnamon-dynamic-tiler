import { Geometry, ScreenInfo } from '../engine/types';
export declare class ShellAdapter {
    /**
     * Выполняет команду и возвращает строку вывода (stdout)
     */
    private static runCommand;
    /**
     * Получает ID активного окна
     */
    static getActiveWindowId(): string;
    /**
     * Получает реальную геометрию окна по его ID
     */
    static getWindowGeometry(windowId: string): Geometry;
    /**
     * Проверяет, развернуто ли окно во весь экран (maximized)
     */
    static isWindowMaximized(windowId: string): boolean;
    /**
     * Снимает с окна флаг "развернуто" (maximized)
     */
    static unmaximizeWindow(windowId: string): void;
    /**
     * Получает размеры невидимых теней и рамок (декораций) окна в формате left, right, top, bottom
     */
    static getFrameExtents(windowId: string): {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    /**
     * Перемещает и изменяет размер окна с компенсацией теней
     * Возвращает физические координаты, отправленные в X11
     */
    static applyGeometry(windowId: string, geom: Geometry): Geometry;
    /**
     * Применяет физические координаты напрямую к wmctrl (для восстановления исходного вида)
     */
    static applyRawPhysicalGeometry(windowId: string, geom: Geometry): void;
    /**
     * Получает глобальную полезную рабочую область всего экрана (с учетом таскбаров)
     */
    static getGlobalWorkarea(): Geometry;
    /**
     * Возвращает список геометрических параметров всех активных окон рабочего стола
     * Оптимизировано: мгновенный поиск окон только класса "nemo-desktop" через xdotool (занимает ~15-20мс на всё)
     */
    static getDesktopGeometries(): Geometry[];
    /**
     * Возвращает список активных физических мониторов с умным расчетом рабочей области
     */
    static getActiveMonitors(): ScreenInfo[];
    /**
     * Получает список ID всех видимых окон в X11
     */
    static getVisibleWindowIds(): string[];
    /**
     * Получает список всех окон с их геометриями и заголовками через wmctrl
     */
    static getAllWindows(): {
        id: string;
        geometry: Geometry;
        title: string;
    }[];
    /**
     * Находит монитор, на котором расположен центр переданного окна
     */
    static findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo;
}
