import { Config, getGridColumns, getGridRows, getMinColumnSpan, getMinRowSpan } from '../types';

export class InitialLayout {
  /**
   * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialHSpan(
    direction: 'left' | 'right' | 'shift-left' | 'shift-right',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    config: Config,
    fixedVSpan?: [number, number]
  ): [number, number] {
    const gridColumns = getGridColumns(config);
    const halfColumns = Math.round(gridColumns / 2);
    if (direction === 'shift-left') return [0, halfColumns];
    if (direction === 'shift-right') return [halfColumns, gridColumns];

    const spans = this.getInitialSpans(direction, siblingSpans, config, { 
      fixedVSpan: fixedVSpan || [0, getGridRows(config)]
    });
    return spans.hSpan;
  }

  /**
   * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialVSpan(
    direction: 'up' | 'down' | 'shift-up' | 'shift-down',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    config: Config,
    fixedHSpan?: [number, number]
  ): [number, number] {
    const gridRows = getGridRows(config);
    const halfRows = Math.round(gridRows / 2);
    if (direction === 'shift-up') return [0, halfRows];
    if (direction === 'shift-down') return [halfRows, gridRows];

    const spans = this.getInitialSpans(direction, siblingSpans, config, { 
      fixedHSpan: fixedHSpan || [0, getGridColumns(config)]
    });
    return spans.vSpan;
  }

  /**
   * Находит наиболее подходящий двумерный макет для первого тайлинга
   */
  public static getInitialSpans(
    direction: 'left' | 'right' | 'up' | 'down' | 'shift-left' | 'shift-right' | 'shift-up' | 'shift-down',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    config: Config,
    options: { fixedHSpan?: [number, number]; fixedVSpan?: [number, number] } = {}
  ): { hSpan: [number, number]; vSpan: [number, number] } {
    const gridColumns = getGridColumns(config);
    const gridRows = getGridRows(config);
    const minColumnSpan = getMinColumnSpan(config);
    const minRowSpan = getMinRowSpan(config);
    const halfColumns = Math.round(gridColumns / 2);
    const halfRows = Math.round(gridRows / 2);
    const occupied = Array.from({ length: gridRows }, () => new Array(gridColumns).fill(false));
    for (const sibling of siblingSpans) {
      const [hStart, hEnd] = sibling.hSpan;
      const [vStart, vEnd] = sibling.vSpan;
      for (let r = vStart; r < vEnd; r++) {
        for (let c = hStart; c < hEnd; c++) {
          if (r >= 0 && r < gridRows && c >= 0 && c < gridColumns) {
            occupied[r][c] = true;
          }
        }
      }
    }

    if (direction === 'shift-left') {
      return { hSpan: [0, halfColumns], vSpan: options.fixedVSpan || [0, gridRows] };
    }
    if (direction === 'shift-right') {
      return { hSpan: [halfColumns, gridColumns], vSpan: options.fixedVSpan || [0, gridRows] };
    }
    if (direction === 'shift-up') {
      return { hSpan: options.fixedHSpan || [0, gridColumns], vSpan: [0, halfRows] };
    }
    if (direction === 'shift-down') {
      return { hSpan: options.fixedHSpan || [0, gridColumns], vSpan: [halfRows, gridRows] };
    }

    if (direction === 'left') {
      let bestHSpan: [number, number] = [0, halfColumns];
      let bestVSpan: [number, number] = options.fixedVSpan || [0, gridRows];

      for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart++) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const vIntervals: [number, number][] = options.fixedVSpan 
          ? [options.fixedVSpan] 
          : [];
        
        if (!options.fixedVSpan) {
          for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart += config.step) {
            for (let vEnd = vStart + minRowSpan; vEnd <= gridRows; vEnd += config.step) {
              vIntervals.push([vStart, vEnd]);
            }
            if ((gridRows - vStart) >= minRowSpan && (gridRows - vStart) % config.step !== 0) {
              vIntervals.push([vStart, gridRows]);
            }
          }
        }

        for (const [vStart, vEnd] of vIntervals) {
          let w = 0;
          while (hStart + w < gridColumns && w < halfColumns) {
            let colFree = true;
            for (let r = vStart; r < vEnd; r++) {
              if (occupied[r][hStart + w]) {
                colFree = false;
                break;
              }
            }
            if (colFree) {
              w++;
            } else {
              break;
            }
          }

          if (w >= minColumnSpan) {
            const area = w * (vEnd - vStart);
            if (area > maxArea || (area === maxArea && w > (localBestHSpan ? (localBestHSpan[1] - localBestHSpan[0]) : 0))) {
              maxArea = area;
              localBestHSpan = [hStart, hStart + w];
              localBestVSpan = [vStart, vEnd];
            }
          }
        }

