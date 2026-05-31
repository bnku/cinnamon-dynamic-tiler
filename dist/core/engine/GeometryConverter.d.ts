import { Config, Geometry, ScreenInfo, WindowState } from '../types';
export declare class GeometryConverter {
    /**
     * Преобразует физическую геометрию окна в логические колонки (hSpan) на указанном мониторе
     */
    static geometryToHSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number];
    /**
     * Преобразует физическую геометрию окна в логические строки (vSpan) на указанном мониторе
     */
    static geometryToVSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number];
    /**
     * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
     */
    static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry;
}
