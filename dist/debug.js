"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_1 = require("./adapter");
const cache_1 = require("./cache");
const engine_1 = require("./engine");
function runDebug() {
    console.log('=== DYNAMIC TILER DEBUG ===');
    const activeId = adapter_1.ShellAdapter.getActiveWindowId();
    console.log('Active Window ID:', activeId);
    try {
        const activeTitle = adapter_1.ShellAdapter.getWindowGeometry(activeId);
        console.log('Active Window Geometry:', activeTitle);
    }
    catch (e) {
        console.log('Error getting active window geom:', e.message);
    }
    const monitors = adapter_1.ShellAdapter.getActiveMonitors();
    console.log('\nMonitors count:', monitors.length);
    monitors.forEach((m, idx) => {
        console.log(`Monitor ${idx}: id=${m.id}, w=${m.width}, h=${m.height}, x=${m.x}, y=${m.y}, workarea=`, m.workarea);
    });
    const visibleWindowIds = adapter_1.ShellAdapter.getVisibleWindowIds();
    console.log('\nVisible windows count:', visibleWindowIds.length);
    const allCached = cache_1.CacheManager.getAllCachedWindows();
    console.log('Cached windows count:', Object.keys(allCached).length);
    const activeMonitor = adapter_1.ShellAdapter.findMonitorForWindow(adapter_1.ShellAdapter.getWindowGeometry(activeId), monitors);
    console.log('\nActive window resides on monitor:', activeMonitor.id);
    console.log('\nScanning visible windows and testing filters:');
    for (const id of visibleWindowIds) {
        const cachedWin = allCached[id];
        if (!cachedWin)
            continue;
        const monitor = adapter_1.ShellAdapter.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
        const isSameMonitor = monitor.id === activeMonitor.id;
        try {
            const currentGeom = adapter_1.ShellAdapter.getWindowGeometry(id);
            const ext = adapter_1.ShellAdapter.getFrameExtents(id);
            const currentVisible = {
                x: currentGeom.x + ext.left,
                y: currentGeom.y + ext.top,
                width: currentGeom.width - ext.left - ext.right,
                height: currentGeom.height - ext.top - ext.bottom,
            };
            const diffX = Math.abs(currentVisible.x - cachedWin.tiledGeometry.x);
            const diffY = Math.abs(currentVisible.y - cachedWin.tiledGeometry.y);
            const diffW = Math.abs(currentVisible.width - cachedWin.tiledGeometry.width);
            const diffH = Math.abs(currentVisible.height - cachedWin.tiledGeometry.height);
            const THRESHOLD = 80;
            const wasResizedManually = diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD;
            const isOldStateSchema = typeof cachedWin.state.hIndex !== 'number' || typeof cachedWin.state.vIndex !== 'number';
            console.log(`- Window ID ${id} (cached):`);
            console.log(`  hSpan: [${cachedWin.state.hSpan.join(', ')}]`);
            console.log(`  Belongs to active monitor? ${isSameMonitor} (window monitor=${monitor.id})`);
            console.log(`  Current Visible:`, currentVisible);
            console.log(`  Tiled Geometry:`, cachedWin.tiledGeometry);
            console.log(`  Diffs: dX=${diffX}, dY=${diffY}, dW=${diffW}, dH=${diffH}`);
            console.log(`  wasResizedManually? ${wasResizedManually}`);
            console.log(`  isOldStateSchema? ${isOldStateSchema}`);
            console.log(`  Will be included in activeWindowsOnMonitor? ${isSameMonitor && !wasResizedManually && !isOldStateSchema}`);
        }
        catch (e) {
            console.log(`- Window ID ${id}: Failed to check: ${e.message}`);
        }
    }
    // Тест перехода для окна dev (90664135)
    console.log('\n=== TESTING TRANSITION FOR dev WINDOW (90664135) WITH right ===');
    const devId = '90664135';
    // Строим список activeWindowsOnMonitor для теста
    const activeWindowsOnMonitor = [];
    for (const id of visibleWindowIds) {
        const cachedWin = allCached[id];
        if (!cachedWin)
            continue;
        const monitor = adapter_1.ShellAdapter.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
        if (monitor.id !== activeMonitor.id)
            continue;
        try {
            const currentGeom = adapter_1.ShellAdapter.getWindowGeometry(id);
            const ext = adapter_1.ShellAdapter.getFrameExtents(id);
            const currentVisible = {
                x: currentGeom.x + ext.left,
                y: currentGeom.y + ext.top,
                width: currentGeom.width - ext.left - ext.right,
                height: currentGeom.height - ext.top - ext.bottom,
            };
            const diffX = Math.abs(currentVisible.x - cachedWin.tiledGeometry.x);
            const diffY = Math.abs(currentVisible.y - cachedWin.tiledGeometry.y);
            const diffW = Math.abs(currentVisible.width - cachedWin.tiledGeometry.width);
            const diffH = Math.abs(currentVisible.height - cachedWin.tiledGeometry.height);
            const THRESHOLD = 80;
            const wasResizedManually = diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD;
            const isOldStateSchema = typeof cachedWin.state.hIndex !== 'number' || typeof cachedWin.state.vIndex !== 'number';
            if (!wasResizedManually && !isOldStateSchema) {
                activeWindowsOnMonitor.push({
                    windowId: id,
                    state: cachedWin.state
                });
            }
        }
        catch { }
    }
    const config = { horizontalFractions: [2, 3, 4], verticalFractions: [2, 3, 4], gaps: 0 };
    const chainStates = engine_1.TilingEngine.calculateChainTransitions(devId, 'right', config, activeWindowsOnMonitor);
    console.log('Resulting chain states:');
    for (const [id, stateVal] of Object.entries(chainStates)) {
        const state = stateVal;
        console.log(`- Window ID ${id}: hSpan=[${state.hSpan.join(', ')}], vSpan=[${state.vSpan.join(', ')}], lastDirection=${state.lastDirection}`);
    }
}
runDebug();
