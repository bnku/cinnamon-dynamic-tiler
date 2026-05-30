import { Config, WindowState } from './core/types';
import { HORIZONTAL_SPANS, VERTICAL_SPANS, TilingEngine } from './core/TilingEngine';

export function calculateDragTransitions(
  draggedId: string,
  targetHSpan: [number, number],
  targetVSpan: [number, number],
  config: Config,
  activeWindows: { windowId: string; state: WindowState }[]
): Record<string, WindowState> {
  const states: Record<string, WindowState> = {};
  const visited = new Set<string>();

  // 1. Initialize states for all other windows on monitor
  const otherWindows = activeWindows.filter(w => w.windowId !== draggedId);
  for (const w of otherWindows) {
    states[w.windowId] = {
      hIndex: w.state.hIndex,
      vIndex: w.state.vIndex,
      hSpan: [...(w.state.hSpan || [0, config.gridSize])],
      vSpan: [...(w.state.vSpan || [0, config.gridSize])],
      lastDirection: w.state.lastDirection
    };
  }

  const hasVerticalOverlap = (spanA: [number, number], spanB: [number, number]) => {
    return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
  };

  const hasHorizontalOverlap = (spanA: [number, number], spanB: [number, number]) => {
    return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
  };

  // 2. Perform grid vacancy collapse if the dragged window had a valid cropped span before
  const draggedWin = activeWindows.find(w => w.windowId === draggedId);
  if (draggedWin && draggedWin.state && draggedWin.state.hSpan && draggedWin.state.vSpan) {
    const vacantHSpan = draggedWin.state.hSpan;
    const vacantVSpan = draggedWin.state.vSpan;
    const isHSpanCropped = (vacantHSpan[1] - vacantHSpan[0] < config.gridSize);
    const isVSpanCropped = (vacantVSpan[1] - vacantVSpan[0] < config.gridSize);

    if (isHSpanCropped || isVSpanCropped) {
      let collapsedHorizontally = false;

      // Expand horizontal neighbors into vacancy (preferring horizontal collapse to keep structures clean)
      let leftNeighborId: string | null = null;
      for (const w of otherWindows) {
        const s = states[w.windowId];
        // Support small 1-cell tolerance to perfectly align Chrome/CSD windows
        if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[1] - vacantHSpan[0]) <= 1) {
          leftNeighborId = w.windowId;
          break;
        }
      }

      if (leftNeighborId) {
        const s = states[leftNeighborId];
        s.hSpan[1] = vacantHSpan[1];
        s.hIndex = TilingEngine.spanToHIndex(s.hSpan);
        collapsedHorizontally = true;
      } else {
        let rightNeighborId: string | null = null;
        for (const w of otherWindows) {
          const s = states[w.windowId];
          if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[0] - vacantHSpan[1]) <= 1) {
            rightNeighborId = w.windowId;
            break;
          }
        }
        if (rightNeighborId) {
          const s = states[rightNeighborId];
          s.hSpan[0] = vacantHSpan[0];
          s.hIndex = TilingEngine.spanToHIndex(s.hSpan);
          collapsedHorizontally = true;
        }
      }

      // Expand vertical neighbors into vacancy if horizontal was not applicable
      if (!collapsedHorizontally) {
        let topNeighborId: string | null = null;
        for (const w of otherWindows) {
          const s = states[w.windowId];
          if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[1] - vacantVSpan[0]) <= 1) {
            topNeighborId = w.windowId;
            break;
          }
        }

        if (topNeighborId) {
          const s = states[topNeighborId];
          s.vSpan[1] = vacantVSpan[1];
          s.vIndex = TilingEngine.spanToVIndex(s.vSpan);
        } else {
          let bottomNeighborId: string | null = null;
          for (const w of otherWindows) {
            const s = states[w.windowId];
            if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[0] - vacantVSpan[1]) <= 1) {
              bottomNeighborId = w.windowId;
              break;
            }
          }
          if (bottomNeighborId) {
            const s = states[bottomNeighborId];
            s.vSpan[0] = vacantVSpan[0];
            s.vIndex = TilingEngine.spanToVIndex(s.vSpan);
          }
        }
      }
    }
  }

  // Set the target layout for the dragged window
  states[draggedId] = {
    hIndex: TilingEngine.spanToHIndex(targetHSpan),
    vIndex: TilingEngine.spanToVIndex(targetVSpan),
    hSpan: [...targetHSpan],
    vSpan: [...targetVSpan],
    lastDirection: null
  };

  const windowsToProcess = otherWindows;

  // Recursive left push
  const pushLeft = (id: string, rightBoundary: number) => {
    if (visited.has(id)) return;
    visited.add(id);

    const state = states[id];
    if (!state) return;

    const width = state.hSpan[1] - state.hSpan[0];
    const newEnd = rightBoundary;
    let newStart = Math.min(state.hSpan[0], newEnd - width);
    
    newStart = Math.max(0, newStart);
    const newEndClamped = Math.max(config.minSpan, Math.min(newEnd, newStart + width));
    const newStartClamped = Math.max(0, newEndClamped - Math.max(config.minSpan, width));

    state.hSpan = [newStartClamped, newEndClamped];
    state.hIndex = TilingEngine.spanToHIndex(state.hSpan);

    // Push vertical-overlapping neighbors on the left
    for (const other of windowsToProcess) {
      if (other.windowId === id) continue;
      const otherState = states[other.windowId];
      if (hasVerticalOverlap(state.vSpan, otherState.vSpan) && otherState.hSpan[1] > state.hSpan[0] && otherState.hSpan[0] < state.hSpan[0]) {
        pushLeft(other.windowId, state.hSpan[0]);
      }
    }
  };

  // Recursive right push
  const pushRight = (id: string, leftBoundary: number) => {
    if (visited.has(id)) return;
    visited.add(id);

    const state = states[id];
    if (!state) return;

    const width = state.hSpan[1] - state.hSpan[0];
    const newStart = leftBoundary;
    let newEnd = Math.max(state.hSpan[1], newStart + width);

    newEnd = Math.min(config.gridSize, newEnd);
    const newStartClamped = Math.max(0, Math.min(newStart, newEnd - config.minSpan));
    const newEndClamped = Math.min(config.gridSize, newStartClamped + Math.max(config.minSpan, width));

    state.hSpan = [newStartClamped, newEndClamped];
    state.hIndex = TilingEngine.spanToHIndex(state.hSpan);

    // Push vertical-overlapping neighbors on the right
    for (const other of windowsToProcess) {
      if (other.windowId === id) continue;
      const otherState = states[other.windowId];
      if (hasVerticalOverlap(state.vSpan, otherState.vSpan) && otherState.hSpan[0] < state.hSpan[1] && otherState.hSpan[1] > state.hSpan[1]) {
        pushRight(other.windowId, state.hSpan[1]);
      }
    }
  };

  // Recursive up push
  const pushUp = (id: string, bottomBoundary: number) => {
    if (visited.has(id)) return;
    visited.add(id);

    const state = states[id];
    if (!state) return;

    const height = state.vSpan[1] - state.vSpan[0];
    const newEnd = bottomBoundary;
    let newStart = Math.min(state.vSpan[0], newEnd - height);

    newStart = Math.max(0, newStart);
    const newEndClamped = Math.max(config.minSpan, Math.min(newEnd, newStart + height));
    const newStartClamped = Math.max(0, newEndClamped - Math.max(config.minSpan, height));

    state.vSpan = [newStartClamped, newEndClamped];
    state.vIndex = TilingEngine.spanToVIndex(state.vSpan);

    // Push horizontal-overlapping neighbors above
    for (const other of windowsToProcess) {
      if (other.windowId === id) continue;
      const otherState = states[other.windowId];
      if (hasHorizontalOverlap(state.hSpan, otherState.hSpan) && otherState.vSpan[1] > state.vSpan[0] && otherState.vSpan[0] < state.vSpan[0]) {
        pushUp(other.windowId, state.vSpan[0]);
      }
    }
  };

  // Recursive down push
  const pushDown = (id: string, topBoundary: number) => {
    if (visited.has(id)) return;
    visited.add(id);

    const state = states[id];
    if (!state) return;

    const height = state.vSpan[1] - state.vSpan[0];
    const newStart = topBoundary;
    let newEnd = Math.max(state.vSpan[1], newStart + height);

    newEnd = Math.min(config.gridSize, newEnd);
    const newStartClamped = Math.max(0, Math.min(newStart, newEnd - config.minSpan));
    const newEndClamped = Math.min(config.gridSize, newStartClamped + Math.max(config.minSpan, height));

    state.vSpan = [newStartClamped, newEndClamped];
    state.vIndex = TilingEngine.spanToVIndex(state.vSpan);

    // Push horizontal-overlapping neighbors below
    for (const other of windowsToProcess) {
      if (other.windowId === id) continue;
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

      // Select push direction based on vector with largest distance from target center
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx < 0) {
          pushLeft(w.windowId, targetHSpan[0]);
        } else {
          pushRight(w.windowId, targetHSpan[1]);
        }
      } else {
        if (dy < 0) {
          pushUp(w.windowId, targetVSpan[0]);
        } else {
          pushDown(w.windowId, targetVSpan[1]);
        }
      }
    }
  }

  return states;
}

