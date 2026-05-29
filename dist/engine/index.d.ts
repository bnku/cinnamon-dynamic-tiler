import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';
export declare const HORIZONTAL_SPANS: [number, number][];
export declare const VERTICAL_SPANS: [number, number][];
export declare class TilingEngine {
    /**
     * Возвращает дефолтное пустое состояние окна (до тайлинга)
     */
    static getDefaultState(): WindowState;
    /**
     * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
     */
    static calculateNextState(currentState: WindowState, direction: Direction, config: Config): WindowState;
    /**
     * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
     */
    static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry;
}
