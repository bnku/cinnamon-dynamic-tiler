import { Direction, Config } from '../types';
import { IShellAdapter } from '../ports/IShellAdapter';
import { ICacheManager } from '../ports/ICacheManager';
export declare class TilingUseCase {
    private shell;
    private cache;
    constructor(shell: IShellAdapter, cache: ICacheManager);
    tile(direction: Direction, config: Config): void;
    restore(): void;
    clearCache(): void;
}
