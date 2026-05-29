import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from '../../core/types';
import { IConfigProvider } from '../../core/ports/IConfigProvider';

export const DEFAULT_CONFIG: Config = {
  horizontalFractions: [2, 3, 4, 5, 6, 7, 8],
  verticalFractions: [2, 3, 4],
  gaps: 0,
};

export class JsonFileConfigProvider implements IConfigProvider {
  private readonly configDir = path.join(os.homedir(), '.config', 'dynamic-tiler');
  private readonly configFile = path.join(this.configDir, 'config.json');

  private ensureConfigExists(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configFile)) {
      try {
        fs.writeFileSync(
          this.configFile,
          JSON.stringify(DEFAULT_CONFIG, null, 2),
          'utf8'
        );
      } catch (error) {
        // Игнорируем ошибки записи
      }
    }
  }

  public getConfig(): Config {
    this.ensureConfigExists();

    try {
      const content = fs.readFileSync(this.configFile, 'utf8');
      const parsed = JSON.parse(content);
      
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
