import { Config } from '../../core/types';
import { IConfigProvider } from '../../core/ports/IConfigProvider';
export declare const DEFAULT_CONFIG: Config;
export declare class JsonFileConfigProvider implements IConfigProvider {
    private readonly configDir;
    private readonly configFile;
    private ensureConfigExists;
    getConfig(): Config;
}
