import { Config } from '../types';

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
    const halfGrid = Math.round(config.gridSize / 2);
    if (direction === 'shift-left') return [0, halfGrid];
    if (direction === 'shift-right') return [halfGrid, config.gridSize];

    const spans = this.getInitialSpans(direction, siblingSpans, config, { 
      fixedVSpan: fixedVSpan || [0, config.gridSize] 
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
    const halfGrid = Math.round(config.gridSize / 2);
    if (direction === 'shift-up') return [0, halfGrid];
    if (direction === 'shift-down') return [halfGrid, config.gridSize];

    const spans = this.getInitialSpans(direction, siblingSpans, config, { 
      fixedHSpan: fixedHSpan || [0, config.gridSize] 
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
    const occupied = Array.from({ length: config.gridSize }, () => new Array(config.gridSize).fill(false));
    for (const sibling of siblingSpans) {
      const [hStart, hEnd] = sibling.hSpan;
      const [vStart, vEnd] = sibling.vSpan;
      for (let r = vStart; r < vEnd; r++) {
        for (let c = hStart; c < hEnd; c++) {
          if (r >= 0 && r < config.gridSize && c >= 0 && c < config.gridSize) {
            occupied[r][c] = true;
          }
        }
      }
    }

    const halfGrid = Math.round(config.gridSize / 2);

    if (direction === 'shift-left') {
      return { hSpan: [0, halfGrid], vSpan: options.fixedVSpan || [0, config.gridSize] };
    }
    if (direction === 'shift-right') {
      return { hSpan: [halfGrid, config.gridSize], vSpan: options.fixedVSpan || [0, config.gridSize] };
    }
    if (direction === 'shift-up') {
      return { hSpan: options.fixedHSpan || [0, config.gridSize], vSpan: [0, halfGrid] };
    }
    if (direction === 'shift-down') {
      return { hSpan: options.fixedHSpan || [0, config.gridSize], vSpan: [halfGrid, config.gridSize] };
    }

    if (direction === 'left') {
      let bestHSpan: [number, number] = [0, halfGrid];
      let bestVSpan: [number, number] = options.fixedVSpan || [0, config.gridSize];

      for (let hStart = 0; hStart <= config.gridSize - config.minSpan; hStart++) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const vIntervals: [number, number][] = options.fixedVSpan 
          ? [options.fixedVSpan] 
          : [];
        
        if (!options.fixedVSpan) {
          for (let vStart = 0; vStart <= config.gridSize - config.minSpan; vStart += config.step) {
            for (let vEnd = vStart + config.minSpan; vEnd <= config.gridSize; vEnd += config.step) {
              vIntervals.push([vStart, vEnd]);
            }
            if ((config.gridSize - vStart) >= config.minSpan && (config.gridSize - vStart) % config.step !== 0) {
              vIntervals.push([vStart, config.gridSize]);
            }
          }
        }

        for (const [vStart, vEnd] of vIntervals) {
          let w = 0;
          while (hStart + w < config.gridSize && w < halfGrid) {
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

          if (w >= config.minSpan) {
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
      let bestHSpan: [number, number] = [halfGrid, config.gridSize];
      let bestVSpan: [number, number] = options.fixedVSpan || [0, config.gridSize];

      for (let hEnd = config.gridSize; hEnd >= config.minSpan; hEnd--) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const vIntervals: [number, number][] = options.fixedVSpan 
          ? [options.fixedVSpan] 
          : [];
        
        if (!options.fixedVSpan) {
          for (let vStart = 0; vStart <= config.gridSize - config.minSpan; vStart += config.step) {
            for (let vEnd = vStart + config.minSpan; vEnd <= config.gridSize; vEnd += config.step) {
              vIntervals.push([vStart, vEnd]);
            }
            if ((config.gridSize - vStart) >= config.minSpan && (config.gridSize - vStart) % config.step !== 0) {
              vIntervals.push([vStart, config.gridSize]);
            }
          }
        }

        for (const [vStart, vEnd] of vIntervals) {
          let w = 0;
          while (hEnd - 1 - w >= 0 && w < halfGrid) {
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

          if (w >= config.minSpan) {
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
      let bestHSpan: [number, number] = options.fixedHSpan || [0, config.gridSize];
      let bestVSpan: [number, number] = [0, halfGrid];

      for (let vStart = 0; vStart <= config.gridSize - config.minSpan; vStart++) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const hIntervals: [number, number][] = options.fixedHSpan 
          ? [options.fixedHSpan] 
          : [];
        
        if (!options.fixedHSpan) {
          for (let hStart = 0; hStart <= config.gridSize - config.minSpan; hStart += config.step) {
            for (let hEnd = hStart + config.minSpan; hEnd <= config.gridSize; hEnd += config.step) {
              hIntervals.push([hStart, hEnd]);
            }
            if ((config.gridSize - hStart) >= config.minSpan && (config.gridSize - hStart) % config.step !== 0) {
              hIntervals.push([hStart, config.gridSize]);
            }
          }
        }

        for (const [hStart, hEnd] of hIntervals) {
          let h = 0;
          while (vStart + h < config.gridSize && h < halfGrid) {
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

          if (h >= config.minSpan) {
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
      let bestHSpan: [number, number] = options.fixedHSpan || [0, config.gridSize];
      let bestVSpan: [number, number] = [halfGrid, config.gridSize];

      for (let vEnd = config.gridSize; vEnd >= config.minSpan; vEnd--) {
        let maxArea = 0;
        let localBestHSpan: [number, number] | null = null;
        let localBestVSpan: [number, number] | null = null;

        const hIntervals: [number, number][] = options.fixedHSpan 
          ? [options.fixedHSpan] 
          : [];
        
        if (!options.fixedHSpan) {
          for (let hStart = 0; hStart <= config.gridSize - config.minSpan; hStart += config.step) {
            for (let hEnd = hStart + config.minSpan; hEnd <= config.gridSize; hEnd += config.step) {
              hIntervals.push([hStart, hEnd]);
            }
            if ((config.gridSize - hStart) >= config.minSpan && (config.gridSize - hStart) % config.step !== 0) {
              hIntervals.push([hStart, config.gridSize]);
            }
          }
        }

        for (const [hStart, hEnd] of hIntervals) {
          let h = 0;
          while (vEnd - 1 - h >= 0 && h < halfGrid) {
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

          if (h >= config.minSpan) {
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

    return { hSpan: [0, config.gridSize], vSpan: [0, config.gridSize] };
  }
}
