import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';
import { HORIZONTAL_SPANS, VERTICAL_SPANS } from './engine/GridSpans';
export { HORIZONTAL_SPANS, VERTICAL_SPANS };
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
        vSpan: [number, number];
    }[], config: Config, fixedVSpan?: [number, number]): [number, number];
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction: 'up' | 'down', siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, fixedHSpan?: [number, number]): [number, number];
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
    static spanToHIndex(span: [number, number]): number;
    static spanToVIndex(span: [number, number]): number;
    static geometryToHSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number];
    static geometryToVSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number];
    static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry;
}
