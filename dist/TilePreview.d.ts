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
    }, monitorIndex: number, animate: boolean, animTime?: number): void;
    hide(): void;
    private _reset;
    destroy(): void;
}
