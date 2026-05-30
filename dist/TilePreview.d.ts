export declare class TilePreview {
    private actor;
    private _showing;
    private _rect;
    private _monitorIndex;
    private anim_time;
    constructor();
    show(window: any, tileRect: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, monitorIndex: number, animate: boolean, animTime?: number, customOpacity?: number, isSecondary?: boolean, variant?: 'normal' | 'blocked' | 'blocked-overlap' | 'blocked-too-small' | 'blocked-out-of-bounds'): void;
    hide(): void;
    private _reset;
    destroy(): void;
}