export function collapseVacancy(
  vacantId: string,
  config: Config,
  activeWindows: { windowId: string; state: WindowState }[]
): Record<string, WindowState> {
  const states: Record<string, WindowState> = {};
  
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

  const otherWindows = activeWindows.filter(w => w.windowId !== vacantId);
  for (const w of otherWindows) {
    states[w.windowId] = {
      hIndex: w.state.hIndex,
      vIndex: w.state.vIndex,
      hSpan: [...(w.state.hSpan || [0, config.gridSize])],
      vSpan: [...(w.state.vSpan || [0, config.gridSize])],
      lastDirection: w.state.lastDirection
    };
  }

  const hasVerticalOverlap = (spanA: [number, number], spanB: [number, number]) => {
    return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
  };

  const hasHorizontalOverlap = (spanA: [number, number], spanB: [number, number]) => {
    return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
  };

  let collapsedHorizontally = false;

  // 1. Expand horizontal neighbors into vacancy (preferring horizontal collapse)
  let leftNeighborId: string | null = null;
  for (const w of otherWindows) {
    const s = states[w.windowId];
    if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[1] - vacantHSpan[0]) <= 1) {
      leftNeighborId = w.windowId;
      break;
    }
  }

  if (leftNeighborId) {
    const s = states[leftNeighborId];
    s.hSpan[1] = vacantHSpan[1];
    s.hIndex = TilingEngine.spanToHIndex(s.hSpan);
    collapsedHorizontally = true;
  } else {
    let rightNeighborId: string | null = null;
    for (const w of otherWindows) {
      const s = states[w.windowId];
      if (hasVerticalOverlap(vacantVSpan, s.vSpan) && Math.abs(s.hSpan[0] - vacantHSpan[1]) <= 1) {
        rightNeighborId = w.windowId;
        break;
      }
    }
    if (rightNeighborId) {
      const s = states[rightNeighborId];
      s.hSpan[0] = vacantHSpan[0];
      s.hIndex = TilingEngine.spanToHIndex(s.hSpan);
      collapsedHorizontally = true;
    }
  }

  // 2. Expand vertical neighbors into vacancy if horizontal was not applicable
  if (!collapsedHorizontally) {
    let topNeighborId: string | null = null;
    for (const w of otherWindows) {
      const s = states[w.windowId];
      if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[1] - vacantVSpan[0]) <= 1) {
        topNeighborId = w.windowId;
        break;
      }
    }

    if (topNeighborId) {
      const s = states[topNeighborId];
      s.vSpan[1] = vacantVSpan[1];
      s.vIndex = TilingEngine.spanToVIndex(s.vSpan);
    } else {
      let bottomNeighborId: string | null = null;
      for (const w of otherWindows) {
        const s = states[w.windowId];
        if (hasHorizontalOverlap(vacantHSpan, s.hSpan) && Math.abs(s.vSpan[0] - vacantVSpan[1]) <= 1) {
          bottomNeighborId = w.windowId;
          break;
        }
      }
      if (bottomNeighborId) {
        const s = states[bottomNeighborId];
        s.vSpan[0] = vacantVSpan[0];
        s.vIndex = TilingEngine.spanToVIndex(s.vSpan);
      }
    }
  }

  return states;
}
