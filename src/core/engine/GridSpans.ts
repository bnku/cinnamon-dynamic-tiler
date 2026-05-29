export const HORIZONTAL_SPANS: [number, number][] = [
  [0, 2],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (left 1/2)
  [0, 8],   // 3
  [0, 10],  // 4
  [0, 12],  // 5 (full width)
  [2, 12],  // 6
  [4, 12],  // 7
  [6, 12],  // 8 (right 1/2)
  [8, 12],  // 9
  [10, 12], // 10
];

export const VERTICAL_SPANS: [number, number][] = [
  [0, 2],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (top 1/2)
  [0, 8],   // 3
  [0, 10],  // 4
  [0, 12],  // 5 (full height)
  [2, 12],  // 6
  [4, 12],  // 7
  [6, 12],  // 8 (bottom 1/2)
  [8, 12],  // 9
  [10, 12], // 10
];

/**
 * Мапит горизонтальный спан на примерный hIndex для совместимости со старыми частями кода
 */
export function spanToHIndex(span: [number, number]): number {
  for (let i = 0; i < HORIZONTAL_SPANS.length; i++) {
    if (HORIZONTAL_SPANS[i][0] === span[0] && HORIZONTAL_SPANS[i][1] === span[1]) {
      return i;
    }
  }
  return 5; 
}

/**
 * Мапит вертикальный спан на примерный vIndex для совместимости
 */
export function spanToVIndex(span: [number, number]): number {
  for (let i = 0; i < VERTICAL_SPANS.length; i++) {
    if (VERTICAL_SPANS[i][0] === span[0] && VERTICAL_SPANS[i][1] === span[1]) {
      return i;
    }
  }
  return 3;
}
