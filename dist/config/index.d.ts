import { Config } from '../engine/types';
export declare const DEFAULT_CONFIG: Config;
export declare class ConfigManager {
    private static readonly CONFIG_DIR;
    private static readonly CONFIG_FILE;
    /**
     * Убеждается в наличии папки и файла конфигурации
     */
    private static ensureConfigExists;
    /**
     * Считывает и возвращает конфигурацию пользователя
     */
    static getConfig(): Config;
}
