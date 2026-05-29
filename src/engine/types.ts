export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenInfo {
  id: string; // Название монитора или ID из xrandr
  width: number;
  height: number;
  x: number;
  y: number;
  // Рабочая зона монитора (без учета панелей и таскбаров)
  workarea: Geometry;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface WindowState {
  // Доля экрана по ширине (знаменатель: 2 = 1/2, 3 = 1/3, 4 = 1/4, 1 = 100%)
  widthFraction: number;
  // Доля экрана по высоте (знаменатель: 2 = 1/2, 3 = 1/3, 4 = 1/4, 1 = 100%)
  heightFraction: number;

  // Выравнивание по горизонтали
  horizontalAlign: 'left' | 'right' | 'center' | null;
  // Выравнивание по вертикали
  verticalAlign: 'top' | 'bottom' | 'center' | null;

  // Последнее примененное направление движения
  lastDirection: Direction | null;
}

export interface CachedWindowState {
  windowId: string;
  state: WindowState;
  // Физическая геометрия окна после последнего тайлинга (для детекта ручного ресайза)
  tiledGeometry: Geometry;
  // Исходная геометрия окна до того, как его начали тайлить
  originalGeometry: Geometry;
  // Таймстамп последнего действия
  lastUpdated: number;
}

export interface Config {
  // Список долей деления по горизонтали (например, [2, 3, 4, 5, 6, 7, 8])
  horizontalFractions: number[];
  // Список долей деления по вертикали (например, [2, 3, 4])
  verticalFractions: number[];
  // Величина отступов (gaps) между окнами в пикселях
  gaps: number;
}
