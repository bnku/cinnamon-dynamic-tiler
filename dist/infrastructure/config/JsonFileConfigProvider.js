"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFileConfigProvider = exports.DEFAULT_CONFIG = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.DEFAULT_CONFIG = {
    horizontalFractions: [2, 3, 4, 5, 6, 7, 8],
    verticalFractions: [2, 3, 4],
    gaps: 0,
};
class JsonFileConfigProvider {
    configDir = path.join(os.homedir(), '.config', 'dynamic-tiler');
    configFile = path.join(this.configDir, 'config.json');
    ensureConfigExists() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
        if (!fs.existsSync(this.configFile)) {
            try {
                fs.writeFileSync(this.configFile, JSON.stringify(exports.DEFAULT_CONFIG, null, 2), 'utf8');
            }
            catch (error) {
                // Игнорируем ошибки записи
            }
        }
    }
    getConfig() {
        this.ensureConfigExists();
        try {
            const content = fs.readFileSync(this.configFile, 'utf8');
            const parsed = JSON.parse(content);
            return {
                horizontalFractions: Array.isArray(parsed.horizontalFractions) && parsed.horizontalFractions.length > 0
                    ? parsed.horizontalFractions.map(Number)
                    : exports.DEFAULT_CONFIG.horizontalFractions,
                verticalFractions: Array.isArray(parsed.verticalFractions) && parsed.verticalFractions.length > 0
                    ? parsed.verticalFractions.map(Number)
                    : exports.DEFAULT_CONFIG.verticalFractions,
                gaps: typeof parsed.gaps === 'number' && parsed.gaps >= 0
                    ? parsed.gaps
                    : exports.DEFAULT_CONFIG.gaps,
            };
        }
        catch {
            return exports.DEFAULT_CONFIG;
        }
    }
}
exports.JsonFileConfigProvider = JsonFileConfigProvider;
