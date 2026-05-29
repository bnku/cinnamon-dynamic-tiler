import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from '../engine/types';

export const DEFAULT_CONFIG: Config = {
  horizontalFractions: [2, 3, 4, 5, 6, 7, 8],
  verticalFractions: [2, 3, 4],
  gaps: 0,
};

export class ConfigManager {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.config', 'dynamic-tiler');
  private static readonly CONFIG_FILE = path.join(this.CONFIG_DIR, 'config.json');

  /**
   * Убеждается в наличии папки и файла конфигурации
   */
  private static ensureConfigExists(): void {
    if (!fs.existsSync(this.CONFIG_DIR)) {
      fs.mkdirSync(this.CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(this.CONFIG_FILE)) {
      try {
        fs.writeFileSync(
          this.CONFIG_FILE,
          JSON.stringify(DEFAULT_CONFIG, null, 2),
          'utf8'
        );
      } catch (error) {
        // Игнорируем ошибки записи
      }
    }
  }

  /**
   * Считывает и возвращает конфигурацию пользователя
   */
  public static getConfig(): Config {
    this.ensureConfigExists();

    try {
      const content = fs.readFileSync(this.CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(content);
      
      // Базовая валидация структуры
      return {
        horizontalFractions: Array.isArray(parsed.horizontalFractions) && parsed.horizontalFractions.length > 0
          ? parsed.horizontalFractions.map(Number)
          : DEFAULT_CONFIG.horizontalFractions,
        verticalFractions: Array.isArray(parsed.verticalFractions) && parsed.verticalFractions.length > 0
          ? parsed.verticalFractions.map(Number)
          : DEFAULT_CONFIG.verticalFractions,
        gaps: typeof parsed.gaps === 'number' && parsed.gaps >= 0
          ? parsed.gaps
          : DEFAULT_CONFIG.gaps,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}
