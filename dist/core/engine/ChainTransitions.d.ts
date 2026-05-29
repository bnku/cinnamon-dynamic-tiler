import { Direction, Config, WindowState } from '../types';
export declare class ChainTransitions {
    /**
     * Рассчитывает новые состояния для всей цепочки соприкасающихся окон на основе направления
     */
    static calculateChainTransitions(activeId: string, direction: Direction, config: Config, activeWindows: {
        windowId: string;
        state: WindowState;
    }[], allVisibleSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[] | undefined, calculateNextStateFn: (currentState: WindowState, direction: Direction, config: Config, siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[]) => WindowState, getDefaultStateFn: () => WindowState): Record<string, WindowState>;
}
