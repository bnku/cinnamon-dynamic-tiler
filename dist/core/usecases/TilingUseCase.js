"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TilingUseCase = void 0;
const TilingEngine_1 = require("../TilingEngine");
class TilingUseCase {
    shell;
    cache;
    configProvider;
    static INVERSE_RESIZE_TTL_MS = 2500;
    static MAX_RESIZE_UNDO_DEPTH = 16;
    resizeTransactions = [];
    cacheWriteGeneration = 0;
    constructor(shell, cache, configProvider) {
        this.shell = shell;
        this.cache = cache;
        this.configProvider = configProvider;
    }
    tile(direction) {
        // 0. Получаем конфигурацию
        const config = this.configProvider.getConfig();
        const configForMonitor = (monitor) => this.configProvider.getConfigForMonitor
            ? this.configProvider.getConfigForMonitor(monitor)
            : config;
        // 1. Получаем ID активного окна
        const windowId = this.shell.getActiveWindowId();
        if (!windowId) {
            throw new Error('Could not retrieve active window ID.');
        }
        // 2. Получаем физическую геометрию окна, тени и список мониторов
        const windowGeom = this.shell.getWindowGeometry(windowId);
        const extents = this.shell.getFrameExtents(windowId);
        const monitors = this.shell.getActiveMonitors();
        // 3. Определяем текущий монитор активного окна
        const activeMonitor = this.shell.findMonitorForWindow(windowGeom, monitors);
        const activeConfig = configForMonitor(activeMonitor);
        // 4. Сканируем видимые окна и фильтруем активные затайленные на этом мониторе
        const visibleWindowIds = this.shell.getVisibleWindowIds();
        const allCached = this.cache.getAllCachedWindows();
        const activeWindowsOnMonitor = [];
        // Проверяем Smart Reset (ручное изменение размеров) только для самого АКТИВНОГО окна
        let activeWindowIsResized = false;
        let activeWindowPhysicalState = null;
        const activeCached = allCached[windowId];
        if (activeCached) {
            try {
                const currentGeom = this.shell.getWindowGeometry(windowId);
                const ext = this.shell.getFrameExtents(windowId);
                const currentVisible = {
                    x: currentGeom.x + ext.left,
                    y: currentGeom.y + ext.top,
                    width: currentGeom.width - ext.left - ext.right,
                    height: currentGeom.height - ext.top - ext.bottom,
                };
                const diffX = Math.abs(currentVisible.x - activeCached.tiledGeometry.x);
                const diffY = Math.abs(currentVisible.y - activeCached.tiledGeometry.y);
                const diffW = Math.abs(currentVisible.width - activeCached.tiledGeometry.width);
                const diffH = Math.abs(currentVisible.height - activeCached.tiledGeometry.height);
                const currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);
                const currentConfig = configForMonitor(currentMonitor);
                const hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
                const vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);
                const spanChanged = !this.spansEqual(hSpan, activeCached.state.hSpan) || !this.spansEqual(vSpan, activeCached.state.vSpan);
                const THRESHOLD = 80;
                if (spanChanged || diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD) {
                    activeWindowIsResized = true;
                    activeWindowPhysicalState = {
                        state: {
                            ...activeCached.state,
                            hSpan,
                            vSpan,
                            hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                            vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan)
                        },
                        visibleGeometry: currentVisible,
                        frameGeometry: currentGeom,
                        monitor: currentMonitor
                    };
                }
            }
            catch {
                // Игнорируем ошибки для активного окна
            }
        }
        for (const id of visibleWindowIds) {
            let cachedWin = allCached[id];
            if (!cachedWin) {
                try {
                    const currentGeom = this.shell.getWindowGeometry(id);
                    const ext = this.shell.getFrameExtents(id);
                    const currentVisible = {
                        x: currentGeom.x + ext.left,
                        y: currentGeom.y + ext.top,
                        width: currentGeom.width - ext.left - ext.right,
                        height: currentGeom.height - ext.top - ext.bottom,
                    };
                    const currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);
                    // Convert current physical geometry to logical grid spans
                    const currentConfig = configForMonitor(currentMonitor);
                    const hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
                    const vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);
                    // Verify if window matches grid layout with small tolerance
                    const testState = {
                        hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                        vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan),
                        hSpan,
                        vSpan,
                        lastDirection: null
                    };
                    const idealGeom = TilingEngine_1.TilingEngine.stateToGeometry(testState, currentMonitor, currentConfig);
                    const diffX = Math.abs(currentVisible.x - idealGeom.x);
                    const diffY = Math.abs(currentVisible.y - idealGeom.y);
                    const diffW = Math.abs(currentVisible.width - idealGeom.width);
                    const diffH = Math.abs(currentVisible.height - idealGeom.height);
                    const SNAP_THRESHOLD = 80; // High tolerance for matching grid structures
                    if (diffX <= SNAP_THRESHOLD && diffY <= SNAP_THRESHOLD && diffW <= SNAP_THRESHOLD && diffH <= SNAP_THRESHOLD) {
                        // Check if there is already a tiled window in the cache that overlaps with this span on the same monitor
                        let hasOverlap = false;
                        for (const [cachedId, cachedW] of Object.entries(allCached)) {
                            if (cachedId === id)
                                continue;
                            let cachedMonitor = currentMonitor;
                            try {
                                const g = this.shell.getWindowGeometry(cachedId);
                                cachedMonitor = this.shell.findMonitorForWindow(g, monitors);
                            }
                            catch {
                                cachedMonitor = this.shell.findMonitorForWindow(cachedW.tiledGeometry, monitors);
                            }
                            if (cachedMonitor.id === currentMonitor.id) {
                                const hasH = Math.max(hSpan[0], cachedW.state.hSpan[0]) < Math.min(hSpan[1], cachedW.state.hSpan[1]);
                                const hasV = Math.max(vSpan[0], cachedW.state.vSpan[0]) < Math.min(vSpan[1], cachedW.state.vSpan[1]);
                                if (hasH && hasV) {
                                    hasOverlap = true;
                                    break;
                                }
                            }
                        }
                        if (!hasOverlap) {
                            const restoredState = {
                                hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                                vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan),
                                hSpan,
                                vSpan,
                                lastDirection: null
                            };
                            this.cache.saveState(id, restoredState, currentVisible, currentGeom);
                            cachedWin = this.cache.getCachedWindow(id);
                        }
                    }
                }
                catch {
                    // Ignore failures for individual windows
                }
            }
            if (!cachedWin)
                continue;
            let windowState = { ...cachedWin.state };
            let currentMonitor = activeMonitor;
            let currentGeom = cachedWin.tiledGeometry;
            if (id === windowId && activeWindowIsResized && activeWindowPhysicalState) {
                windowState = activeWindowPhysicalState.state;
                currentMonitor = activeWindowPhysicalState.monitor;
                currentGeom = activeWindowPhysicalState.frameGeometry;
                this.cache.saveState(id, windowState, activeWindowPhysicalState.visibleGeometry, cachedWin.originalGeometry || currentGeom);
            }
            else {
                try {
                    currentGeom = this.shell.getWindowGeometry(id);
                    const ext = this.shell.getFrameExtents(id);
                    const currentVisible = {
                        x: currentGeom.x + ext.left,
                        y: currentGeom.y + ext.top,
                        width: currentGeom.width - ext.left - ext.right,
                        height: currentGeom.height - ext.top - ext.bottom,
                    };
                    currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);
                    if (id !== windowId) {
                        if (currentMonitor.id !== activeMonitor.id) {
                            continue;
                        }
                        const diffX = Math.abs(currentVisible.x - cachedWin.tiledGeometry.x);
                        const diffY = Math.abs(currentVisible.y - cachedWin.tiledGeometry.y);
                        const diffW = Math.abs(currentVisible.width - cachedWin.tiledGeometry.width);
                        const diffH = Math.abs(currentVisible.height - cachedWin.tiledGeometry.height);
                        const currentConfig = configForMonitor(currentMonitor);
                        const hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
                        const vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);
                        const spanChanged = !this.spansEqual(hSpan, cachedWin.state.hSpan) || !this.spansEqual(vSpan, cachedWin.state.vSpan);
                        const THRESHOLD = 80;
                        if (spanChanged || diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD) {
                            windowState = {
                                ...cachedWin.state,
                                hSpan,
                                vSpan,
                                hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                                vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan)
                            };
                            this.cache.saveState(id, windowState, currentVisible, cachedWin.originalGeometry || currentGeom);
                        }
                    }
                }
                catch {
                    currentMonitor = this.shell.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
                    if (id !== windowId && currentMonitor.id !== activeMonitor.id) {
                        continue;
                    }
                }
            }
            if (id === windowId) {
                if (currentMonitor.id !== activeMonitor.id)
                    continue;
            }
            const isOldStateSchema = typeof windowState.hIndex !== 'number' || typeof windowState.vIndex !== 'number';
            if (isOldStateSchema)
                continue;
            activeWindowsOnMonitor.push({
                windowId: id,
                state: windowState
            });
        }
        const undoTransaction = this.getUndoResizeTransaction(windowId, direction, activeMonitor.id, activeWindowsOnMonitor, activeMonitor, activeConfig);
        if (undoTransaction) {
            const operationId = this.nextCacheWriteGeneration();
            const axis = this.resizeAxis(direction);
            this.applyStates(undoTransaction.before, windowId, activeMonitor, activeConfig, operationId);
            if (axis) {
                this.refreshUndoStack(windowId, activeMonitor.id, axis);
            }
            return;
        }
        // 5. Рассчитываем переходы цепного тайлинга окон
        const beforeStates = this.captureStates(activeWindowsOnMonitor);
        const chainStates = TilingEngine_1.TilingEngine.calculateChainTransitions(windowId, direction, activeConfig, activeWindowsOnMonitor);
        const operationId = this.nextCacheWriteGeneration();
        // 6. Применяем новые размеры сначала ко всем соседям цепочки
        for (const [id, nextState] of Object.entries(chainStates)) {
            if (id === windowId)
                continue;
            try {
                const cachedWin = allCached[id];
                const currentGeom = this.shell.getWindowGeometry(id);
                const originalGeom = cachedWin ? (cachedWin.originalGeometry || currentGeom) : currentGeom;
                const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(nextState, activeMonitor, activeConfig);
                this.shell.unmaximizeWindow(id);
                this.shell.applyGeometry(id, nextGeom);
                // Delay caching slightly to read the actual physical geometry from Mutter
                setTimeout(() => {
                    if (operationId !== this.cacheWriteGeneration)
                        return;
                    try {
                        const realGeom = this.shell.getWindowGeometry(id);
                        this.cache.saveState(id, nextState, realGeom, originalGeom);
                    }
                    catch {
                        this.cache.saveState(id, nextState, nextGeom, originalGeom);
                    }
                }, 100);
            }
            catch {
                // Игнорируем ошибки для отдельных окон
            }
        }
        // 7. Применяем изменения к активному окну в конце
        const activeNextState = chainStates[windowId];
        if (activeNextState) {
            const cachedWin = allCached[windowId];
            const originalGeom = cachedWin ? (cachedWin.originalGeometry || windowGeom) : windowGeom;
            const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(activeNextState, activeMonitor, activeConfig);
            try {
                this.shell.unmaximizeWindow(windowId);
                this.shell.applyGeometry(windowId, nextGeom);
                // Delay caching slightly to read the actual physical geometry from Mutter
                setTimeout(() => {
                    if (operationId !== this.cacheWriteGeneration)
                        return;
                    try {
                        const realGeom = this.shell.getWindowGeometry(windowId);
                        this.cache.saveState(windowId, activeNextState, realGeom, originalGeom);
                    }
                    catch {
                        this.cache.saveState(windowId, activeNextState, nextGeom, originalGeom);
                    }
                }, 100);
                this.shell.raiseWindow(windowId);
            }
            catch {
                // Игнорируем ошибки для активного окна
            }
        }
        this.rememberResizeTransaction(windowId, direction, activeMonitor.id, beforeStates, chainStates);
    }
    restore() {
        const windowId = this.shell.getActiveWindowId();
        if (!windowId) {
            throw new Error('Could not retrieve active window ID.');
        }
        const cached = this.cache.getCachedWindow(windowId);
        if (cached && cached.originalGeometry) {
            this.shell.unmaximizeWindow(windowId);
            this.shell.applyGeometry(windowId, cached.originalGeometry);
            this.cache.clearState(windowId);
        }
        else {
            throw new Error('No original geometry saved for this window.');
        }
    }
    clearCache() {
        const windowId = this.shell.getActiveWindowId();
        if (windowId) {
            this.cache.clearState(windowId);
        }
        else {
            throw new Error('Could not get active window ID for clearing cache.');
        }
    }
    nextCacheWriteGeneration() {
        this.cacheWriteGeneration += 1;
        return this.cacheWriteGeneration;
    }
    captureStates(windows) {
        const states = {};
        for (const win of windows) {
            states[win.windowId] = this.cloneState(win.state);
        }
        return states;
    }
    cloneState(state) {
        return {
            ...state,
            hSpan: [...state.hSpan],
            vSpan: [...state.vSpan]
        };
    }
    rememberResizeTransaction(windowId, direction, monitorId, before, after) {
        const axis = this.resizeAxis(direction);
        if (!axis || !this.hasMeaningfulResize(before, after, axis)) {
            this.pruneResizeTransactions();
            return;
        }
        const plainDirection = direction;
        const clonedAfter = {};
        for (const [id, state] of Object.entries(after)) {
            clonedAfter[id] = this.cloneState(state);
        }
        this.pruneResizeTransactions();
        this.resizeTransactions.push({
            windowId,
            monitorId,
            axis,
            direction: plainDirection,
            expiresAt: Date.now() + TilingUseCase.INVERSE_RESIZE_TTL_MS,
            before,
            after: clonedAfter
        });
        if (this.resizeTransactions.length > TilingUseCase.MAX_RESIZE_UNDO_DEPTH) {
            this.resizeTransactions = this.resizeTransactions.slice(-TilingUseCase.MAX_RESIZE_UNDO_DEPTH);
        }
    }
    getUndoResizeTransaction(windowId, direction, monitorId, activeWindows, monitor, config) {
        const axis = this.resizeAxis(direction);
        if (!axis)
            return null;
        this.pruneResizeTransactions();
        for (let i = this.resizeTransactions.length - 1; i >= 0; i -= 1) {
            const transaction = this.resizeTransactions[i];
            if (transaction.windowId !== windowId ||
                transaction.monitorId !== monitorId ||
                transaction.axis !== axis ||
                this.oppositeDirection(transaction.direction) !== direction) {
                continue;
            }
            const currentStates = this.capturePhysicalStates(activeWindows, Object.keys(transaction.after), monitor, config);
            let matches = true;
            for (const [id, expectedAfter] of Object.entries(transaction.after)) {
                const current = currentStates[id];
                if (!current || !this.statesHaveSameSpans(current, expectedAfter)) {
                    matches = false;
                    break;
                }
            }
            if (!matches)
                return null;
            this.resizeTransactions.splice(i, 1);
            return transaction;
        }
        return null;
    }
    pruneResizeTransactions() {
        const now = Date.now();
        this.resizeTransactions = this.resizeTransactions.filter(transaction => transaction.expiresAt >= now);
    }
    refreshUndoStack(windowId, monitorId, axis) {
        const expiresAt = Date.now() + TilingUseCase.INVERSE_RESIZE_TTL_MS;
        for (const transaction of this.resizeTransactions) {
            if (transaction.windowId === windowId && transaction.monitorId === monitorId && transaction.axis === axis) {
                transaction.expiresAt = expiresAt;
            }
        }
    }
    capturePhysicalStates(fallbackWindows, windowIds, monitor, config) {
        const fallbackStates = this.captureStates(fallbackWindows);
        const states = {};
        for (const id of windowIds) {
            try {
                const frame = this.shell.getWindowGeometry(id);
                const ext = this.shell.getFrameExtents(id);
                const visible = {
                    x: frame.x + ext.left,
                    y: frame.y + ext.top,
                    width: frame.width - ext.left - ext.right,
                    height: frame.height - ext.top - ext.bottom,
                };
                const hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(visible, monitor, config);
                const vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(visible, monitor, config);
                states[id] = {
                    ...(fallbackStates[id] || TilingEngine_1.TilingEngine.getDefaultState()),
                    hSpan,
                    vSpan,
                    hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                    vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan)
                };
            }
            catch {
                if (fallbackStates[id]) {
                    states[id] = fallbackStates[id];
                }
            }
        }
        return states;
    }
    applyStates(states, activeId, monitor, config, operationId) {
        for (const [id, state] of Object.entries(states)) {
            if (id === activeId)
                continue;
            this.applySingleState(id, state, monitor, config, operationId, false);
        }
        const activeState = states[activeId];
        if (activeState) {
            this.applySingleState(activeId, activeState, monitor, config, operationId, true);
        }
    }
    applySingleState(id, state, monitor, config, operationId, raise) {
        try {
            const currentGeom = this.shell.getWindowGeometry(id);
            const cachedWin = this.cache.getCachedWindow(id);
            const originalGeom = cachedWin ? (cachedWin.originalGeometry || currentGeom) : currentGeom;
            const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(state, monitor, config);
            this.shell.unmaximizeWindow(id);
            this.shell.applyGeometry(id, nextGeom);
            setTimeout(() => {
                if (operationId !== this.cacheWriteGeneration)
                    return;
                try {
                    const realGeom = this.shell.getWindowGeometry(id);
                    this.cache.saveState(id, state, realGeom, originalGeom);
                }
                catch {
                    this.cache.saveState(id, state, nextGeom, originalGeom);
                }
            }, 100);
            if (raise) {
                this.shell.raiseWindow(id);
            }
        }
        catch {
            // Игнорируем ошибки для отдельных окон
        }
    }
    resizeAxis(direction) {
        if (direction === 'left' || direction === 'right')
            return 'horizontal';
        if (direction === 'up' || direction === 'down')
            return 'vertical';
        return null;
    }
    oppositeDirection(direction) {
        switch (direction) {
            case 'left':
                return 'right';
            case 'right':
                return 'left';
            case 'up':
                return 'down';
            case 'down':
                return 'up';
        }
    }
    hasMeaningfulResize(before, after, axis) {
        for (const [id, afterState] of Object.entries(after)) {
            const beforeState = before[id];
            if (!beforeState)
                continue;
            if (axis === 'horizontal' && !this.spansEqual(beforeState.hSpan, afterState.hSpan)) {
                return true;
            }
            if (axis === 'vertical' && !this.spansEqual(beforeState.vSpan, afterState.vSpan)) {
                return true;
            }
        }
        return false;
    }
    statesHaveSameSpans(a, b) {
        return this.spansEqual(a.hSpan, b.hSpan) && this.spansEqual(a.vSpan, b.vSpan);
    }
    spansEqual(a, b) {
        return a[0] === b[0] && a[1] === b[1];
    }
}
exports.TilingUseCase = TilingUseCase;
