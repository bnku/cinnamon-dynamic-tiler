import { Direction } from '../types';
import { IShellAdapter } from '../ports/IShellAdapter';
import { ICacheManager } from '../ports/ICacheManager';
import { IConfigProvider } from '../ports/IConfigProvider';
export declare class TilingUseCase {
    private shell;
    private cache;
    private configProvider;
    constructor(shell: IShellAdapter, cache: ICacheManager, configProvider: IConfigProvider);
    tile(direction: Direction): void;
    restore(): void;
    clearCache(): void;
}
