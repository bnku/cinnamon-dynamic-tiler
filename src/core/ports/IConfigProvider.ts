import { Config, ScreenInfo } from '../types';

export interface IConfigProvider {
  getConfig(): Config;
  getConfigForMonitor?(monitor: ScreenInfo): Config;
}
