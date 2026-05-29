import { Config } from '../types';
export interface IConfigProvider {
    getConfig(): Config;
}
