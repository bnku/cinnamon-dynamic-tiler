import { Config, WindowState } from './core/types';
export declare function calculateDragTransitions(draggedId: string, targetHSpan: [number, number], targetVSpan: [number, number], config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[]): Record<string, WindowState>;
export declare function collapseVacancy(vacantId: string, config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[]): Record<string, WindowState>;
