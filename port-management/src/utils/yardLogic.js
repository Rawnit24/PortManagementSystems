export const MAX_STACK_HEIGHT = 3;
export const SECTIONS = ['A', 'B', 'C'];
export const ROWS = 10;
export const COLS = 10;

export const CONTAINER_TYPES = ['Dry', 'Reefer', 'Hazardous', 'Tank', 'Open Top', 'Flat Rack'];
export const SIZES = ['20ft', '40ft', '45ft'];
export const SECTION_LABELS = { A: 'Outbound', B: 'Inbound', C: 'Processing' };

// 3D scene section offsets (matches vanilla)
export const sectionOffset = { A: 0, B: 12, C: 24 };

export const getPositionKey = (section, row, col) => `${section}_${row}_${col}`;

export const calculatePriority = (departureDateStr) => {
  if (!departureDateStr) return 'low';
  const depDate = new Date(departureDateStr);
  const now = new Date();
  depDate.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((depDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'high';
  if (diffDays <= 5) return 'medium';
  return 'low';
};

// 20ft = 2 cells, 40ft/45ft = 4 cells (matches vanilla)
export const getFootprint = (section, size, row, col, orientation) => {
  const length = (size === '40ft' || size === '45ft') ? 4 : 2;
  const footprint = [];
  for (let i = 0; i < length; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      footprint.push({ section, row: r, col: c, key: getPositionKey(section, r, c) });
    } else {
      return null;
    }
  }
  return footprint;
};

export const validatePlacement = (yard, containerMap, section, size, row, col, orientation) => {
  const footprint = getFootprint(section, size, row, col, orientation);
  if (!footprint) return { valid: false, reason: 'Exceeds grid bounds.' };

  const heights = footprint.map(f => yard[f.key] ? yard[f.key].length : 0);
  const baseHeight = heights[0];

  if (baseHeight >= MAX_STACK_HEIGHT) {
    return { valid: false, reason: 'Stack full at this location.' };
  }

  if (!heights.every(h => h === baseHeight)) {
    return { valid: false, reason: 'Uneven stack heights across footprint.' };
  }

  if (baseHeight > 0) {
    const supportingIds = new Set();
    footprint.forEach(f => {
      const stack = yard[f.key];
      if (stack && stack.length >= baseHeight) {
        supportingIds.add(stack[baseHeight - 1]);
      }
    });

    for (const supId of supportingIds) {
      const supContainer = containerMap[supId];
      if (supContainer) {
        const isFullyCovered = supContainer.footprint.every(sf =>
          footprint.some(f => f.key === sf.key)
        );
        if (!isFullyCovered) {
          return { valid: false, reason: `Invalid Stack: Footprint must fully cover the supporting container (${supId}).` };
        }
      }
    }
  }

  return { valid: true, footprint, level: baseHeight };
};

export const isBlocked = (yard, containerMap, id) => {
  const c = containerMap[id];
  if (!c) return false;
  for (const f of c.footprint) {
    const stack = yard[f.key];
    if (stack && stack[stack.length - 1] !== id) return true;
  }
  return false;
};

export const recalculateAllLevels = (yard, containerMap) => {
  const updated = {};
  Object.values(containerMap).forEach(c => {
    const firstKey = c.footprint[0].key;
    const stack = yard[firstKey];
    updated[c.id] = { ...c, level: stack ? stack.indexOf(c.id) : c.level };
  });
  return updated;
};
