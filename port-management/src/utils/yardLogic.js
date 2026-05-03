/**
 * Core Yard Logic & Constants
 */

export const MAX_STACK_HEIGHT = 3;
export const SECTIONS = ['A', 'B', 'C'];
export const ROWS = 10;
export const COLS = 10;

export const CONTAINER_TYPES = ['Dry', 'Reefer', 'Hazardous', 'Tank', 'Open Top', 'Flat Rack'];
export const SIZES = ['20ft', '40ft', '45ft'];

export const getPositionKey = (section, row, col) => `${section}-${row}-${col}`;

/**
 * Calculates the footprint of a container based on its size and orientation.
 */
export const calculateFootprint = (section, size, row, col, orientation) => {
  let footprint = [];
  if (size === '20ft') {
    footprint = [{ section, row, col, key: getPositionKey(section, row, col) }];
  } else {
    // 40ft and 45ft take 2 cells
    if (orientation === 'horizontal') {
      if (col + 1 >= COLS) return null; // Out of bounds
      footprint = [
        { section, row, col, key: getPositionKey(section, row, col) },
        { section, row, col: col + 1, key: getPositionKey(section, row, col + 1) }
      ];
    } else {
      if (row + 1 >= ROWS) return null; // Out of bounds
      footprint = [
        { section, row, col, key: getPositionKey(section, row, col) },
        { section, row: row + 1, col, key: getPositionKey(section, row + 1, col) }
      ];
    }
  }
  return footprint;
};

/**
 * Validates if a container can be placed at the given location.
 */
export const validatePlacement = (yard, containerMap, section, size, row, col, orientation) => {
  const footprint = calculateFootprint(section, size, row, col, orientation);
  if (!footprint) return { valid: false, reason: 'Out of bounds' };

  // 1. Check stack height consistency
  const heights = footprint.map(f => (yard[f.key] ? yard[f.key].length : 0));
  const baseHeight = heights[0];
  if (!heights.every(h => h === baseHeight)) {
    return { valid: false, reason: 'Uneven base: All cells in footprint must have same stack height.' };
  }

  if (baseHeight >= MAX_STACK_HEIGHT) {
    return { valid: false, reason: 'Stack limit reached (Max 3 high).' };
  }

  // 2. Structural Stacking Rule (Physical Support)
  if (baseHeight > 0) {
    for (const f of footprint) {
      const stackBelow = yard[f.key];
      const supId = stackBelow[baseHeight - 1];
      const supC = containerMap[supId];

      if (supC.size === '20ft' && size !== '20ft') {
        return { valid: false, reason: `Structural Error: Cannot place ${size} on top of 20ft (${supId}).` };
      }

      if (supC.size !== '20ft') {
        const supFootprint = supC.footprint;
        const isFullyCovered = supFootprint.every(sf => 
          footprint.some(f => f.key === sf.key)
        );
        if (!isFullyCovered) {
          return { valid: false, reason: `Structural Error: Must fully cover the supporting container (${supId}).` };
        }
      }
    }
  }

  return { valid: true, footprint, level: baseHeight };
};

/**
 * Checks if removing/moving a container would bury others.
 */
export const checkBuryWarning = (yard, key, level) => {
  const stack = yard[key];
  if (!stack || level >= stack.length - 1) return true;
  return false; // Actually this is the inverse logic in the original
};

export const isBlocked = (yard, containerMap, id) => {
  const c = containerMap[id];
  if (!c) return false;
  return c.footprint.some(f => {
    const stack = yard[f.key];
    return stack[stack.length - 1] !== id;
  });
};
