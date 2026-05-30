"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldFloatAfterModifierRelease = shouldFloatAfterModifierRelease;
exports.hasLayoutOverlaps = hasLayoutOverlaps;
exports.solveDragTransitions = solveDragTransitions;
exports.restoreDragTransaction = restoreDragTransaction;
exports.restoreDragTransactionHistory = restoreDragTransactionHistory;
exports.computeDragTarget = computeDragTarget;
exports.calculateDragTransitions = calculateDragTransitions;
exports.collapseVacancy = collapseVacancy;
const TilingEngine_1 = require("./core/TilingEngine");
function hasSpanOverlap(spanA, spanB) {
    return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
}
function spansEqual(spanA, spanB) {
    return Boolean(spanA && spanB && spanA[0] === spanB[0] && spanA[1] === spanB[1]);
}
function shouldFloatAfterModifierRelease(input) {
    const distance = Math.hypot(input.pointerX - input.startPointerX, input.pointerY - input.startPointerY);
    const movementThreshold = input.thresholdPixels ?? 80;
    return distance >= movementThreshold;
}
function hasLayoutOverlaps(states) {
    const entries = Object.entries(states);
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i][1];
            const b = entries[j][1];
            if (hasSpanOverlap(a.hSpan, b.hSpan) && hasSpanOverlap(a.vSpan, b.vSpan)) {
                return true;
            }
        }
    }
    return false;
}
function solveDragTransitions(draggedId, targetHSpan, targetVSpan, config, activeWindows, options = {}) {
    const states = calculateDragTransitions(draggedId, targetHSpan, targetVSpan, config, activeWindows, options);
    const reason = getDragBlockReason(states, config);
    return {
        status: reason ? 'blocked' : 'valid',
        states,
        affected: getAffectedWindowIds(states, activeWindows),
        reason
    };
}
function getDragBlockReason(states, config) {
    for (const state of Object.values(states)) {
        if (state.hSpan[0] < 0 ||
            state.vSpan[0] < 0 ||
            state.hSpan[1] > config.gridSize ||
            state.vSpan[1] > config.gridSize ||
            state.hSpan[0] >= state.hSpan[1] ||
            state.vSpan[0] >= state.vSpan[1]) {
            return 'outOfBounds';
        }
        if (state.hSpan[1] - state.hSpan[0] < config.minSpan ||
            state.vSpan[1] - state.vSpan[0] < config.minSpan) {
            return 'tooSmall';
        }
    }
    if (hasLayoutOverlaps(states)) {
        return 'wouldOverlap';
    }
    return undefined;
}
function cloneWindowState(state) {
    return {
        hIndex: state.hIndex,
        vIndex: state.vIndex,
        hSpan: [...state.hSpan],
        vSpan: [...state.vSpan],
        lastDirection: state.lastDirection
    };
}
function statesEqual(a, b) {
    if (!a || !b)
        return false;
    return a.hSpan[0] === b.hSpan[0] &&
        a.hSpan[1] === b.hSpan[1] &&
        a.vSpan[0] === b.vSpan[0] &&
        a.vSpan[1] === b.vSpan[1];
}
function restoreDragTransaction(snapshot, draggedId, config, activeWindows) {
    if (!snapshot || snapshot.draggedId !== draggedId)
        return null;
    const currentStates = new Map(activeWindows.map(w => [w.windowId, w.state]));
    if (!statesEqual(currentStates.get(draggedId), snapshot.afterStates[draggedId])) {
        return null;
    }
    const idsToRestore = snapshot.affected
        .filter(id => id !== draggedId && snapshot.beforeStates[id] && snapshot.afterStates[id])
        .sort((a, b) => a.localeCompare(b));
    if (idsToRestore.length === 0)
        return null;
    for (const id of idsToRestore) {
        if (!statesEqual(currentStates.get(id), snapshot.afterStates[id])) {
            return null;
        }
    }
    const restoredStates = {};
    for (const w of activeWindows) {
        if (w.windowId === draggedId)
            continue;
        restoredStates[w.windowId] = cloneWindowState(w.state);
    }
    for (const id of idsToRestore) {
        restoredStates[id] = cloneWindowState(snapshot.beforeStates[id]);
    }
    if (getDragBlockReason(restoredStates, config)) {
        return null;
    }
    return restoredStates;
}
function restoreDragTransactionHistory(snapshots, draggedId, monitorId, config, activeWindows) {
    for (let i = snapshots.length - 1; i >= 0; i--) {
        const snapshot = snapshots[i];
        if (snapshot.draggedId !== draggedId || snapshot.monitorId !== monitorId) {
            continue;
        }
        const states = restoreDragTransaction(snapshot, draggedId, config, activeWindows);
        if (states) {
            return {
                states,
                snapshotIndex: i
            };
        }
    }
    return null;
}
function getAffectedWindowIds(states, activeWindows) {
    const originalStates = new Map(activeWindows.map(w => [w.windowId, w.state]));
    return Object.keys(states)
        .filter(id => {
        const previous = originalStates.get(id);
        if (!previous)
            return true;
        const next = states[id];
        return previous.hSpan[0] !== next.hSpan[0] ||
            previous.hSpan[1] !== next.hSpan[1] ||
            previous.vSpan[0] !== next.vSpan[0] ||
            previous.vSpan[1] !== next.vSpan[1];
    })
        .sort((a, b) => a.localeCompare(b));
}
function spanSize(span) {
    return span[1] - span[0];
}
function stateArea(state) {
    return spanSize(state.hSpan) * spanSize(state.vSpan);
}
function stateDelta(previous, next) {
    return Math.abs(previous.hSpan[0] - next.hSpan[0]) +
        Math.abs(previous.hSpan[1] - next.hSpan[1]) +
        Math.abs(previous.vSpan[0] - next.vSpan[0]) +
        Math.abs(previous.vSpan[1] - next.vSpan[1]);
}
function scoreDragLayoutCandidate(states, config, activeWindows, draggedId, order = 0) {
    const reason = getDragBlockReason(states, config);
    const invalidPenalty = reason === 'outOfBounds' ? 1_000_000_000 :
        reason === 'tooSmall' ? 900_000_000 :
            reason === 'wouldOverlap' ? 800_000_000 :
                0;
    const originalStates = new Map(activeWindows.map(w => [w.windowId, w.state]));
    const affected = getAffectedWindowIds(states, activeWindows);
    let score = invalidPenalty + affected.length * 10_000 + order / 1_000;
    for (const id of affected) {
        const previous = originalStates.get(id);
        const next = states[id];
        if (!next)
            continue;
        if (!previous) {
            score += id === draggedId ? 0 : 50_000;
            continue;
        }
        const isDragged = id === draggedId;
        const movement = stateDelta(previous, next);
        const areaDelta = Math.abs(stateArea(previous) - stateArea(next));
        score += (isDragged ? 0 : 1_000) + movement * (isDragged ? 5 : 100) + areaDelta * (isDragged ? 2 : 25);
    }
    return score;
}
function computeDragTarget(input) {
    const { draggedId, mx, my, monitor, config, activeWindows } = input;
    const { workarea } = monitor;
    const colWidth = workarea.width / config.gridSize;
    const rowHeight = workarea.height / config.gridSize;
    const intentPoint = {
        h: (mx - workarea.x) / colWidth,
        v: (my - workarea.y) / rowHeight
    };
    const targetWidth = Math.max(config.minSpan, Math.min(config.gridSize, input.preferredWidth));
    let startCol = Math.round(intentPoint.h - targetWidth / 2);
    if (startCol + targetWidth > config.gridSize) {
        startCol = config.gridSize - targetWidth;
    }
    if (startCol < 0)
        startCol = 0;
    let targetHSpan = [startCol, startCol + targetWidth];
    const initialHSpan = [...targetHSpan];
    const ratioY = (my - workarea.y) / workarea.height;
    const midGrid = Math.round(config.gridSize / 2);
    let targetVSpan;
    const previousVSpan = input.previousTarget?.targetVSpan;
    const shouldKeepTopHalf = spansEqual(previousVSpan, [0, midGrid]) && ratioY < 0.32;
    const shouldKeepBottomHalf = spansEqual(previousVSpan, [midGrid, config.gridSize]) && ratioY > 0.68;
    const shouldKeepFullHeight = spansEqual(previousVSpan, [0, config.gridSize]) && ratioY >= 0.24 && ratioY <= 0.76;
    if (shouldKeepTopHalf || (!shouldKeepBottomHalf && !shouldKeepFullHeight && ratioY < 0.28)) {
        targetVSpan = [0, midGrid];
    }
    else if (shouldKeepBottomHalf || (!shouldKeepTopHalf && !shouldKeepFullHeight && ratioY > 0.72)) {
        targetVSpan = [midGrid, config.gridSize];
    }
    else {
        targetVSpan = [0, config.gridSize];
    }
    const initialVSpan = [...targetVSpan];
    const allStackWindowCandidates = activeWindows
        .filter(w => w.windowId !== draggedId)
        .map(w => ({
        ...w,
        hOverlap: Math.max(0, Math.min(targetHSpan[1], w.state.hSpan[1]) - Math.max(targetHSpan[0], w.state.hSpan[0]))
    }));
    const stackWindows = allStackWindowCandidates
        .filter(w => w.hOverlap > 0)
        .sort((a, b) => b.hOverlap - a.hOverlap ||
        a.state.vSpan[0] - b.state.vSpan[0] ||
        a.windowId.localeCompare(b.windowId));
    const stackGroups = new Map();
    for (const w of allStackWindowCandidates) {
        const key = `${w.state.hSpan[0]}:${w.state.hSpan[1]}`;
        const existing = stackGroups.get(key);
        if (existing) {
            existing.windows.push(w);
        }
        else {
            stackGroups.set(key, {
                hSpan: [...w.state.hSpan],
                windows: [w]
            });
        }
    }
    const stackGroupCandidates = Array.from(stackGroups.values())
        .map(group => {
        const containsCursor = intentPoint.h >= group.hSpan[0] && intentPoint.h <= group.hSpan[1];
        const hDistance = containsCursor
            ? 0
            : Math.min(Math.abs(intentPoint.h - group.hSpan[0]), Math.abs(intentPoint.h - group.hSpan[1]));
        return {
            ...group,
            containsCursor,
            hDistance,
            width: group.hSpan[1] - group.hSpan[0]
        };
    })
        .filter(group => group.containsCursor || group.hDistance <= 0.5)
        .sort((a, b) => Number(b.containsCursor) - Number(a.containsCursor) ||
        a.hDistance - b.hDistance ||
        b.windows.length - a.windows.length ||
        a.width - b.width ||
        a.hSpan[0] - b.hSpan[0]);
    const cursorVerticalGroup = stackGroupCandidates[0];
    const shouldPreferVerticalStack = (() => {
        if (!cursorVerticalGroup)
            return false;
        const cursorRow = intentPoint.v;
        const boundaries = [0, config.gridSize];
        for (const w of cursorVerticalGroup.windows) {
            boundaries.push(w.state.vSpan[0], w.state.vSpan[1]);
        }
        const uniqueBoundaries = Array.from(new Set(boundaries))
            .filter(v => v >= 0 && v <= config.gridSize)
            .sort((a, b) => a - b);
        let nearestDistance = Infinity;
        for (const boundary of uniqueBoundaries) {
            nearestDistance = Math.min(nearestDistance, Math.abs(cursorRow - boundary));
        }
        const stackTargetHeight = Math.max(config.minSpan, (cursorVerticalGroup.windows.length + 1) * config.minSpan <= config.gridSize
            ? Math.round(config.gridSize / (cursorVerticalGroup.windows.length + 1))
            : config.minSpan);
        const canFitStackVertically = (cursorVerticalGroup.windows.length + 1) * config.minSpan <= config.gridSize;
        const canUseHorizontalRelief = cursorVerticalGroup.width < config.gridSize;
        return nearestDistance <= Math.max(1, stackTargetHeight / 2) &&
            (canFitStackVertically || canUseHorizontalRelief);
    })();
    const horizontalGroups = new Map();
    for (const w of allStackWindowCandidates) {
        const key = `${w.state.vSpan[0]}:${w.state.vSpan[1]}`;
        const existing = horizontalGroups.get(key);
        if (existing) {
            existing.windows.push(w);
        }
        else {
            horizontalGroups.set(key, {
                vSpan: [...w.state.vSpan],
                windows: [w]
            });
        }
    }
    const nearHorizontalScreenEdge = intentPoint.h <= 0.65 ||
        intentPoint.h >= config.gridSize - 0.65;
    const targetOverlapsLeftEdgeWindow = allStackWindowCandidates.some(w => w.state.hSpan[0] <= 0 &&
        w.state.hSpan[1] - w.state.hSpan[0] <= config.minSpan &&
        targetHSpan[0] <= w.state.hSpan[1] + 1 &&
        hasSpanOverlap(targetVSpan, w.state.vSpan) &&
        intentPoint.h <= w.state.hSpan[1] + 1);
    const targetOverlapsRightEdgeWindow = allStackWindowCandidates.some(w => w.state.hSpan[1] >= config.gridSize &&
        w.state.hSpan[1] - w.state.hSpan[0] <= config.minSpan &&
        targetHSpan[1] >= w.state.hSpan[0] - 1 &&
        hasSpanOverlap(targetVSpan, w.state.vSpan) &&
        intentPoint.h >= w.state.hSpan[0] - 1);
    const targetTouchesHorizontalScreenEdge = targetHSpan[0] <= 0 ||
        targetHSpan[1] >= config.gridSize ||
        targetOverlapsLeftEdgeWindow ||
        targetOverlapsRightEdgeWindow;
    const horizontalGroupCandidates = Array.from(horizontalGroups.values())
        .filter(group => group.windows.length >= 2 || nearHorizontalScreenEdge || targetTouchesHorizontalScreenEdge)
        .map(group => {
        const containsCursor = intentPoint.v >= group.vSpan[0] && intentPoint.v <= group.vSpan[1];
        const vDistance = containsCursor
            ? 0
            : Math.min(Math.abs(intentPoint.v - group.vSpan[0]), Math.abs(intentPoint.v - group.vSpan[1]));
        return {
            ...group,
            containsCursor,
            vDistance,
            height: group.vSpan[1] - group.vSpan[0]
        };
    })
        .filter(group => group.containsCursor || group.vDistance <= 0.5)
        .sort((a, b) => Number(b.containsCursor) - Number(a.containsCursor) ||
        a.vDistance - b.vDistance ||
        b.windows.length - a.windows.length ||
        a.height - b.height ||
        a.vSpan[0] - b.vSpan[0]);
    let usedHorizontalStackTarget = false;
    const cursorHorizontalGroup = horizontalGroupCandidates[0];
    const debug = {
        mode: 'base',
        preferredWidth: input.preferredWidth,
        preferredHeight: input.preferredHeight,
        targetWidth,
        initialHSpan,
        initialVSpan,
        verticalCandidates: stackGroupCandidates.length,
        horizontalCandidates: horizontalGroupCandidates.length,
        shouldPreferVerticalStack,
        verticalGroup: cursorVerticalGroup
            ? {
                hSpan: [...cursorVerticalGroup.hSpan],
                windows: cursorVerticalGroup.windows.length,
                containsCursor: cursorVerticalGroup.containsCursor,
                hDistance: cursorVerticalGroup.hDistance
            }
            : undefined,
        horizontalGroup: cursorHorizontalGroup
            ? {
                vSpan: [...cursorHorizontalGroup.vSpan],
                windows: cursorHorizontalGroup.windows.length,
                containsCursor: cursorHorizontalGroup.containsCursor,
                vDistance: cursorHorizontalGroup.vDistance
            }
            : undefined
    };
    if (cursorHorizontalGroup && !shouldPreferVerticalStack) {
        const cursorCol = intentPoint.h;
        const boundaries = [0, config.gridSize];
        for (const w of cursorHorizontalGroup.windows) {
            boundaries.push(w.state.hSpan[0], w.state.hSpan[1]);
        }
        const uniqueBoundaries = Array.from(new Set(boundaries))
            .filter(h => h >= 0 && h <= config.gridSize)
            .sort((a, b) => a - b);
        let nearestBoundary = uniqueBoundaries[0];
        let nearestDistance = Math.abs(cursorCol - nearestBoundary);
        if (targetHSpan[0] <= 0 || targetOverlapsLeftEdgeWindow) {
            nearestBoundary = 0;
            nearestDistance = Math.abs(cursorCol);
        }
        else if (targetHSpan[1] >= config.gridSize || targetOverlapsRightEdgeWindow) {
            nearestBoundary = config.gridSize;
            nearestDistance = Math.abs(cursorCol - config.gridSize);
        }
        else {
            for (const boundary of uniqueBoundaries) {
                const distance = Math.abs(cursorCol - boundary);
                if (distance < nearestDistance) {
                    nearestBoundary = boundary;
                    nearestDistance = distance;
                }
            }
        }
        let usesStickyHorizontalBoundary = false;
        const previousHorizontalBoundary = input.previousTarget?.debug.mode === 'horizontal-stack' &&
            spansEqual(input.previousTarget.targetVSpan, cursorHorizontalGroup.vSpan)
            ? input.previousTarget.debug.nearestBoundary
            : undefined;
        if (previousHorizontalBoundary !== undefined && uniqueBoundaries.includes(previousHorizontalBoundary)) {
            const previousDistance = Math.abs(cursorCol - previousHorizontalBoundary);
            const previousExitThreshold = Math.max(1, input.previousTarget?.debug.horizontalThreshold ?? 1) + 0.35;
            if (previousDistance <= previousExitThreshold) {
                nearestBoundary = previousHorizontalBoundary;
                nearestDistance = previousDistance;
                usesStickyHorizontalBoundary = true;
            }
        }
        const adjacentWindows = cursorHorizontalGroup.windows
            .filter(w => Math.abs(w.state.hSpan[0] - nearestBoundary) <= 1 ||
            Math.abs(w.state.hSpan[1] - nearestBoundary) <= 1);
        const adjacentWidths = adjacentWindows
            .map(w => w.state.hSpan[1] - w.state.hSpan[0])
            .filter(width => width >= config.minSpan);
        const requestedSlotWidth = Math.min(targetWidth, adjacentWidths.length > 0 ? Math.max(config.minSpan, Math.min(...adjacentWidths)) : targetWidth);
        const isScreenEdgeBoundary = nearestBoundary <= 0 || nearestBoundary >= config.gridSize;
        let slotWidth = requestedSlotWidth;
        if (!isScreenEdgeBoundary) {
            const canCarveSlot = (width) => {
                let start = Math.round(nearestBoundary - width / 2);
                if (start < 0)
                    start = 0;
                if (start + width > config.gridSize) {
                    start = config.gridSize - width;
                }
                const candidateHSpan = [start, start + width];
                for (const w of adjacentWindows) {
                    const overlap = Math.max(0, Math.min(candidateHSpan[1], w.state.hSpan[1]) - Math.max(candidateHSpan[0], w.state.hSpan[0]));
                    if (overlap > 0 && (w.state.hSpan[1] - w.state.hSpan[0] - overlap) < config.minSpan) {
                        return false;
                    }
                }
                return true;
            };
            for (let width = requestedSlotWidth; width >= config.minSpan; width--) {
                if (canCarveSlot(width)) {
                    slotWidth = width;
                    break;
                }
            }
        }
        const isWideTargetClampedToEdge = isScreenEdgeBoundary &&
            targetWidth > slotWidth &&
            ((nearestBoundary <= 0 && targetHSpan[0] <= 0) ||
                (nearestBoundary <= 0 && targetOverlapsLeftEdgeWindow) ||
                (nearestBoundary >= config.gridSize && targetHSpan[1] >= config.gridSize) ||
                (nearestBoundary >= config.gridSize && targetOverlapsRightEdgeWindow));
        const isMinimumEdgeNeighborInsertion = isScreenEdgeBoundary &&
            (targetOverlapsLeftEdgeWindow || targetOverlapsRightEdgeWindow);
        const horizontalThreshold = isScreenEdgeBoundary
            ? (isWideTargetClampedToEdge || isMinimumEdgeNeighborInsertion
                ? Math.max(0.65, targetWidth / 2 + slotWidth / 2, config.minSpan + 1)
                : Math.min(0.65, Math.max(0.35, slotWidth / 3)))
            : Math.max(1, requestedSlotWidth / 2);
        debug.nearestBoundary = nearestBoundary;
        debug.nearestDistance = nearestDistance;
        debug.slotWidth = slotWidth;
        debug.horizontalThreshold = horizontalThreshold;
        if (nearestDistance <= horizontalThreshold || usesStickyHorizontalBoundary) {
            targetVSpan = [...cursorHorizontalGroup.vSpan];
            if (nearestBoundary <= 0) {
                targetHSpan = [0, slotWidth];
            }
            else if (nearestBoundary >= config.gridSize) {
                targetHSpan = [config.gridSize - slotWidth, config.gridSize];
            }
            else {
                let boundaryStartCol = Math.round(nearestBoundary - slotWidth / 2);
                if (boundaryStartCol < 0)
                    boundaryStartCol = 0;
                if (boundaryStartCol + slotWidth > config.gridSize) {
                    boundaryStartCol = config.gridSize - slotWidth;
                }
                targetHSpan = [boundaryStartCol, boundaryStartCol + slotWidth];
            }
            usedHorizontalStackTarget = true;
            debug.mode = 'horizontal-stack';
        }
    }
    if (!usedHorizontalStackTarget && stackWindows.length > 0) {
        const targetSpanWidth = targetHSpan[1] - targetHSpan[0];
        const overlapBasedStackWindows = (() => {
            const maxOverlap = stackWindows[0].hOverlap;
            return stackWindows
                .filter(w => w.hOverlap === maxOverlap && w.hOverlap / targetSpanWidth >= 0.5)
                .sort((a, b) => a.state.vSpan[0] - b.state.vSpan[0] || a.windowId.localeCompare(b.windowId));
        })();
        const cursorStackGroup = cursorVerticalGroup;
        const columnStackWindows = cursorStackGroup
            ? cursorStackGroup.windows.sort((a, b) => a.state.vSpan[0] - b.state.vSpan[0] || a.windowId.localeCompare(b.windowId))
            : overlapBasedStackWindows;
        if (columnStackWindows.length > 0) {
            const cursorRow = intentPoint.v;
            const boundaries = [0, config.gridSize];
            for (const w of columnStackWindows) {
                boundaries.push(w.state.vSpan[0], w.state.vSpan[1]);
            }
            const uniqueBoundaries = Array.from(new Set(boundaries))
                .filter(v => v >= 0 && v <= config.gridSize)
                .sort((a, b) => a - b);
            let nearestBoundary = uniqueBoundaries[0];
            let nearestDistance = Math.abs(cursorRow - nearestBoundary);
            for (const boundary of uniqueBoundaries) {
                const distance = Math.abs(cursorRow - boundary);
                if (distance < nearestDistance) {
                    nearestBoundary = boundary;
                    nearestDistance = distance;
                }
            }
            const stackTargetHeight = Math.max(config.minSpan, (columnStackWindows.length + 1) * config.minSpan <= config.gridSize
                ? Math.round(config.gridSize / (columnStackWindows.length + 1))
                : config.minSpan);
            const boundaryThreshold = Math.max(1, stackTargetHeight / 2);
            const canFitStackVertically = (columnStackWindows.length + 1) * config.minSpan <= config.gridSize;
            const canUseHorizontalRelief = Boolean(cursorStackGroup && cursorStackGroup.width < config.gridSize);
            let usesStickyVerticalBoundary = false;
            const previousVerticalBoundary = input.previousTarget?.debug.mode === 'vertical-stack' &&
                cursorStackGroup &&
                spansEqual(input.previousTarget.targetHSpan, cursorStackGroup.hSpan)
                ? input.previousTarget.debug.nearestBoundary
                : undefined;
            if (previousVerticalBoundary !== undefined && uniqueBoundaries.includes(previousVerticalBoundary)) {
                const previousDistance = Math.abs(cursorRow - previousVerticalBoundary);
                if (previousDistance <= boundaryThreshold + 0.35) {
                    nearestBoundary = previousVerticalBoundary;
                    nearestDistance = previousDistance;
                    usesStickyVerticalBoundary = true;
                }
            }
            if ((nearestDistance <= boundaryThreshold || usesStickyVerticalBoundary) && (canFitStackVertically || canUseHorizontalRelief)) {
                debug.nearestBoundary = nearestBoundary;
                debug.nearestDistance = nearestDistance;
                debug.stackTargetHeight = stackTargetHeight;
                debug.boundaryThreshold = boundaryThreshold;
                debug.mode = 'vertical-stack';
                if (cursorStackGroup) {
                    targetHSpan = [...cursorStackGroup.hSpan];
                }
                if (nearestBoundary <= 0) {
                    targetVSpan = [0, stackTargetHeight];
                }
                else if (nearestBoundary >= config.gridSize) {
                    targetVSpan = [config.gridSize - stackTargetHeight, config.gridSize];
                }
                else {
                    let startRow = Math.round(nearestBoundary - stackTargetHeight / 2);
                    if (startRow < 0)
                        startRow = 0;
                    if (startRow + stackTargetHeight > config.gridSize) {
                        startRow = config.gridSize - stackTargetHeight;
                    }
                    targetVSpan = [startRow, startRow + stackTargetHeight];
                }
            }
        }
    }
    return {
        targetHSpan,
        targetVSpan,
        intentPoint,
        debug
    };
}
function calculateDragTransitions(draggedId, targetHSpan, targetVSpan, config, activeWindows, options = {}) {
    const states = {};
    const visited = new Set();
    const touched = new Set();
    // 1. Initialize states for all other windows on monitor
    const otherWindows = activeWindows
        .filter(w => w.windowId !== draggedId)
        .sort(compareWindowsByGridPosition);
    for (const w of otherWindows) {
        states[w.windowId] = {
            hIndex: w.state.hIndex,
            vIndex: w.state.vIndex,
            hSpan: [...(w.state.hSpan || [0, config.gridSize])],
            vSpan: [...(w.state.vSpan || [0, config.gridSize])],
            lastDirection: w.state.lastDirection
        };
    }
    const hasVerticalOverlap = (spanA, spanB) => {
        return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
    };
    const hasHorizontalOverlap = (spanA, spanB) => {
        return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
    };
    const spansEqual = (spanA, spanB) => {
        return spanA[0] === spanB[0] && spanA[1] === spanB[1];
    };
    const spanSize = (span) => span[1] - span[0];
    const spanCenter = (span) => (span[0] + span[1]) / 2;
    const cloneState = (state) => ({
        hIndex: state.hIndex,
        vIndex: state.vIndex,
        hSpan: [...state.hSpan],
        vSpan: [...state.vSpan],
        lastDirection: state.lastDirection
    });
    const updateIndexes = (state) => {
        state.hIndex = TilingEngine_1.TilingEngine.spanToHIndex(state.hSpan);
        state.vIndex = TilingEngine_1.TilingEngine.spanToVIndex(state.vSpan);
    };
    const setHSpan = (id, hSpan) => {
        const state = states[id];
        state.hSpan = hSpan;
        state.hIndex = TilingEngine_1.TilingEngine.spanToHIndex(hSpan);
        touched.add(id);
    };
    const setVSpan = (id, vSpan) => {
        const state = states[id];
        state.vSpan = vSpan;
        state.vIndex = TilingEngine_1.TilingEngine.spanToVIndex(vSpan);
        touched.add(id);
    };
    const cloneStates = (source) => {
        const cloned = {};
        for (const [id, state] of Object.entries(source)) {
            cloned[id] = cloneState(state);
        }
        return cloned;
    };
    const scoreCandidateStates = (candidateStates, order = 0) => scoreDragLayoutCandidate(candidateStates, config, activeWindows, draggedId, order);
    const applyCandidateStates = (candidateStates) => {
        for (const [id, nextState] of Object.entries(candidateStates)) {
            if (!states[id] || !statesEqual(states[id], nextState)) {
                states[id] = cloneState(nextState);
                touched.add(id);
            }
        }
    };
    const rectsOverlap = (a, b) => {
        return hasHorizontalOverlap(a.hSpan, b.hSpan) && hasVerticalOverlap(a.vSpan, b.vSpan);
    };
    const maybeSwapWindows = () => {
        if (!options.swapWindows || !options.intentPoint)
            return null;
        const draggedWin = activeWindows.find(w => w.windowId === draggedId);
        if (!draggedWin)
            return null;
        const draggedState = draggedWin.state;
        const targetWin = otherWindows.find(w => {
            const state = w.state;
            return (options.intentPoint.h >= state.hSpan[0] &&
                options.intentPoint.h <= state.hSpan[1] &&
                options.intentPoint.v >= state.vSpan[0] &&
                options.intentPoint.v <= state.vSpan[1]);
        });
        if (!targetWin)
            return null;
        const targetState = targetWin.state;
        const swappedStates = {};
        for (const w of activeWindows) {
            if (w.windowId === draggedId) {
                swappedStates[w.windowId] = cloneState(targetState);
                swappedStates[w.windowId].lastDirection = null;
            }
            else if (w.windowId === targetWin.windowId) {
                swappedStates[w.windowId] = cloneState(draggedState);
                swappedStates[w.windowId].lastDirection = null;
            }
            else {
                swappedStates[w.windowId] = cloneState(w.state);
            }
        }
        return swappedStates;
    };
    const swapStates = maybeSwapWindows();
    if (swapStates)
        return swapStates;
    const getCarveCandidatesAwayFromTarget = (id) => {
        const state = states[id];
        const stateWidth = spanSize(state.hSpan);
        const stateHeight = spanSize(state.vSpan);
        const originalArea = stateWidth * stateHeight;
        const hOverlap = Math.max(0, Math.min(targetHSpan[1], state.hSpan[1]) - Math.max(targetHSpan[0], state.hSpan[0]));
        const vOverlap = Math.max(0, Math.min(targetVSpan[1], state.vSpan[1]) - Math.max(targetVSpan[0], state.vSpan[0]));
        const hCoverage = stateWidth > 0 ? hOverlap / stateWidth : 0;
        const vCoverage = stateHeight > 0 ? vOverlap / stateHeight : 0;
        const touchesHorizontalEdge = Math.min(Math.abs(targetHSpan[0] - state.hSpan[0]), Math.abs(targetHSpan[1] - state.hSpan[1])) <= 0.5;
        const touchesVerticalEdge = Math.min(Math.abs(targetVSpan[0] - state.vSpan[0]), Math.abs(targetVSpan[1] - state.vSpan[1])) <= 0.5;
        const horizontalSpanCandidates = spanCenter(targetHSpan) >= spanCenter(state.hSpan)
            ? [[state.hSpan[0], targetHSpan[0]], [targetHSpan[1], state.hSpan[1]]]
            : [[targetHSpan[1], state.hSpan[1]], [state.hSpan[0], targetHSpan[0]]];
        const verticalSpanCandidates = spanCenter(targetVSpan) >= spanCenter(state.vSpan)
            ? [[state.vSpan[0], targetVSpan[0]], [targetVSpan[1], state.vSpan[1]]]
            : [[targetVSpan[1], state.vSpan[1]], [state.vSpan[0], targetVSpan[0]]];
        const candidates = [];
        let order = 0;
        for (const span of horizontalSpanCandidates) {
            if (span[0] >= 0 && span[1] <= config.gridSize && spanSize(span) >= config.minSpan) {
                const remainingArea = spanSize(span) * stateHeight;
                const axisPreference = (vCoverage - hCoverage) * 2 +
                    (touchesHorizontalEdge ? 1 : 0) -
                    (touchesVerticalEdge ? 0.5 : 0) +
                    0.05;
                candidates.push({
                    axis: 'horizontal',
                    span,
                    score: (originalArea - remainingArea) * 10 - axisPreference,
                    order: order++
                });
            }
        }
        for (const span of verticalSpanCandidates) {
            if (span[0] >= 0 && span[1] <= config.gridSize && spanSize(span) >= config.minSpan) {
                const remainingArea = stateWidth * spanSize(span);
                const axisPreference = (hCoverage - vCoverage) * 2 +
                    (touchesVerticalEdge ? 1 : 0) -
                    (touchesHorizontalEdge ? 0.5 : 0);
                candidates.push({
                    axis: 'vertical',
                    span,
                    score: (originalArea - remainingArea) * 10 - axisPreference,
                    order: order++
                });
            }
        }
        return candidates.sort((a, b) => a.score - b.score ||
            a.order - b.order);
    };
    const carveAwayFromTarget = (id) => {
        const candidates = getCarveCandidatesAwayFromTarget(id);
        let bestCandidate = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const [index, candidate] of candidates.entries()) {
            const candidateStates = cloneStates(states);
            if (candidate.axis === 'horizontal') {
                candidateStates[id].hSpan = [...candidate.span];
                candidateStates[id].hIndex = TilingEngine_1.TilingEngine.spanToHIndex(candidate.span);
            }
            else {
                candidateStates[id].vSpan = [...candidate.span];
                candidateStates[id].vIndex = TilingEngine_1.TilingEngine.spanToVIndex(candidate.span);
            }
            const score = scoreCandidateStates(candidateStates, index) + candidate.score / 1_000;
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }
        if (!bestCandidate)
            return false;
        if (bestCandidate.axis === 'horizontal') {
            setHSpan(id, bestCandidate.span);
        }
        else {
            setVSpan(id, bestCandidate.span);
        }
        return true;
    };
    const separateHorizontally = (movableId, anchorId) => {
        const movable = states[movableId];
        const anchor = states[anchorId];
        const movableCenter = spanCenter(movable.hSpan);
        const anchorCenter = spanCenter(anchor.hSpan);
        const candidates = movableCenter >= anchorCenter
            ? [[anchor.hSpan[1], movable.hSpan[1]], [movable.hSpan[0], anchor.hSpan[0]]]
            : [[movable.hSpan[0], anchor.hSpan[0]], [anchor.hSpan[1], movable.hSpan[1]]];
        for (const candidate of candidates) {
            if (candidate[0] >= 0 && candidate[1] <= config.gridSize && spanSize(candidate) >= config.minSpan) {
                setHSpan(movableId, candidate);
                return true;
            }
        }
        return false;
    };
    const separateVertically = (movableId, anchorId) => {
        const movable = states[movableId];
        const anchor = states[anchorId];
        const movableCenter = spanCenter(movable.vSpan);
        const anchorCenter = spanCenter(anchor.vSpan);
        const candidates = movableCenter >= anchorCenter
            ? [[anchor.vSpan[1], movable.vSpan[1]], [movable.vSpan[0], anchor.vSpan[0]]]
            : [[movable.vSpan[0], anchor.vSpan[0]], [anchor.vSpan[1], movable.vSpan[1]]];
        for (const candidate of candidates) {
            if (candidate[0] >= 0 && candidate[1] <= config.gridSize && spanSize(candidate) >= config.minSpan) {
                setVSpan(movableId, candidate);
                return true;
            }
        }
        return false;
    };
    const separateFromAnchor = (movableId, anchorId) => {
        const movable = states[movableId];
        const anchor = states[anchorId];
        const hOverlap = Math.min(movable.hSpan[1], anchor.hSpan[1]) - Math.max(movable.hSpan[0], anchor.hSpan[0]);
        const vOverlap = Math.min(movable.vSpan[1], anchor.vSpan[1]) - Math.max(movable.vSpan[0], anchor.vSpan[0]);
        if (hOverlap <= vOverlap) {
            return separateHorizontally(movableId, anchorId) || separateVertically(movableId, anchorId);
        }
        return separateVertically(movableId, anchorId) || separateHorizontally(movableId, anchorId);
    };
    const sanitizeTouchedOverlaps = () => {
        const ids = Object.keys(states);
        for (let pass = 0; pass < ids.length * 2; pass++) {
            let changed = false;
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const aId = ids[i];
                    const bId = ids[j];
                    const a = states[aId];
                    const b = states[bId];
                    if (!rectsOverlap(a, b))
                        continue;
                    let movableId = null;
                    let anchorId = null;
                    if (aId === draggedId) {
                        movableId = bId;
                        anchorId = aId;
                    }
                    else if (bId === draggedId) {
                        movableId = aId;
                        anchorId = bId;
                    }
                    else if (touched.has(aId) && !touched.has(bId)) {
                        movableId = aId;
                        anchorId = bId;
                    }
                    else if (touched.has(bId) && !touched.has(aId)) {
                        movableId = bId;
                        anchorId = aId;
                    }
                    else if (touched.has(aId)) {
                        movableId = aId;
                        anchorId = bId;
                    }
                    if (movableId && anchorId && separateFromAnchor(movableId, anchorId)) {
                        updateIndexes(states[movableId]);
                        changed = true;
                    }
                }
            }
            if (!changed)
                break;
        }
    };
    // 2. Perform grid vacancy collapse if the dragged window had a valid cropped span before
    const draggedWin = activeWindows.find(w => w.windowId === draggedId);
    if (draggedWin && draggedWin.state && draggedWin.state.hSpan && draggedWin.state.vSpan) {
        const vacantHSpan = draggedWin.state.hSpan;
        const vacantVSpan = draggedWin.state.vSpan;
        const isHSpanCropped = (vacantHSpan[1] - vacantHSpan[0] < config.gridSize);
        const isVSpanCropped = (vacantVSpan[1] - vacantVSpan[0] < config.gridSize);
        const isSameAsTarget = spansEqual(vacantHSpan, targetHSpan) && spansEqual(vacantVSpan, targetVSpan);
        if (!isSameAsTarget && (isHSpanCropped || isVSpanCropped)) {
            const collapsedStates = collapseVacancy(draggedId, config, activeWindows);
            for (const [id, collapsedState] of Object.entries(collapsedStates)) {
                const previous = states[id];
                states[id] = cloneState(collapsedState);
                if (!previous ||
                    previous.hSpan[0] !== collapsedState.hSpan[0] ||
                    previous.hSpan[1] !== collapsedState.hSpan[1] ||
                    previous.vSpan[0] !== collapsedState.vSpan[0] ||
                    previous.vSpan[1] !== collapsedState.vSpan[1]) {
                    touched.add(id);
                }
            }
        }
    }
    // Set the target layout for the dragged window
    states[draggedId] = {
        hIndex: TilingEngine_1.TilingEngine.spanToHIndex(targetHSpan),
        vIndex: TilingEngine_1.TilingEngine.spanToVIndex(targetVSpan),
        hSpan: [...targetHSpan],
        vSpan: [...targetVSpan],
        lastDirection: null
    };
    const tryRedistributeVerticalStackInsertion = () => {
        if (spanSize(targetVSpan) >= config.gridSize)
            return false;
        const sameColumnWindows = otherWindows
            .filter(w => spansEqual(states[w.windowId].hSpan, targetHSpan))
            .sort((a, b) => states[a.windowId].vSpan[0] - states[b.windowId].vSpan[0] || a.windowId.localeCompare(b.windowId));
        const collidingStackWindows = sameColumnWindows.filter(w => rectsOverlap(states[w.windowId], states[draggedId]));
        if (sameColumnWindows.length === 0 || collidingStackWindows.length === 0) {
            return false;
        }
        if ((sameColumnWindows.length + 1) * config.minSpan > config.gridSize) {
            return false;
        }
        const stackTop = Math.min(...sameColumnWindows.map(w => states[w.windowId].vSpan[0]));
        const stackBottom = Math.max(...sameColumnWindows.map(w => states[w.windowId].vSpan[1]));
        if (stackTop > 0 || stackBottom < config.gridSize) {
            return false;
        }
        const slotCount = sameColumnWindows.length + 1;
        const targetCenter = spanCenter(targetVSpan);
        const targetIndex = Math.max(0, Math.min(slotCount - 1, Math.floor(targetCenter / (config.gridSize / slotCount))));
        const baseHeight = Math.floor(config.gridSize / slotCount);
        const extraRows = config.gridSize - baseHeight * slotCount;
        const slots = [];
        let cursor = 0;
        for (let i = 0; i < slotCount; i++) {
            const height = baseHeight + (i < extraRows ? 1 : 0);
            slots.push([cursor, cursor + height]);
            cursor += height;
        }
        const candidateStates = {};
        for (const [id, state] of Object.entries(states)) {
            candidateStates[id] = cloneState(state);
        }
        candidateStates[draggedId].hSpan = [...targetHSpan];
        candidateStates[draggedId].vSpan = [...slots[targetIndex]];
        updateIndexes(candidateStates[draggedId]);
        let sourceIndex = 0;
        for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
            if (slotIndex === targetIndex)
                continue;
            const stackWindow = sameColumnWindows[sourceIndex++];
            const state = candidateStates[stackWindow.windowId];
            state.hSpan = [...targetHSpan];
            state.vSpan = [...slots[slotIndex]];
            updateIndexes(state);
        }
        if (getDragBlockReason(candidateStates, config)) {
            return false;
        }
        for (const [id, nextState] of Object.entries(candidateStates)) {
            if (!statesEqual(states[id], nextState)) {
                states[id] = cloneState(nextState);
                touched.add(id);
            }
        }
        return true;
    };
    const tryRelocateTightVerticalStack = () => {
        const targetWidth = spanSize(targetHSpan);
        if (targetWidth < config.minSpan)
            return false;
        if (spanSize(targetVSpan) >= config.gridSize)
            return false;
        const sameColumnWindows = otherWindows
            .filter(w => spansEqual(states[w.windowId].hSpan, targetHSpan))
            .sort((a, b) => states[a.windowId].vSpan[0] - states[b.windowId].vSpan[0] || a.windowId.localeCompare(b.windowId));
        const collidingStackWindows = sameColumnWindows.filter(w => rectsOverlap(states[w.windowId], states[draggedId]));
        if (sameColumnWindows.length === 0 || collidingStackWindows.length === 0) {
            return false;
        }
        const hasPinnedCollision = collidingStackWindows.some(w => spanSize(states[w.windowId].hSpan) <= config.minSpan ||
            spanSize(states[w.windowId].vSpan) <= config.minSpan);
        if (!hasPinnedCollision)
            return false;
        const stackIds = new Set(sameColumnWindows.map(w => w.windowId));
        const candidateHSpans = [];
        const leftCandidate = [targetHSpan[0] - targetWidth, targetHSpan[0]];
        const rightCandidate = [targetHSpan[1], targetHSpan[1] + targetWidth];
        if (targetHSpan[1] >= config.gridSize) {
            candidateHSpans.push(leftCandidate, rightCandidate);
        }
        else if (targetHSpan[0] <= 0) {
            candidateHSpans.push(rightCandidate, leftCandidate);
        }
        else {
            candidateHSpans.push(leftCandidate, rightCandidate);
        }
        const overlapsMovedStack = (candidateStates, state) => {
            for (const stackId of stackIds) {
                if (hasHorizontalOverlap(state.hSpan, candidateStates[stackId].hSpan) &&
                    hasVerticalOverlap(state.vSpan, candidateStates[stackId].vSpan)) {
                    return true;
                }
            }
            return false;
        };
        const carveAwayFromHSpan = (state, avoidHSpan) => {
            const avoidCenter = spanCenter(avoidHSpan);
            const stateCenter = spanCenter(state.hSpan);
            const candidates = avoidCenter >= stateCenter
                ? [[state.hSpan[0], avoidHSpan[0]], [avoidHSpan[1], state.hSpan[1]]]
                : [[avoidHSpan[1], state.hSpan[1]], [state.hSpan[0], avoidHSpan[0]]];
            for (const candidate of candidates) {
                if (candidate[0] >= 0 && candidate[1] <= config.gridSize && spanSize(candidate) >= config.minSpan) {
                    const nextState = cloneState(state);
                    nextState.hSpan = candidate;
                    updateIndexes(nextState);
                    return nextState;
                }
            }
            return null;
        };
        let bestStates = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const [index, candidateHSpan] of candidateHSpans.entries()) {
            if (candidateHSpan[0] < 0 || candidateHSpan[1] > config.gridSize)
                continue;
            const candidateStates = cloneStates(states);
            for (const stackId of stackIds) {
                candidateStates[stackId].hSpan = [...candidateHSpan];
                updateIndexes(candidateStates[stackId]);
            }
            let failed = false;
            for (const [id, state] of Object.entries(candidateStates)) {
                if (id === draggedId || stackIds.has(id))
                    continue;
                if (!overlapsMovedStack(candidateStates, state))
                    continue;
                const carved = carveAwayFromHSpan(state, candidateHSpan);
                if (!carved) {
                    failed = true;
                    break;
                }
                candidateStates[id] = carved;
            }
            if (failed || getDragBlockReason(candidateStates, config)) {
                continue;
            }
            const score = scoreCandidateStates(candidateStates, index);
            if (score < bestScore) {
                bestScore = score;
                bestStates = candidateStates;
            }
        }
        if (bestStates) {
            applyCandidateStates(bestStates);
            return true;
        }
        return false;
    };
    const tryRelocateTightHorizontalStack = () => {
        const targetWidth = spanSize(targetHSpan);
        if (targetWidth < config.minSpan)
            return false;
        if (spanSize(targetHSpan) >= config.gridSize)
            return false;
        const sameRowWindows = otherWindows
            .filter(w => spansEqual(states[w.windowId].vSpan, targetVSpan))
            .sort((a, b) => states[a.windowId].hSpan[0] - states[b.windowId].hSpan[0] || a.windowId.localeCompare(b.windowId));
        const collidingRowWindows = sameRowWindows.filter(w => rectsOverlap(states[w.windowId], states[draggedId]));
        const intentNearLeftEdge = options.intentPoint ? options.intentPoint.h <= 0.65 : false;
        const intentNearRightEdge = options.intentPoint ? options.intentPoint.h >= config.gridSize - 0.65 : false;
        const targetTouchesLeftEdge = targetHSpan[0] <= 0;
        const targetTouchesRightEdge = targetHSpan[1] >= config.gridSize;
        const isExplicitScreenEdgeInsertion = (targetTouchesLeftEdge && intentNearLeftEdge) ||
            (targetTouchesRightEdge && intentNearRightEdge);
        const isAutoNarrowedScreenEdgeInsertion = Boolean(options.preferredWidth && options.preferredWidth > targetWidth) &&
            (targetTouchesLeftEdge || targetTouchesRightEdge);
        if ((sameRowWindows.length < 2 && !isExplicitScreenEdgeInsertion && !isAutoNarrowedScreenEdgeInsertion) || collidingRowWindows.length === 0) {
            return false;
        }
        const hasPinnedCollision = collidingRowWindows.some(w => spanSize(states[w.windowId].hSpan) <= config.minSpan ||
            spanSize(states[w.windowId].vSpan) <= config.minSpan);
        if (!hasPinnedCollision)
            return false;
        const rowIds = new Set(sameRowWindows.map(w => w.windowId));
        const shifts = [];
        if (targetHSpan[1] >= config.gridSize) {
            shifts.push(-targetWidth);
        }
        else if (targetHSpan[0] <= 0) {
            shifts.push(targetWidth);
        }
        else {
            const targetCenter = spanCenter(targetHSpan);
            const rowCenter = spanCenter([
                Math.min(...sameRowWindows.map(w => states[w.windowId].hSpan[0])),
                Math.max(...sameRowWindows.map(w => states[w.windowId].hSpan[1]))
            ]);
            shifts.push(targetCenter >= rowCenter ? -targetWidth : targetWidth);
            shifts.push(targetCenter >= rowCenter ? targetWidth : -targetWidth);
        }
        let bestStates = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const [index, shift] of shifts.entries()) {
            const candidateStates = cloneStates(states);
            let failed = false;
            for (const rowId of rowIds) {
                const state = candidateStates[rowId];
                const nextHSpan = [state.hSpan[0] + shift, state.hSpan[1] + shift];
                if (nextHSpan[0] < 0 || nextHSpan[1] > config.gridSize) {
                    failed = true;
                    break;
                }
                state.hSpan = nextHSpan;
                updateIndexes(state);
            }
            if (failed || getDragBlockReason(candidateStates, config)) {
                continue;
            }
            const score = scoreCandidateStates(candidateStates, index);
            if (score < bestScore) {
                bestScore = score;
                bestStates = candidateStates;
            }
        }
        if (bestStates) {
            applyCandidateStates(bestStates);
            return true;
        }
        return false;
    };
    const tryCarveEdgeInsertionCorridor = () => {
        if (!options.intentPoint)
            return false;
        if (spanSize(targetVSpan) < config.minSpan)
            return false;
        const targetTouchesLeftEdge = targetHSpan[0] <= 0;
        const targetTouchesRightEdge = targetHSpan[1] >= config.gridSize;
        const intentNearLeftEdge = options.intentPoint.h <= 0.65;
        const intentNearRightEdge = options.intentPoint.h >= config.gridSize - 0.65;
        const isExplicitScreenEdgeInsertion = (targetTouchesLeftEdge && intentNearLeftEdge) ||
            (targetTouchesRightEdge && intentNearRightEdge);
        const isAutoNarrowedScreenEdgeInsertion = Boolean(options.preferredWidth && options.preferredWidth > spanSize(targetHSpan)) &&
            (targetTouchesLeftEdge || targetTouchesRightEdge);
        if (!isExplicitScreenEdgeInsertion && !isAutoNarrowedScreenEdgeInsertion) {
            return false;
        }
        if (!targetTouchesLeftEdge && !targetTouchesRightEdge)
            return false;
        const corridorWidth = spanSize(targetHSpan);
        const direction = targetTouchesLeftEdge ? 1 : -1;
        let cursorStart = targetTouchesLeftEdge ? targetHSpan[0] : targetHSpan[1] - corridorWidth;
        let cursorEnd = targetTouchesLeftEdge ? targetHSpan[1] : targetHSpan[1];
        const chainIds = new Set();
        let donorId = null;
        for (let guard = 0; guard < config.gridSize; guard++) {
            const columnWindows = otherWindows
                .filter(w => {
                const state = states[w.windowId];
                return state.hSpan[0] === cursorStart &&
                    state.hSpan[1] === cursorEnd &&
                    hasVerticalOverlap(state.vSpan, targetVSpan);
            })
                .sort((a, b) => a.windowId.localeCompare(b.windowId));
            if (columnWindows.length === 0) {
                const donorWindow = otherWindows
                    .filter(w => {
                    const state = states[w.windowId];
                    if (!hasVerticalOverlap(state.vSpan, targetVSpan))
                        return false;
                    if (spanSize(state.hSpan) - corridorWidth < config.minSpan)
                        return false;
                    return targetTouchesLeftEdge
                        ? state.hSpan[0] === cursorStart
                        : state.hSpan[1] === cursorEnd;
                })
                    .sort((a, b) => {
                    const aSize = spanSize(states[a.windowId].hSpan);
                    const bSize = spanSize(states[b.windowId].hSpan);
                    return bSize - aSize || a.windowId.localeCompare(b.windowId);
                })[0];
                if (donorWindow) {
                    donorId = donorWindow.windowId;
                }
                break;
            }
            const columnWidth = cursorEnd - cursorStart;
            if (columnWidth <= corridorWidth) {
                for (const w of columnWindows) {
                    chainIds.add(w.windowId);
                }
                cursorStart += direction * corridorWidth;
                cursorEnd += direction * corridorWidth;
                if (cursorStart < 0 || cursorEnd > config.gridSize)
                    return false;
                continue;
            }
            if (columnWidth - corridorWidth < config.minSpan) {
                return false;
            }
            donorId = columnWindows[0].windowId;
            break;
        }
        if (chainIds.size === 0)
            return false;
        const candidateStates = {};
        for (const [id, state] of Object.entries(states)) {
            candidateStates[id] = cloneState(state);
        }
        for (const id of chainIds) {
            const state = candidateStates[id];
            state.hSpan = [state.hSpan[0] + direction * corridorWidth, state.hSpan[1] + direction * corridorWidth];
            updateIndexes(state);
        }
        if (donorId) {
            const donor = candidateStates[donorId];
            donor.hSpan = targetTouchesLeftEdge
                ? [donor.hSpan[0] + corridorWidth, donor.hSpan[1]]
                : [donor.hSpan[0], donor.hSpan[1] - corridorWidth];
            updateIndexes(donor);
        }
        if (getDragBlockReason(candidateStates, config)) {
            return false;
        }
        for (const [id, nextState] of Object.entries(candidateStates)) {
            if (!statesEqual(states[id], nextState)) {
                states[id] = cloneState(nextState);
                touched.add(id);
            }
        }
        return true;
    };
    if (!tryRedistributeVerticalStackInsertion()) {
        tryRelocateTightVerticalStack();
    }
    if (!tryCarveEdgeInsertionCorridor()) {
        tryRelocateTightHorizontalStack();
    }
    const windowsToProcess = otherWindows;
    // Recursive left push
    const pushLeft = (id, rightBoundary) => {
        if (visited.has(id))
            return;
        visited.add(id);
        const state = states[id];
        if (!state)
            return;
        const width = state.hSpan[1] - state.hSpan[0];
        const newEnd = rightBoundary;
        let newStart = Math.min(state.hSpan[0], newEnd - width);
        newStart = Math.max(0, newStart);
        const newEndClamped = Math.max(config.minSpan, Math.min(newEnd, newStart + width));
        const newStartClamped = Math.max(0, newEndClamped - Math.max(config.minSpan, width));
        state.hSpan = [newStartClamped, newEndClamped];
        state.hIndex = TilingEngine_1.TilingEngine.spanToHIndex(state.hSpan);
        touched.add(id);
        // Push vertical-overlapping neighbors on the left
        for (const other of windowsToProcess) {
            if (other.windowId === id)
                continue;
            const otherState = states[other.windowId];
            if (hasVerticalOverlap(state.vSpan, otherState.vSpan) && otherState.hSpan[1] > state.hSpan[0] && otherState.hSpan[0] < state.hSpan[0]) {
                pushLeft(other.windowId, state.hSpan[0]);
            }
        }
    };
    // Recursive right push
    const pushRight = (id, leftBoundary) => {
        if (visited.has(id))
            return;
        visited.add(id);
        const state = states[id];
        if (!state)
            return;
        const width = state.hSpan[1] - state.hSpan[0];
        const newStart = leftBoundary;
        let newEnd = Math.max(state.hSpan[1], newStart + width);
        newEnd = Math.min(config.gridSize, newEnd);
        const newStartClamped = Math.max(0, Math.min(newStart, newEnd - config.minSpan));
        const newEndClamped = Math.min(config.gridSize, newStartClamped + Math.max(config.minSpan, width));
        state.hSpan = [newStartClamped, newEndClamped];
        state.hIndex = TilingEngine_1.TilingEngine.spanToHIndex(state.hSpan);
        touched.add(id);
        // Push vertical-overlapping neighbors on the right
        for (const other of windowsToProcess) {
            if (other.windowId === id)
                continue;
            const otherState = states[other.windowId];
            if (hasVerticalOverlap(state.vSpan, otherState.vSpan) && otherState.hSpan[0] < state.hSpan[1] && otherState.hSpan[1] > state.hSpan[1]) {
                pushRight(other.windowId, state.hSpan[1]);
            }
        }
    };
    // Recursive up push
    const pushUp = (id, bottomBoundary) => {
        if (visited.has(id))
            return;
        visited.add(id);
        const state = states[id];
        if (!state)
            return;
        const height = state.vSpan[1] - state.vSpan[0];
        const newEnd = bottomBoundary;
        let newStart = Math.min(state.vSpan[0], newEnd - height);
        newStart = Math.max(0, newStart);
        const newEndClamped = Math.max(config.minSpan, Math.min(newEnd, newStart + height));
        const newStartClamped = Math.max(0, newEndClamped - Math.max(config.minSpan, height));
        state.vSpan = [newStartClamped, newEndClamped];
        state.vIndex = TilingEngine_1.TilingEngine.spanToVIndex(state.vSpan);
        touched.add(id);
        // Push horizontal-overlapping neighbors above
        for (const other of windowsToProcess) {
            if (other.windowId === id)
                continue;
            const otherState = states[other.windowId];
            if (hasHorizontalOverlap(state.hSpan, otherState.hSpan) && otherState.vSpan[1] > state.vSpan[0] && otherState.vSpan[0] < state.vSpan[0]) {
                pushUp(other.windowId, state.vSpan[0]);
            }
        }
    };
    // Recursive down push
    const pushDown = (id, topBoundary) => {
        if (visited.has(id))
            return;
        visited.add(id);
        const state = states[id];
        if (!state)
            return;
        const height = state.vSpan[1] - state.vSpan[0];
        const newStart = topBoundary;
        let newEnd = Math.max(state.vSpan[1], newStart + height);
        newEnd = Math.min(config.gridSize, newEnd);
        const newStartClamped = Math.max(0, Math.min(newStart, newEnd - config.minSpan));
        const newEndClamped = Math.min(config.gridSize, newStartClamped + Math.max(config.minSpan, height));
        state.vSpan = [newStartClamped, newEndClamped];
        state.vIndex = TilingEngine_1.TilingEngine.spanToVIndex(state.vSpan);
        touched.add(id);
        // Push horizontal-overlapping neighbors below
        for (const other of windowsToProcess) {
            if (other.windowId === id)
                continue;
            const otherState = states[other.windowId];
            if (hasHorizontalOverlap(state.hSpan, otherState.hSpan) && otherState.vSpan[0] < state.vSpan[1] && otherState.vSpan[1] > state.vSpan[1]) {
                pushDown(other.windowId, state.vSpan[1]);
            }
        }
    };
    // Trigger horizontal or vertical pushes based on intersection centers
    visited.add(draggedId); // Dragged window is the root, do not push it
    for (const w of windowsToProcess) {
        const state = states[w.windowId];
        if (hasVerticalOverlap(targetVSpan, state.vSpan) && hasHorizontalOverlap(targetHSpan, state.hSpan)) {
            const centerTargetX = (targetHSpan[0] + targetHSpan[1]) / 2;
            const centerTargetY = (targetVSpan[0] + targetVSpan[1]) / 2;
            const centerWindowX = (state.hSpan[0] + state.hSpan[1]) / 2;
            const centerWindowY = (state.vSpan[0] + state.vSpan[1]) / 2;
            const dx = centerWindowX - centerTargetX;
            const dy = centerWindowY - centerTargetY;
            // Prefer carving space out of large intersecting windows. This keeps a wide
            // window anchored instead of throwing it across already occupied columns.
            const carved = carveAwayFromTarget(w.windowId);
            if (carved) {
                continue;
            }
            // Fallback to directional push when the intersecting window cannot be carved.
            if (Math.abs(dx) >= Math.abs(dy)) {
                if (dx < 0) {
                    pushLeft(w.windowId, targetHSpan[0]);
                }
                else {
                    pushRight(w.windowId, targetHSpan[1]);
                }
            }
            else {
                if (dy < 0) {
                    pushUp(w.windowId, targetVSpan[0]);
                }
                else {
                    pushDown(w.windowId, targetVSpan[1]);
                }
            }
        }
    }
    sanitizeTouchedOverlaps();
    return states;
}
function compareWindowsByGridPosition(a, b) {
    return a.state.vSpan[0] - b.state.vSpan[0] ||
        a.state.hSpan[0] - b.state.hSpan[0] ||
        a.state.vSpan[1] - b.state.vSpan[1] ||
        a.state.hSpan[1] - b.state.hSpan[1] ||
        a.windowId.localeCompare(b.windowId);
}
function collapseVacancy(vacantId, config, activeWindows) {
    const states = {};
    const vacantWin = activeWindows.find(w => w.windowId === vacantId);
    if (!vacantWin) {
        for (const w of activeWindows) {
            states[w.windowId] = {
                hIndex: w.state.hIndex,
                vIndex: w.state.vIndex,
                hSpan: [...(w.state.hSpan || [0, config.gridSize])],
                vSpan: [...(w.state.vSpan || [0, config.gridSize])],
                lastDirection: w.state.lastDirection
            };
        }
        return states;
    }
    const vacantHSpan = vacantWin.state.hSpan;
    const vacantVSpan = vacantWin.state.vSpan;
    const otherWindows = activeWindows
        .filter(w => w.windowId !== vacantId)
        .sort(compareWindowsByGridPosition);
    for (const w of otherWindows) {
        states[w.windowId] = {
            hIndex: w.state.hIndex,
            vIndex: w.state.vIndex,
            hSpan: [...(w.state.hSpan || [0, config.gridSize])],
            vSpan: [...(w.state.vSpan || [0, config.gridSize])],
            lastDirection: w.state.lastDirection
        };
    }
    const hasVerticalOverlap = (spanA, spanB) => {
        return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
    };
    const hasHorizontalOverlap = (spanA, spanB) => {
        return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
    };
    const overlapSize = (spanA, spanB) => {
        return Math.max(0, Math.min(spanA[1], spanB[1]) - Math.max(spanA[0], spanB[0]));
    };
    const spanSize = (span) => span[1] - span[0];
    const spansEqual = (spanA, spanB) => {
        return spanA[0] === spanB[0] && spanA[1] === spanB[1];
    };
    const covers = (container, inner) => {
        return container[0] <= inner[0] && container[1] >= inner[1];
    };
    const wouldOverlap = (id, hSpan, vSpan) => {
        for (const other of otherWindows) {
            if (other.windowId === id)
                continue;
            const s = states[other.windowId];
            if (hasHorizontalOverlap(hSpan, s.hSpan) && hasVerticalOverlap(vSpan, s.vSpan)) {
                return true;
            }
        }
        return false;
    };
    const applyCandidate = (id, hSpan, vSpan) => {
        const s = states[id];
        s.hSpan = hSpan;
        s.vSpan = vSpan;
        s.hIndex = TilingEngine_1.TilingEngine.spanToHIndex(hSpan);
        s.vIndex = TilingEngine_1.TilingEngine.spanToVIndex(vSpan);
    };
    const sameColumnWindows = otherWindows.filter(w => spansEqual(states[w.windowId].hSpan, vacantHSpan));
    const prefersVerticalStackCollapse = spanSize(vacantHSpan) <= config.minSpan ||
        sameColumnWindows.length >= 2;
    if (prefersVerticalStackCollapse && sameColumnWindows.length > 0) {
        const stackEntries = [
            { id: vacantId, vSpan: vacantVSpan, vacant: true },
            ...sameColumnWindows.map(w => ({
                id: w.windowId,
                vSpan: states[w.windowId].vSpan,
                vacant: false
            }))
        ].sort((a, b) => a.vSpan[0] - b.vSpan[0] || a.id.localeCompare(b.id));
        const vacantIndex = stackEntries.findIndex(entry => entry.vacant);
        let startIndex = vacantIndex;
        let endIndex = vacantIndex;
        while (startIndex > 0 &&
            Math.abs(stackEntries[startIndex - 1].vSpan[1] - stackEntries[startIndex].vSpan[0]) <= 1) {
            startIndex--;
        }
        while (endIndex < stackEntries.length - 1 &&
            Math.abs(stackEntries[endIndex].vSpan[1] - stackEntries[endIndex + 1].vSpan[0]) <= 1) {
            endIndex++;
        }
        const connectedStack = stackEntries.slice(startIndex, endIndex + 1);
        const remainingStack = connectedStack.filter(entry => !entry.vacant);
        const stackStart = Math.min(...connectedStack.map(entry => entry.vSpan[0]));
        const stackEnd = Math.max(...connectedStack.map(entry => entry.vSpan[1]));
        const stackHeight = stackEnd - stackStart;
        if (remainingStack.length > 0 && stackHeight >= remainingStack.length * config.minSpan) {
            const previousStackStates = remainingStack.map(entry => ({
                id: entry.id,
                hSpan: [...states[entry.id].hSpan],
                vSpan: [...states[entry.id].vSpan]
            }));
            for (let i = 0; i < remainingStack.length; i++) {
                const nextStart = stackStart + Math.round((stackHeight * i) / remainingStack.length);
                const nextEnd = stackStart + Math.round((stackHeight * (i + 1)) / remainingStack.length);
                applyCandidate(remainingStack[i].id, [...vacantHSpan], [nextStart, nextEnd]);
            }
            if (!hasLayoutOverlaps(states)) {
                return states;
            }
            for (const previous of previousStackStates) {
                applyCandidate(previous.id, previous.hSpan, previous.vSpan);
            }
        }
    }
    const candidates = [];
    for (const w of otherWindows) {
        const s = states[w.windowId];
        if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[1] - vacantHSpan[0]) <= 1) {
            candidates.push({
                id: w.windowId,
                priority: 100 + overlapSize(vacantVSpan, s.vSpan),
                fullHSpan: [s.hSpan[0], vacantHSpan[1]],
                fullVSpan: s.vSpan,
                partialHSpan: covers(s.vSpan, vacantVSpan) ? [s.hSpan[0], vacantHSpan[1]] : undefined,
                partialVSpan: covers(s.vSpan, vacantVSpan) ? [...vacantVSpan] : undefined
            });
        }
        if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[0] - vacantHSpan[1]) <= 1) {
            candidates.push({
                id: w.windowId,
                priority: 100 + overlapSize(vacantVSpan, s.vSpan),
                fullHSpan: [vacantHSpan[0], s.hSpan[1]],
                fullVSpan: s.vSpan,
                partialHSpan: covers(s.vSpan, vacantVSpan) ? [vacantHSpan[0], s.hSpan[1]] : undefined,
                partialVSpan: covers(s.vSpan, vacantVSpan) ? [...vacantVSpan] : undefined
            });
        }
        if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[1] - vacantVSpan[0]) <= 1) {
            const isSameColumnStackNeighbor = prefersVerticalStackCollapse && spansEqual(s.hSpan, vacantHSpan);
            candidates.push({
                id: w.windowId,
                priority: (isSameColumnStackNeighbor ? 200 : 0) + overlapSize(vacantHSpan, s.hSpan),
                fullHSpan: s.hSpan,
                fullVSpan: [s.vSpan[0], vacantVSpan[1]]
            });
        }
        if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[0] - vacantVSpan[1]) <= 1) {
            const isSameColumnStackNeighbor = prefersVerticalStackCollapse && spansEqual(s.hSpan, vacantHSpan);
            candidates.push({
                id: w.windowId,
                priority: (isSameColumnStackNeighbor ? 200 : 0) + overlapSize(vacantHSpan, s.hSpan),
                fullHSpan: s.hSpan,
                fullVSpan: [vacantVSpan[0], s.vSpan[1]]
            });
        }
    }
    candidates.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const candidate of candidates) {
        if (!wouldOverlap(candidate.id, candidate.fullHSpan, candidate.fullVSpan)) {
            applyCandidate(candidate.id, candidate.fullHSpan, candidate.fullVSpan);
            return states;
        }
        if (candidate.partialHSpan && candidate.partialVSpan &&
            !wouldOverlap(candidate.id, candidate.partialHSpan, candidate.partialVSpan)) {
            applyCandidate(candidate.id, candidate.partialHSpan, candidate.partialVSpan);
            return states;
        }
    }
    return states;
}