        if (localBestHSpan && localBestVSpan) {
          bestHSpan = localBestHSpan;
          bestVSpan = localBestVSpan;
          break;
        }
      }

      return { hSpan: bestHSpan, vSpan: bestVSpan };
    }

    if (direction === 'right') {
      let bestHSpan: [number, number] = [halfColumns, gridColumns];
      let bestVSpan: [number, number] = options.fixedVSpan || [0, gridRows];

      for (let hEnd = gridColumns; hEnd >= minColumnSpan; hEnd--) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const vIntervals: [number, number][] = options.fixedVSpan 
          ? [options.fixedVSpan] 
          : [];
        
        if (!options.fixedVSpan) {
          for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart += config.step) {
            for (let vEnd = vStart + minRowSpan; vEnd <= gridRows; vEnd += config.step) {
              vIntervals.push([vStart, vEnd]);
            }
            if ((gridRows - vStart) >= minRowSpan && (gridRows - vStart) % config.step !== 0) {
              vIntervals.push([vStart, gridRows]);
            }
          }
        }

        for (const [vStart, vEnd] of vIntervals) {
          let w = 0;
          while (hEnd - 1 - w >= 0 && w < halfColumns) {
            let colFree = true;
            for (let r = vStart; r < vEnd; r++) {
              if (occupied[r][hEnd - 1 - w]) {
                colFree = false;
                break;
              }
            }
            if (colFree) {
              w++;
            } else {
              break;
            }
          }

          if (w >= minColumnSpan) {
            const area = w * (vEnd - vStart);
            if (area > maxArea || (area === maxArea && w > (localBestHSpan ? (localBestHSpan[1] - localBestHSpan[0]) : 0))) {
              maxArea = area;
              localBestHSpan = [hEnd - w, hEnd];
              localBestVSpan = [vStart, vEnd];
            }
          }
        }

        if (localBestHSpan && localBestVSpan) {
          bestHSpan = localBestHSpan;
          bestVSpan = localBestVSpan;
          break;
        }
      }

      return { hSpan: bestHSpan, vSpan: bestVSpan };
    }

    if (direction === 'up') {
      let bestHSpan: [number, number] = options.fixedHSpan || [0, gridColumns];
      let bestVSpan: [number, number] = [0, halfRows];

      for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart++) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const hIntervals: [number, number][] = options.fixedHSpan 
          ? [options.fixedHSpan] 
          : [];
        
        if (!options.fixedHSpan) {
          for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart += config.step) {
            for (let hEnd = hStart + minColumnSpan; hEnd <= gridColumns; hEnd += config.step) {
              hIntervals.push([hStart, hEnd]);
            }
            if ((gridColumns - hStart) >= minColumnSpan && (gridColumns - hStart) % config.step !== 0) {
              hIntervals.push([hStart, gridColumns]);
            }
          }
        }

        for (const [hStart, hEnd] of hIntervals) {
          let h = 0;
          while (vStart + h < gridRows && h < halfRows) {
            let rowFree = true;
            for (let c = hStart; c < hEnd; c++) {
              if (occupied[vStart + h][c]) {
                rowFree = false;
                break;
              }
            }
            if (rowFree) {
              h++;
            } else {
              break;
            }
          }

          if (h >= minRowSpan) {
            const area = h * (hEnd - hStart);
            if (area > maxArea || (area === maxArea && h > (localBestVSpan ? (localBestVSpan[1] - localBestVSpan[0]) : 0))) {
              maxArea = area;
              localBestHSpan = [hStart, hEnd];
              localBestVSpan = [vStart, vStart + h];
            }
          }
        }

        if (localBestHSpan && localBestVSpan) {
          bestHSpan = localBestHSpan;
          bestVSpan = localBestVSpan;
          break;
        }
      }

      return { hSpan: bestHSpan, vSpan: bestVSpan };
    }

    if (direction === 'down') {
      let bestHSpan: [number, number] = options.fixedHSpan || [0, gridColumns];
      let bestVSpan: [number, number] = [halfRows, gridRows];

      for (let vEnd = gridRows; vEnd >= minRowSpan; vEnd--) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const hIntervals: [number, number][] = options.fixedHSpan 
          ? [options.fixedHSpan] 
          : [];
        
        if (!options.fixedHSpan) {
          for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart += config.step) {
            for (let hEnd = hStart + minColumnSpan; hEnd <= gridColumns; hEnd += config.step) {
              hIntervals.push([hStart, hEnd]);
            }
            if ((gridColumns - hStart) >= minColumnSpan && (gridColumns - hStart) % config.step !== 0) {
              hIntervals.push([hStart, gridColumns]);
            }
          }
        }

        for (const [hStart, hEnd] of hIntervals) {
          let h = 0;
          while (vEnd - 1 - h >= 0 && h < halfRows) {
            let rowFree = true;
            for (let c = hStart; c < hEnd; c++) {
              if (occupied[vEnd - 1 - h][c]) {
                rowFree = false;
                break;
              }
            }
            if (rowFree) {
              h++;
            } else {
              break;
            }
          }

          if (h >= minRowSpan) {
            const area = h * (hEnd - hStart);
            if (area > maxArea || (area === maxArea && h > (localBestVSpan ? (localBestVSpan[1] - localBestVSpan[0]) : 0))) {
              maxArea = area;
              localBestHSpan = [hStart, hEnd];
              localBestVSpan = [vEnd - h, vEnd];
            }
          }
        }

        if (localBestHSpan && localBestVSpan) {
          bestHSpan = localBestHSpan;
          bestVSpan = localBestVSpan;
          break;
        }
      }

      return { hSpan: bestHSpan, vSpan: bestVSpan };
    }

    return { hSpan: [0, gridColumns], vSpan: [0, gridRows] };
  }
}
