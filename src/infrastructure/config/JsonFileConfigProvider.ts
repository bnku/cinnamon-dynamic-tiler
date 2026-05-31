import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config } from '../../core/types';
import { IConfigProvider } from '../../core/ports/IConfigProvider';

export const DEFAULT_CONFIG: Config = {
  gridSize: 12,
  gridColumns: 12,
  gridRows: 6,
  minSpan: 2,
  minColumnSpan: 2,
  minRowSpan: 2,
  step: 2,
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
        gridSize: typeof parsed.gridSize === 'number' && parsed.gridSize > 0
          ? parsed.gridSize
          : DEFAULT_CONFIG.gridSize,
        gridColumns: typeof parsed.gridColumns === 'number' && parsed.gridColumns > 0
          ? parsed.gridColumns
          : (typeof parsed.gridSize === 'number' && parsed.gridSize > 0 ? parsed.gridSize : DEFAULT_CONFIG.gridColumns),
        gridRows: typeof parsed.gridRows === 'number' && parsed.gridRows > 0
          ? parsed.gridRows
          : (typeof parsed.gridSize === 'number' && parsed.gridSize > 0 ? parsed.gridSize : DEFAULT_CONFIG.gridRows),
        minSpan: typeof parsed.minSpan === 'number' && parsed.minSpan > 0
          ? parsed.minSpan
          : DEFAULT_CONFIG.minSpan,
        minColumnSpan: typeof parsed.minColumnSpan === 'number' && parsed.minColumnSpan > 0
          ? parsed.minColumnSpan
          : (typeof parsed.minSpan === 'number' && parsed.minSpan > 0 ? parsed.minSpan : DEFAULT_CONFIG.minColumnSpan),
        minRowSpan: typeof parsed.minRowSpan === 'number' && parsed.minRowSpan > 0
          ? parsed.minRowSpan
          : (typeof parsed.minSpan === 'number' && parsed.minSpan > 0 ? parsed.minSpan : DEFAULT_CONFIG.minRowSpan),
        step: typeof parsed.step === 'number' && parsed.step > 0
          ? parsed.step
          : DEFAULT_CONFIG.step,
        gaps: typeof parsed.gaps === 'number' && parsed.gaps >= 0
          ? parsed.gaps
          : DEFAULT_CONFIG.gaps,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}
