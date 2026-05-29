import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';
export declare const HORIZONTAL_SPANS: [number, number][];
export declare const VERTICAL_SPANS: [number, number][];
export declare class TilingEngine {
    /**
     * Возвращает дефолтное пустое состояние окна (до тайлинга)
     */
    static getDefaultState(): WindowState;
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction: 'left' | 'right' | 'shift-left' | 'shift-right', siblingSpans: {
        hSpan: [number, number];
    }[]): [number, number];
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction: 'up' | 'down', siblingSpans: {
        vSpan: [number, number];
    }[]): [number, number];
    /**
     * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
     */
    static calculateNextState(currentState: WindowState, direction: Direction, config: Config, siblingSpans?: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[]): WindowState;
    /**
     * Рассчитывает новые состояния для всей цепочки соприкасающихся окон на основе направления
     */
    static calculateChainTransitions(activeId: string, direction: Direction, config: Config, activeWindows: {
        windowId: string;
        state: WindowState;
    }[], allVisibleSpans?: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[]): Record<string, WindowState>;
    /**
     * Мапит горизонтальный спан на примерный hIndex для совместимости со старыми частями кода
     */
    static spanToHIndex(span: [number, number]): number;
    /**
     * Мапит вертикальный спан на примерный vIndex для совместимости
     */
    static spanToVIndex(span: [number, number]): number;
    /**
     * Преобразует физическую геометрию окна в логические колонки (hSpan) на указанном мониторе
     */
    static geometryToHSpan(geom: Geometry, monitor: ScreenInfo): [number, number];
    /**
     * Преобразует физическую геометрию окна в логические строки (vSpan) на указанном мониторе
     */
    static geometryToVSpan(geom: Geometry, monitor: ScreenInfo): [number, number];
    /**
     * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
     */
    static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry;
}
