"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGridColumns = getGridColumns;
exports.getGridRows = getGridRows;
exports.getMinColumnSpan = getMinColumnSpan;
exports.getMinRowSpan = getMinRowSpan;
function getGridColumns(config) {
    return config.gridColumns || config.gridSize;
}
function getGridRows(config) {
    return config.gridRows || config.gridSize;
}
function getMinColumnSpan(config) {
    return config.minColumnSpan || config.minSpan;
}
function getMinRowSpan(config) {
    return config.minRowSpan || config.minSpan;
}
