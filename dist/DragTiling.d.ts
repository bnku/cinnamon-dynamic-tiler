import { Config, ScreenInfo, WindowState } from './core/types';
export interface DragIntentPoint {
    h: number;
    v: number;
}
export interface DragTransitionOptions {
    experimentalSwapSameShapeWindows?: boolean;
    swapWindows?: boolean;
    intentPoint?: DragIntentPoint;
    preferredWidth?: number;
}
export type DragSolveStatus = 'valid' | 'blocked';
export type DragBlockReason = 'wouldOverlap' | 'tooSmall' | 'outOfBounds';
export interface DragSolveResult {
    status: DragSolveStatus;
    states: Record<string, WindowState>;
    affected: string[];
    reason?: DragBlockReason;
}
export interface DragTransactionSnapshot {
    draggedId: string;
    monitorId: string;
    beforeStates: Record<string, WindowState>;
    afterStates: Record<string, WindowState>;
    affected: string[];
}
export interface DragTransactionRestoreResult {
    states: Record<string, WindowState>;
    snapshotIndex: number;
}
export interface ExtractionIntentInput {
    pointerX: number;
    pointerY: number;
    startPointerX: number;
    startPointerY: number;
    thresholdPixels?: number;
}
export interface DragTargetInput {
    draggedId: string;
    mx: number;
    my: number;
    monitor: ScreenInfo;
    config: Config;
    preferredWidth: number;
    preferredHeight: number;
    activeWindows: {
        windowId: string;
        state: WindowState;
    }[];
    previousTarget?: DragTargetResult | null;
}
export interface DragTargetResult {
    targetHSpan: [number, number];
    targetVSpan: [number, number];
    intentPoint: DragIntentPoint;
    debug: DragTargetDebug;
}
export type DragTargetMode = 'base' | 'horizontal-stack' | 'vertical-stack';
export interface DragTargetDebug {
    mode: DragTargetMode;
    preferredWidth: number;
    preferredHeight: number;
    targetWidth: number;
    initialHSpan: [number, number];
    initialVSpan: [number, number];
    verticalCandidates: number;
    horizontalCandidates: number;
    shouldPreferVerticalStack: boolean;
    verticalGroup?: {
        hSpan: [number, number];
        windows: number;
        containsCursor: boolean;
        hDistance: number;
    };
    horizontalGroup?: {
        vSpan: [number, number];
        windows: number;
        containsCursor: boolean;
        vDistance: number;
    };
    nearestBoundary?: number;
    nearestDistance?: number;
    slotWidth?: number;
    horizontalThreshold?: number;
    stackTargetHeight?: number;
    boundaryThreshold?: number;
}
export declare function shouldFloatAfterModifierRelease(input: ExtractionIntentInput): boolean;
export declare function hasLayoutOverlaps(states: Record<string, WindowState>): boolean;
export declare function solveDragTransitions(draggedId: string, targetHSpan: [number, number], targetVSpan: [number, number], config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[], options?: DragTransitionOptions): DragSolveResult;
export declare function restoreDragTransaction(snapshot: DragTransactionSnapshot | null, draggedId: string, config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[]): Record<string, WindowState> | null;
export declare function restoreDragTransactionHistory(snapshots: DragTransactionSnapshot[], draggedId: string, monitorId: string, config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[]): DragTransactionRestoreResult | null;
export declare function computeDragTarget(input: DragTargetInput): DragTargetResult;
export declare function calculateDragTransitions(draggedId: string, targetHSpan: [number, number], targetVSpan: [number, number], config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[], options?: DragTransitionOptions): Record<string, WindowState>;
export declare function collapseVacancy(vacantId: string, config: Config, activeWindows: {
    windowId: string;
    state: WindowState;
}[]): Record<string, WindowState>;
