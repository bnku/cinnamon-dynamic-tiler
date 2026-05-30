import { Geometry, ScreenInfo, WindowState, Config } from '../types';
import { HORIZONTAL_SPANS, VERTICAL_SPANS } from './GridSpans';

export class GeometryConverter {
  /**
   * Преобразует физическую геометрию окна в логические колонки (hSpan) на указанном мониторе
   */
  public static geometryToHSpan(
    geom: Geometry,
    monitor: ScreenInfo,
    config: Config = { gridSize: 12, minSpan: 2, step: 2, gaps: 0 }
  ): [number, number] {
    const { workarea } = monitor;
    const colWidth = workarea.width / config.gridSize;
    const relLeft = geom.x - workarea.x;
    const relRight = geom.x + geom.width - workarea.x;

    let startCol = Math.floor(relLeft / colWidth);
    const startRemainder = (relLeft / colWidth) - startCol;
    if (startRemainder > 0.2) {
      startCol = Math.min(config.gridSize - 1, startCol + 1);
    }
    startCol = Math.max(0, startCol);

    let endCol = Math.ceil(relRight / colWidth);
    const endRemainder = endCol - (relRight / colWidth);
    if (endRemainder > 0.2) {
      endCol = Math.max(1, endCol - 1);
    }
    endCol = Math.min(config.gridSize, endCol);

    return [startCol, endCol];
  }

  /**
   * Преобразует физическую геометрию окна в логические строки (vSpan) на указанном мониторе
   */
  public static geometryToVSpan(
    geom: Geometry,
    monitor: ScreenInfo,
    config: Config = { gridSize: 12, minSpan: 2, step: 2, gaps: 0 }
  ): [number, number] {
    const { workarea } = monitor;
    const rowHeight = workarea.height / config.gridSize;
    const relTop = geom.y - workarea.y;
    const relBottom = geom.y + geom.height - workarea.y;

    let startRow = Math.floor(relTop / rowHeight);
    const startRemainder = (relTop / rowHeight) - startRow;
    if (startRemainder > 0.2) {
      startRow = Math.min(config.gridSize - 1, startRow + 1);
    }
    startRow = Math.max(0, startRow);

    let endRow = Math.ceil(relBottom / rowHeight);
    const endRemainder = endRow - (relBottom / rowHeight);
    if (endRemainder > 0.2) {
      endRow = Math.max(1, endRow - 1);
    }
    endRow = Math.min(config.gridSize, endRow);

    return [startRow, endRow];
  }

  /**
   * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
   */
  public static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry {
    const { workarea } = screen;
    const gaps = config.gaps || 0;

    const hSpan = state.hSpan || HORIZONTAL_SPANS[state.hIndex] || [0, config.gridSize];
    const vSpan = state.vSpan || VERTICAL_SPANS[state.vIndex] || [0, config.gridSize];

    const colWidth = workarea.width / config.gridSize;
    const rowHeight = workarea.height / config.gridSize;

    const xStart = workarea.x + Math.round(hSpan[0] * colWidth);
    const xEnd = workarea.x + Math.round(hSpan[1] * colWidth);
    let width = xEnd - xStart;
    let x = xStart;

    const yStart = workarea.y + Math.round(vSpan[0] * rowHeight);
    const yEnd = workarea.y + Math.round(vSpan[1] * rowHeight);
    let height = yEnd - yStart;
    let y = yStart;

    if (gaps > 0) {
      const minDimension = 100;
      const maxGapW = Math.max(0, (width - minDimension) / 2);
      const maxGapH = Math.max(0, (height - minDimension) / 2);
      
      const gapW = Math.min(gaps, maxGapW);
      const gapH = Math.min(gaps, maxGapH);

      x += gapW;
      y += gapH;
      width -= 2 * gapW;
      height -= 2 * gapH;
    }

    return { x, y, width, height };
  }
}
