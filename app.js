(() => {
  "use strict";

  const STORAGE_KEY = "room-picture-state-v1";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ROOM_MIN = 100;
  const ROOM_MAX = 2000;
  const GRID_MIN = 1;
  const GRID_MAX = 100;

  const presets = [
    { type: "bed", name: "침대", width: 110, depth: 200, kind: "furniture", icon: "<rect x='3' y='7' width='18' height='12' rx='2'/><path d='M3 12h18M7 7v5'/>" },
    { type: "desk", name: "책상", width: 120, depth: 60, kind: "furniture", icon: "<rect x='3' y='5' width='18' height='6' rx='1'/><path d='M6 11v8M18 11v8M4 19h4M16 19h4'/>" },
    { type: "wardrobe", name: "옷장", width: 100, depth: 60, kind: "furniture", icon: "<rect x='4' y='3' width='16' height='18' rx='1'/><path d='M12 3v18M9 12h.01M15 12h.01'/>" },
    { type: "drawer", name: "서랍장", width: 80, depth: 45, kind: "furniture", icon: "<rect x='4' y='4' width='16' height='16' rx='1'/><path d='M4 9h16M4 14h16M10 7h4M10 12h4M10 17h4'/>" },
    { type: "table", name: "테이블", width: 80, depth: 80, kind: "furniture", icon: "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='2'/>" },
    { type: "sofa", name: "소파", width: 180, depth: 85, kind: "furniture", icon: "<path d='M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M4 10h16a2 2 0 0 1 2 2v6H2v-6a2 2 0 0 1 2-2ZM5 18v2M19 18v2M8 10v5M16 10v5'/>" },
    { type: "chair", name: "의자", width: 50, depth: 50, kind: "furniture", icon: "<rect x='6' y='4' width='12' height='9' rx='2'/><path d='M8 13v7M16 13v7M6 17h12'/>" },
    { type: "fridge", name: "냉장고", width: 70, depth: 70, kind: "furniture", icon: "<rect x='6' y='3' width='12' height='18' rx='2'/><path d='M6 11h12M9 7v2M9 14v3'/>" },
    { type: "washer", name: "세탁기", width: 60, depth: 65, kind: "furniture", icon: "<rect x='4' y='3' width='16' height='18' rx='2'/><circle cx='12' cy='13' r='5'/><path d='M7 6h.01M10 6h3'/>" },
    { type: "door", name: "문", width: 90, depth: 12, kind: "opening", icon: "<path d='M5 21V4h11v17M16 21h4M12 13h.01'/><path d='M5 21h11'/>" },
    { type: "window", name: "창문", width: 120, depth: 12, kind: "opening", icon: "<rect x='3' y='5' width='18' height='14'/><path d='M12 5v14M3 12h18'/>" },
    { type: "column", name: "기둥", width: 40, depth: 40, kind: "structure", icon: "<rect x='5' y='5' width='14' height='14'/><path d='m5 5 14 14M19 5 5 19'/>" }
  ];

  const zonePresets = [
    { type: "living", name: "방·거실", width: 260, depth: 260 },
    { type: "bathroom", name: "화장실", width: 140, depth: 180 },
    { type: "kitchen", name: "주방", width: 180, depth: 120 },
    { type: "entry", name: "현관", width: 100, depth: 140 },
    { type: "balcony", name: "발코니", width: 180, depth: 90 },
    { type: "custom", name: "기타 공간", width: 160, depth: 160 }
  ];

  const initialState = {
    room: { name: "나의 자취방", width: 360, depth: 320, grid: 20, notes: "" },
    zones: [],
    items: [],
    selectedId: null,
    snap: true,
    showGrid: true,
    checks: {}
  };

  let state = loadState();
  let undoStack = [];
  let redoStack = [];
  let drag = null;
  let toastTimer = null;
  let saveTimer = null;
  let shapeEditId = null;
  let selectedVertexIndex = null;
  const zoneLabelCache = new WeakMap();

  const el = {};
  const ids = [
    "saveState", "undoBtn", "redoBtn", "exportMenuBtn", "roomWidth", "roomDepth", "applyRoomBtn",
    "zoneGrid", "furnitureGrid", "customFurnitureBtn", "roomNotes", "roomName", "roomSummary", "gridToggle", "gridSize", "snapToggle",
    "resetViewBtn", "canvasFrame", "floorPlan", "emptyHint", "mobileZoneList", "mobileFurnitureList", "nothingSelected",
    "itemInspector", "itemName", "itemWidth", "itemDepth", "itemX", "itemY", "deleteItemBtn", "rotateItemBtn",
    "zoneInspector", "zoneName", "zoneType", "zoneWidth", "zoneDepth", "zoneX", "zoneY", "deleteZoneBtn",
    "duplicateZoneBtn", "zoneFitStatus", "zoneShapeEditBtn", "shapeEditTools", "deleteVertexBtn", "resetZoneShapeBtn",
    "duplicateItemBtn", "fitStatus", "customDialog", "customForm", "customName", "customWidth", "customDepth",
    "confirmCustomBtn", "exportDialog", "closeExportBtn", "exportPngBtn", "exportJsonBtn", "importJsonInput", "toast"
  ];
  ids.forEach(id => el[id] = document.getElementById(id));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(initialState);
      const parsed = JSON.parse(raw);
      if (!isValidState(parsed)) return structuredClone(initialState);
      const loaded = {
        ...structuredClone(initialState),
        ...parsed,
        room: { ...initialState.room, ...parsed.room },
        selectedId: null
      };
      loaded.room.grid = normalizeGrid(loaded.room.grid);
      return loaded;
    } catch (_) {
      return structuredClone(initialState);
    }
  }

  function isValidState(candidate) {
    return candidate && candidate.room && Array.isArray(candidate.items)
      && Number.isFinite(Number(candidate.room.width)) && Number.isFinite(Number(candidate.room.depth));
  }

  function snapshot() {
    return JSON.stringify({
      room: state.room,
      items: state.items,
      zones: state.zones,
      selectedId: state.selectedId,
      snap: state.snap,
      showGrid: state.showGrid,
      checks: state.checks
    });
  }

  function pushHistory() {
    const current = snapshot();
    if (undoStack.at(-1) !== current) undoStack.push(current);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function restore(serialized) {
    const restored = JSON.parse(serialized);
    state = { ...structuredClone(initialState), ...restored, room: { ...initialState.room, ...restored.room } };
    state.room.grid = normalizeGrid(state.room.grid);
    shapeEditId = null;
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    showToast("이전 상태로 되돌렸어요");
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    showToast("다시 적용했어요");
  }

  function updateHistoryButtons() {
    el.undoBtn.disabled = undoStack.length === 0;
    el.redoBtn.disabled = redoStack.length === 0;
  }

  function scheduleSave() {
    el.saveState.textContent = "저장 중…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const persistent = JSON.parse(snapshot());
        persistent.selectedId = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
        el.saveState.textContent = "자동 저장됨";
      } catch (_) {
        el.saveState.textContent = "저장할 수 없음";
      }
    }, 220);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function number(value, fallback, min = -Infinity, max = Infinity) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
  }

  function normalizeGrid(value, fallback = initialState.room.grid) {
    if (value === null || value === undefined || String(value).trim() === "") return fallback;
    return Math.round(number(value, fallback, GRID_MIN, GRID_MAX));
  }

  function uid(prefix = "item") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function getFootprint(item) {
    return item.rotation % 180 === 90
      ? { width: item.depth, depth: item.width }
      : { width: item.width, depth: item.depth };
  }

  function selectedItem() {
    return state.items.find(item => item.id === state.selectedId) || null;
  }

  function selectedZone() {
    return state.zones.find(zone => zone.id === state.selectedId) || null;
  }

  function keepInside(item) {
    const footprint = getFootprint(item);
    item.x = clamp(item.x, 0, Math.max(0, state.room.width - footprint.width));
    item.y = clamp(item.y, 0, Math.max(0, state.room.depth - footprint.depth));
  }

  function keepZoneInside(zone) {
    zone.x = clamp(zone.x, 0, Math.max(0, state.room.width - zone.width));
    zone.y = clamp(zone.y, 0, Math.max(0, state.room.depth - zone.depth));
  }

  function getZoneLocalPoints(zone) {
    if (Array.isArray(zone.points) && zone.points.length >= 3) return zone.points;
    return [{ x: 0, y: 0 }, { x: zone.width, y: 0 }, { x: zone.width, y: zone.depth }, { x: 0, y: zone.depth }];
  }

  function getZoneAbsolutePoints(zone) {
    return getZoneLocalPoints(zone).map(point => ({ x: zone.x + point.x, y: zone.y + point.y }));
  }

  function pointOnSegment(x, y, a, b) {
    const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    if (Math.abs(cross) > .01) return false;
    const dot = (x - a.x) * (x - b.x) + (y - a.y) * (y - b.y);
    return dot <= .01;
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
      const current = points[index];
      const previous = points[previousIndex];
      if (pointOnSegment(x, y, previous, current)) return true;
      const intersects = ((current.y > y) !== (previous.y > y)) && (x < (previous.x - current.x) * (y - current.y) / (previous.y - current.y) + current.x);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function polygonCentroid(points) {
    let area = 0;
    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const cross = current.x * next.y - next.x * current.y;
      area += cross;
      centerX += (current.x + next.x) * cross;
      centerY += (current.y + next.y) * cross;
    }
    if (Math.abs(area) > .01) {
      const factor = 1 / (3 * area);
      return { x: centerX * factor, y: centerY * factor };
    }
    return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  }

  function pointToSegmentDistanceSquared(x, y, start, end) {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if (dx !== 0 || dy !== 0) {
      const progress = ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy);
      if (progress > 1) {
        start = end;
      } else if (progress > 0) {
        start = { x: start.x + dx * progress, y: start.y + dy * progress };
      }
    }
    dx = x - start.x;
    dy = y - start.y;
    return dx * dx + dy * dy;
  }

  function signedDistanceToPolygon(x, y, points) {
    let inside = false;
    let minDistanceSquared = Infinity;
    for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
      const current = points[index];
      const previous = points[previousIndex];
      if (((current.y > y) !== (previous.y > y)) && (x < (previous.x - current.x) * (y - current.y) / (previous.y - current.y) + current.x)) inside = !inside;
      minDistanceSquared = Math.min(minDistanceSquared, pointToSegmentDistanceSquared(x, y, previous, current));
    }
    return (inside ? 1 : -1) * Math.sqrt(minDistanceSquared);
  }

  function makeLabelCell(x, y, halfSize, points) {
    const distance = signedDistanceToPolygon(x, y, points);
    return { x, y, halfSize, distance, maxDistance: distance + halfSize * Math.SQRT2 };
  }

  function pushLabelCell(heap, cell) {
    heap.push(cell);
    let index = heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (heap[parentIndex].maxDistance >= cell.maxDistance) break;
      heap[index] = heap[parentIndex];
      index = parentIndex;
    }
    heap[index] = cell;
  }

  function popLabelCell(heap) {
    const root = heap[0];
    const end = heap.pop();
    if (heap.length && end) {
      let index = 0;
      while (true) {
        const leftIndex = index * 2 + 1;
        const rightIndex = leftIndex + 1;
        if (leftIndex >= heap.length) break;
        const childIndex = rightIndex < heap.length && heap[rightIndex].maxDistance > heap[leftIndex].maxDistance ? rightIndex : leftIndex;
        if (heap[childIndex].maxDistance <= end.maxDistance) break;
        heap[index] = heap[childIndex];
        index = childIndex;
      }
      heap[index] = end;
    }
    return root;
  }

  function findBestLabelPoint(points) {
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const cellSize = Math.min(width, height);
    if (!Number.isFinite(cellSize) || cellSize <= 0) return { ...polygonCentroid(points), clearance: 0 };

    const heap = [];
    const halfSize = cellSize / 2;
    for (let x = minX; x < maxX; x += cellSize) {
      for (let y = minY; y < maxY; y += cellSize) pushLabelCell(heap, makeLabelCell(x + halfSize, y + halfSize, halfSize, points));
    }

    const centroid = polygonCentroid(points);
    let best = makeLabelCell(centroid.x, centroid.y, 0, points);
    const boxCenter = makeLabelCell(minX + width / 2, minY + height / 2, 0, points);
    if (boxCenter.distance > best.distance) best = boxCenter;
    const precision = Math.max(.5, cellSize / 500);
    let iterations = 0;
    while (heap.length && iterations < 20000) {
      const cell = popLabelCell(heap);
      iterations += 1;
      if (cell.distance > best.distance) best = cell;
      if (cell.maxDistance - best.distance <= precision) continue;
      const nextHalfSize = cell.halfSize / 2;
      pushLabelCell(heap, makeLabelCell(cell.x - nextHalfSize, cell.y - nextHalfSize, nextHalfSize, points));
      pushLabelCell(heap, makeLabelCell(cell.x + nextHalfSize, cell.y - nextHalfSize, nextHalfSize, points));
      pushLabelCell(heap, makeLabelCell(cell.x - nextHalfSize, cell.y + nextHalfSize, nextHalfSize, points));
      pushLabelCell(heap, makeLabelCell(cell.x + nextHalfSize, cell.y + nextHalfSize, nextHalfSize, points));
    }
    return { x: best.x, y: best.y, clearance: Math.max(0, best.distance) };
  }

  function polygonSpanAt(points, coordinate, horizontal) {
    const intersections = [];
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const startAxis = horizontal ? start.y : start.x;
      const endAxis = horizontal ? end.y : end.x;
      if (!((startAxis <= coordinate && endAxis > coordinate) || (endAxis <= coordinate && startAxis > coordinate))) continue;
      const progress = (coordinate - startAxis) / (endAxis - startAxis);
      intersections.push((horizontal ? start.x : start.y) + ((horizontal ? end.x : end.y) - (horizontal ? start.x : start.y)) * progress);
    }
    intersections.sort((a, b) => a - b);
    return intersections;
  }

  function containingSpan(intersections, position) {
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      if (position >= intersections[index] - .01 && position <= intersections[index + 1] + .01) return [intersections[index], intersections[index + 1]];
    }
    return null;
  }

  function estimateTextWidth(text, fontSize) {
    return [...text].reduce((width, character) => {
      if (/\s/.test(character)) return width + fontSize * .35;
      if (character === "…") return width + fontSize;
      if (/[·.,:×-]/.test(character)) return width + fontSize * .55;
      if (/^[\x00-\x7F]$/.test(character)) return width + fontSize * .62;
      return width + fontSize;
    }, 0);
  }

  function getRoomViewport(room = state.room) {
    const margin = Math.max(42, Math.min(room.width, room.depth) * .15);
    return {
      margin,
      width: room.width + margin * 2,
      height: room.depth + margin * 2
    };
  }

  function getPlanTextScale(room = state.room) {
    const viewport = getRoomViewport(room);
    const reference = getRoomViewport(initialState.room);
    const bounds = el.floorPlan?.getBoundingClientRect();
    const displayWidth = Math.max(1, bounds?.width || viewport.width);
    const displayHeight = Math.max(1, bounds?.height || viewport.height);
    const currentUnitsPerPixel = Math.max(viewport.width / displayWidth, viewport.height / displayHeight);
    const referenceUnitsPerPixel = Math.max(reference.width / displayWidth, reference.height / displayHeight);
    return clamp(currentUnitsPerPixel / referenceUnitsPerPixel, 1, 6);
  }

  function getContainedLabelLayout(name, dimensions, width, height, textScale, nameBaseSize, dimensionBaseSize) {
    const innerWidth = Math.max(0, width - 10);
    const innerHeight = Math.max(0, height - 10);
    const desiredNameSize = nameBaseSize * textScale;
    const desiredDimensionSize = dimensionBaseSize * textScale;
    let nameFontSize = Math.min(desiredNameSize, innerHeight * .72);
    let visibleName = compactName(name, innerWidth, nameFontSize);

    if (!visibleName && name) {
      const shortestLabel = `${[...name][0]}…`;
      nameFontSize = Math.min(nameFontSize, innerWidth / Math.max(estimateTextWidth(shortestLabel, 1), 1));
      visibleName = compactName(name, innerWidth, nameFontSize);
    }

    if (!visibleName || nameFontSize < desiredNameSize * .55) {
      return { name: "", dimensions: "", nameFontSize: 0, dimensionFontSize: 0, nameOffset: 0, dimensionOffset: 0, availableWidth: innerWidth };
    }

    const dimensionFontSize = Math.min(
      desiredDimensionSize,
      innerWidth / Math.max(estimateTextWidth(dimensions, 1), 1)
    );
    const gap = 3 * textScale;
    const showDimensions = dimensions
      && dimensionFontSize >= desiredDimensionSize * .62
      && innerHeight >= nameFontSize + dimensionFontSize + gap;

    if (!showDimensions) {
      return { name: visibleName, dimensions: "", nameFontSize, dimensionFontSize: 0, nameOffset: 0, dimensionOffset: 0, availableWidth: innerWidth };
    }

    return {
      name: visibleName,
      dimensions,
      nameFontSize,
      dimensionFontSize,
      nameOffset: -(dimensionFontSize + gap) / 2,
      dimensionOffset: (nameFontSize + gap) / 2,
      availableWidth: innerWidth
    };
  }

  function getZoneLabelLayout(zone) {
    const points = getZoneLocalPoints(zone);
    const textScale = getPlanTextScale();
    const key = `${zone.name}|${zone.width}|${zone.depth}|${textScale.toFixed(4)}|${points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(";")}`;
    const cached = zoneLabelCache.get(zone);
    if (cached?.key === key) return cached.layout;

    const point = findBestLabelPoint(points);
    const horizontalSpan = containingSpan(polygonSpanAt(points, point.y, true), point.x);
    const verticalSpan = containingSpan(polygonSpanAt(points, point.x, false), point.y);
    const safeWidth = horizontalSpan ? 2 * Math.min(point.x - horizontalSpan[0], horizontalSpan[1] - point.x) : point.clearance * 2;
    const safeHeight = verticalSpan ? 2 * Math.min(point.y - verticalSpan[0], verticalSpan[1] - point.y) : point.clearance * 2;
    const dimensions = `${Math.round(zone.width)}×${Math.round(zone.depth)}`;
    const layout = {
      x: point.x,
      y: point.y,
      ...getContainedLabelLayout(zone.name, dimensions, safeWidth, safeHeight, textScale, 16, 10)
    };
    zoneLabelCache.set(zone, { key, layout });
    return layout;
  }

  function normalizeZonePoints(zone) {
    const absolute = getZoneAbsolutePoints(zone);
    const minX = Math.min(...absolute.map(point => point.x));
    const minY = Math.min(...absolute.map(point => point.y));
    const maxX = Math.max(...absolute.map(point => point.x));
    const maxY = Math.max(...absolute.map(point => point.y));
    zone.x = clamp(minX, 0, state.room.width);
    zone.y = clamp(minY, 0, state.room.depth);
    zone.width = Math.max(1, maxX - minX);
    zone.depth = Math.max(1, maxY - minY);
    zone.points = absolute.map(point => ({ x: point.x - minX, y: point.y - minY }));
    keepZoneInside(zone);
  }

  function isPointInsideAnyZone(x, y) {
    return state.zones.some(zone => pointInPolygon(x, y, getZoneAbsolutePoints(zone)));
  }

  function isRectCoveredByZones(rect) {
    if (!state.zones.length) return false;
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.depth;
    const boundaryChecks = [
      [rect.x, rect.y], [right, rect.y],
      [right, bottom], [rect.x, bottom],
      [(rect.x + right) / 2, rect.y], [right, (rect.y + bottom) / 2],
      [(rect.x + right) / 2, bottom], [rect.x, (rect.y + bottom) / 2]
    ];
    if (boundaryChecks.some(([x, y]) => !isPointInsideAnyZone(x, y))) return false;

    const allPoints = state.zones.flatMap(getZoneAbsolutePoints);
    const xs = [rect.x, right, ...allPoints.map(point => point.x).filter(x => x > rect.x && x < right)].sort((a, b) => a - b);
    const ys = [rect.y, bottom, ...allPoints.map(point => point.y).filter(y => y > rect.y && y < bottom)].sort((a, b) => a - b);
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const middleX = (xs[xi] + xs[xi + 1]) / 2;
        const middleY = (ys[yi] + ys[yi + 1]) / 2;
        if (!isPointInsideAnyZone(middleX, middleY)) return false;
      }
    }
    return true;
  }

  function addItem(preset) {
    pushHistory();
    const item = {
      id: uid(),
      type: preset.type || "custom",
      name: preset.name,
      width: number(preset.width, 100, 10, 1000),
      depth: number(preset.depth, 60, 10, 1000),
      x: 0,
      y: 0,
      rotation: 0,
      kind: preset.kind || "furniture"
    };
    const fp = getFootprint(item);
    const offset = (state.items.length % 5) * 10;
    item.x = clamp((state.room.width - fp.width) / 2 + offset, 0, state.room.width - fp.width);
    item.y = clamp((state.room.depth - fp.depth) / 2 + offset, 0, state.room.depth - fp.depth);
    if (state.snap) {
      item.x = Math.round(item.x / state.room.grid) * state.room.grid;
      item.y = Math.round(item.y / state.room.grid) * state.room.grid;
      keepInside(item);
    }
    state.items.push(item);
    state.selectedId = item.id;
    renderAll();
    scheduleSave();
    showToast(`${item.name}을(를) 추가했어요`);
  }

  function deleteSelected() {
    const item = selectedItem();
    if (!item) return;
    pushHistory();
    state.items = state.items.filter(candidate => candidate.id !== item.id);
    state.selectedId = null;
    renderAll();
    scheduleSave();
    showToast(`${item.name}을(를) 삭제했어요`);
  }

  function duplicateSelected() {
    const original = selectedItem();
    if (!original) return;
    pushHistory();
    const copy = { ...original, id: uid(), name: `${original.name} 복사본`, x: original.x + state.room.grid, y: original.y + state.room.grid };
    keepInside(copy);
    state.items.push(copy);
    state.selectedId = copy.id;
    renderAll();
    scheduleSave();
    showToast("가구를 복제했어요");
  }

  function rotateSelected() {
    const item = selectedItem();
    if (!item) return;
    pushHistory();
    const old = getFootprint(item);
    const centerX = item.x + old.width / 2;
    const centerY = item.y + old.depth / 2;
    item.rotation = (item.rotation + 90) % 180;
    const next = getFootprint(item);
    item.x = centerX - next.width / 2;
    item.y = centerY - next.depth / 2;
    if (state.snap) {
      item.x = Math.round(item.x / state.room.grid) * state.room.grid;
      item.y = Math.round(item.y / state.room.grid) * state.room.grid;
    }
    keepInside(item);
    renderAll();
    scheduleSave();
  }

  function addZone(preset) {
    pushHistory();
    const zone = {
      id: uid("zone"),
      type: preset.type || "custom",
      name: preset.name || "새 구역",
      x: 0,
      y: 0,
      width: number(preset.width, 160, 20, ROOM_MAX),
      depth: number(preset.depth, 160, 20, ROOM_MAX)
    };
    const offset = (state.zones.length % 5) * state.room.grid;
    zone.x = clamp((state.room.width - zone.width) / 2 + offset, 0, state.room.width - zone.width);
    zone.y = clamp((state.room.depth - zone.depth) / 2 + offset, 0, state.room.depth - zone.depth);
    if (state.snap) {
      zone.x = Math.round(zone.x / state.room.grid) * state.room.grid;
      zone.y = Math.round(zone.y / state.room.grid) * state.room.grid;
    }
    keepZoneInside(zone);
    state.zones.push(zone);
    state.selectedId = zone.id;
    shapeEditId = null;
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
    showToast(`${zone.name} 구역을 추가했어요`);
  }

  function deleteSelectedZone() {
    const zone = selectedZone();
    if (!zone) return;
    pushHistory();
    state.zones = state.zones.filter(candidate => candidate.id !== zone.id);
    state.selectedId = null;
    shapeEditId = null;
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
    showToast(`${zone.name} 구역을 삭제했어요`);
  }

  function duplicateSelectedZone() {
    const original = selectedZone();
    if (!original) return;
    pushHistory();
    const copy = {
      ...structuredClone(original),
      id: uid("zone"),
      name: `${original.name} 복사본`,
      x: original.x + state.room.grid,
      y: original.y + state.room.grid
    };
    keepZoneInside(copy);
    state.zones.push(copy);
    state.selectedId = copy.id;
    shapeEditId = null;
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
    showToast("구역을 복제했어요");
  }

  function renderFurnitureLibrary() {
    el.zoneGrid.innerHTML = "";
    el.mobileZoneList.innerHTML = "";
    zonePresets.forEach(preset => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "zone-button";
      button.dataset.type = preset.type;
      button.setAttribute("aria-label", `${preset.name} 구역 ${preset.width} × ${preset.depth}cm 추가`);
      button.innerHTML = `<span class="zone-swatch" aria-hidden="true"></span><span>${preset.name}</span>`;
      button.addEventListener("click", () => addZone(preset));
      el.zoneGrid.appendChild(button);

      const mobile = document.createElement("button");
      mobile.type = "button";
      mobile.className = "mobile-furniture-btn";
      mobile.textContent = `+ ${preset.name}`;
      mobile.addEventListener("click", () => addZone(preset));
      el.mobileZoneList.appendChild(mobile);
    });
    el.furnitureGrid.innerHTML = "";
    el.mobileFurnitureList.innerHTML = "";
    presets.forEach(preset => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "furniture-button";
      button.dataset.type = preset.type;
      button.setAttribute("aria-label", `${preset.name} ${preset.width} × ${preset.depth}cm 추가`);
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${preset.icon}</svg><span>${preset.name}</span>`;
      button.addEventListener("click", () => addItem(preset));
      el.furnitureGrid.appendChild(button);

      const mobile = document.createElement("button");
      mobile.type = "button";
      mobile.className = "mobile-furniture-btn";
      mobile.textContent = `+ ${preset.name}`;
      mobile.addEventListener("click", () => addItem(preset));
      el.mobileFurnitureList.appendChild(mobile);
    });
    const customMobile = document.createElement("button");
    customMobile.type = "button";
    customMobile.className = "mobile-furniture-btn";
    customMobile.textContent = "+ 직접 입력";
    customMobile.addEventListener("click", openCustomDialog);
    el.mobileFurnitureList.appendChild(customMobile);
  }

  function svgNode(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function renderPlan() {
    const room = state.room;
    const { margin } = getRoomViewport(room);
    const textScale = getPlanTextScale(room);
    el.floorPlan.setAttribute("viewBox", `${-margin} ${-margin} ${room.width + margin * 2} ${room.depth + margin * 2}`);
    el.floorPlan.innerHTML = "";

    const title = svgNode("title", { id: "planTitle" });
    title.textContent = `${room.name}, 가로 ${room.width}cm 세로 ${room.depth}cm 평면도`;
    const desc = svgNode("desc", { id: "planDesc" });
    desc.textContent = `구역 ${state.zones.length}개와 가구 ${state.items.length}개가 배치되어 있습니다. 구역과 가구를 누르고 드래그해 이동할 수 있습니다.`;
    el.floorPlan.append(title, desc);

    const defs = svgNode("defs");
    const pattern = svgNode("pattern", { id: "roomGrid", width: room.grid, height: room.grid, patternUnits: "userSpaceOnUse" });
    pattern.appendChild(svgNode("path", { d: `M ${room.grid} 0 L 0 0 0 ${room.grid}`, class: "grid-line", fill: "none" }));
    defs.appendChild(pattern);
    el.floorPlan.appendChild(defs);

    el.floorPlan.appendChild(svgNode("rect", { x: 0, y: 0, width: room.width, height: room.depth, rx: 2, class: "room-floor" }));
    if (state.showGrid) el.floorPlan.appendChild(svgNode("rect", { x: 0, y: 0, width: room.width, height: room.depth, class: "grid-fill", "pointer-events": "none" }));

    state.zones.forEach(zone => {
      const group = svgNode("g", {
        class: `zone-item${zone.id === state.selectedId ? " is-selected" : ""}`,
        "data-id": zone.id,
        "data-type": zone.type,
        role: "button",
        "aria-label": `${zone.name} 구역, ${zone.width} × ${zone.depth}cm, 왼쪽 ${Math.round(zone.x)}cm, 위쪽 ${Math.round(zone.y)}cm`
      });
      if (zone.id === state.selectedId) {
        group.appendChild(svgNode("rect", { x: zone.x - 6, y: zone.y - 6, width: zone.width + 12, height: zone.depth + 12, rx: 4, class: "selection-halo" }));
      }
      const absolutePoints = getZoneAbsolutePoints(zone);
      const pointsText = absolutePoints.map(point => `${point.x},${point.y}`).join(" ");
      const clip = svgNode("clipPath", { id: `clip-${zone.id}` });
      clip.appendChild(svgNode("polygon", { points: pointsText }));
      defs.appendChild(clip);
      group.appendChild(svgNode("polygon", { points: pointsText, class: "zone-shape" }));
      if (state.showGrid) group.appendChild(svgNode("rect", { x: zone.x, y: zone.y, width: zone.width, height: zone.depth, class: "grid-fill", "clip-path": `url(#clip-${zone.id})`, "pointer-events": "none" }));

      const labelLayout = getZoneLabelLayout(zone);
      if (labelLayout.name) {
        const labelGroup = svgNode("g", { class: "zone-label-group", "clip-path": `url(#clip-${zone.id})`, "pointer-events": "none" });
        const label = svgNode("text", {
          x: zone.x + labelLayout.x,
          y: zone.y + labelLayout.y + labelLayout.nameOffset,
          class: "zone-label",
          "font-size": labelLayout.nameFontSize,
          style: `font-size: ${labelLayout.nameFontSize}px`,
          "dominant-baseline": "middle"
        });
        label.textContent = labelLayout.name;
        labelGroup.appendChild(label);
        if (labelLayout.dimensions) {
          const dim = svgNode("text", {
            x: zone.x + labelLayout.x,
            y: zone.y + labelLayout.y + labelLayout.dimensionOffset,
            class: "zone-dim",
            "font-size": labelLayout.dimensionFontSize,
            style: `font-size: ${labelLayout.dimensionFontSize}px`,
            "dominant-baseline": "middle"
          });
          dim.textContent = labelLayout.dimensions;
          labelGroup.appendChild(dim);
        }
        group.appendChild(labelGroup);
      }

      group.addEventListener("pointerdown", startZoneDrag);
      group.addEventListener("click", event => {
        event.stopPropagation();
        selectZone(zone.id);
      });
      el.floorPlan.appendChild(group);
    });

    const widthLabel = svgNode("text", { x: room.width / 2, y: -16, class: "wall-label" });
    widthLabel.textContent = `${room.width} cm`;
    const depthLabel = svgNode("text", { x: -19, y: room.depth / 2, class: "wall-label", transform: `rotate(-90 -19 ${room.depth / 2})` });
    depthLabel.textContent = `${room.depth} cm`;
    el.floorPlan.append(widthLabel, depthLabel);

    state.items.forEach(item => {
      const fp = getFootprint(item);
      const group = svgNode("g", {
        class: `furniture-item${item.id === state.selectedId ? " is-selected" : ""}`,
        "data-id": item.id,
        "data-kind": item.kind,
        role: "button",
        "aria-label": `${item.name}, ${item.width} × ${item.depth}cm, 왼쪽 벽에서 ${Math.round(item.x)}cm, 위쪽 벽에서 ${Math.round(item.y)}cm`
      });
      if (item.id === state.selectedId) {
        group.appendChild(svgNode("rect", {
          x: item.x - 5, y: item.y - 5, width: fp.width + 10, height: fp.depth + 10, rx: 4, class: "selection-halo"
        }));
      }
      group.appendChild(svgNode("rect", { x: item.x, y: item.y, width: fp.width, height: fp.depth, rx: Math.min(6, fp.width / 10, fp.depth / 10), class: "furniture-shape" }));
      addItemSymbol(group, item, fp);

      const itemLabelLayout = getContainedLabelLayout(
        item.name,
        `${item.width}×${item.depth}`,
        fp.width,
        fp.depth,
        textScale,
        13,
        9
      );
      if (itemLabelLayout.name) {
        const label = svgNode("text", {
          x: item.x + fp.width / 2,
          y: item.y + fp.depth / 2 + itemLabelLayout.nameOffset,
          class: "item-label",
          "font-size": itemLabelLayout.nameFontSize,
          style: `font-size: ${itemLabelLayout.nameFontSize}px`,
          "dominant-baseline": "middle"
        });
        label.textContent = itemLabelLayout.name;
        group.appendChild(label);
      }
      if (itemLabelLayout.dimensions) {
        const dim = svgNode("text", {
          x: item.x + fp.width / 2,
          y: item.y + fp.depth / 2 + itemLabelLayout.dimensionOffset,
          class: "item-dim",
          "font-size": itemLabelLayout.dimensionFontSize,
          style: `font-size: ${itemLabelLayout.dimensionFontSize}px`,
          "dominant-baseline": "middle"
        });
        dim.textContent = itemLabelLayout.dimensions;
        group.appendChild(dim);
      }

      group.addEventListener("pointerdown", startDrag);
      group.addEventListener("click", event => {
        event.stopPropagation();
        selectItem(item.id);
      });
      el.floorPlan.appendChild(group);
    });

    const activeItem = selectedItem();
    if (activeItem) {
      const footprint = getFootprint(activeItem);
      renderEdgeDimensions([
        { x: activeItem.x, y: activeItem.y },
        { x: activeItem.x + footprint.width, y: activeItem.y },
        { x: activeItem.x + footprint.width, y: activeItem.y + footprint.depth },
        { x: activeItem.x, y: activeItem.y + footprint.depth }
      ]);
    }
    const activeZone = selectedZone();
    if (activeZone) {
      renderEdgeDimensions(getZoneAbsolutePoints(activeZone));
      renderZoneControls(activeZone);
    }
    el.emptyHint.hidden = state.zones.length !== 0;
  }

  function renderZoneControls(zone) {
    const handleSize = Math.max(8, Math.min(state.room.width, state.room.depth) / 36);
    const layer = svgNode("g", { class: "zone-control-layer", "data-id": zone.id });
    layer.appendChild(svgNode("rect", { x: zone.x, y: zone.y, width: zone.width, height: zone.depth, class: "zone-bounds" }));

    if (shapeEditId === zone.id) {
      const points = getZoneAbsolutePoints(zone);
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const middleX = (point.x + next.x) / 2;
        const middleY = (point.y + next.y) / 2;
        const edge = svgNode("circle", { cx: middleX, cy: middleY, r: handleSize * .48, class: "edge-handle" });
        edge.dataset.id = zone.id;
        edge.dataset.edgeIndex = index;
        edge.setAttribute("aria-label", `${index + 1}번 변에 꼭짓점 추가`);
        edge.addEventListener("pointerdown", startAddVertex);
        layer.appendChild(edge);
        const plus = svgNode("text", { x: middleX, y: middleY, class: "edge-plus", "font-size": handleSize * .9 });
        plus.textContent = "+";
        layer.appendChild(plus);
      });

      points.forEach((point, index) => {
        const vertex = svgNode("circle", { cx: point.x, cy: point.y, r: handleSize * .62, class: `vertex-handle${selectedVertexIndex === index ? " is-active" : ""}` });
        vertex.dataset.id = zone.id;
        vertex.dataset.vertexIndex = index;
        vertex.setAttribute("aria-label", `${index + 1}번 꼭짓점 이동`);
        vertex.addEventListener("pointerdown", startVertexDrag);
        layer.appendChild(vertex);
      });
    } else {
      const handles = { nw: [zone.x, zone.y], n: [zone.x + zone.width / 2, zone.y], ne: [zone.x + zone.width, zone.y], e: [zone.x + zone.width, zone.y + zone.depth / 2], se: [zone.x + zone.width, zone.y + zone.depth], s: [zone.x + zone.width / 2, zone.y + zone.depth], sw: [zone.x, zone.y + zone.depth], w: [zone.x, zone.y + zone.depth / 2] };
      Object.entries(handles).forEach(([name, [x, y]]) => {
        const handle = svgNode("rect", { x: x - handleSize / 2, y: y - handleSize / 2, width: handleSize, height: handleSize, rx: handleSize * .15, class: "resize-handle", "data-handle": name });
        handle.dataset.id = zone.id;
        handle.dataset.handle = name;
        handle.setAttribute("aria-label", `${name} 방향으로 구역 크기 조절`);
        handle.addEventListener("pointerdown", startZoneResize);
        layer.appendChild(handle);
      });
    }

    el.floorPlan.appendChild(layer);
  }

  function compactName(name, availableWidth, fontSize = 16) {
    if (estimateTextWidth(name, fontSize) <= availableWidth) return name;
    let compacted = "";
    for (const character of name) {
      if (estimateTextWidth(`${compacted}${character}…`, fontSize) > availableWidth) break;
      compacted += character;
    }
    return compacted ? `${compacted}…` : "";
  }

  function formatEdgeLength(length) {
    const rounded = Math.round(length * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} cm`;
  }

  function renderEdgeDimensions(points) {
    if (!Array.isArray(points) || points.length < 2) return;
    const textScale = getPlanTextScale();
    const fontSize = 8 * textScale;
    const horizontalPadding = 8 * textScale;
    const baseOffset = fontSize + 7 * textScale;
    const labelHeight = fontSize + 6 * textScale;
    const area = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    const outwardDirection = area >= 0 ? 1 : -1;
    const layer = svgNode("g", { class: "edge-dimension-layer", "aria-hidden": "true", "pointer-events": "none" });

    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const length = Math.hypot(dx, dy);
      if (length < .1) return;

      const text = formatEdgeLength(length);
      const labelWidth = estimateTextWidth(text, fontSize) + horizontalPadding;
      const extraOffset = length < labelWidth + 4 * textScale ? (index % 2) * (fontSize + 7 * textScale) : 0;
      const offset = baseOffset + extraOffset;
      const normalX = outwardDirection * dy / length;
      const normalY = outwardDirection * -dx / length;
      const x = (point.x + next.x) / 2 + normalX * offset;
      const y = (point.y + next.y) / 2 + normalY * offset;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;

      const label = svgNode("g", { class: "edge-dimension", transform: `translate(${x} ${y}) rotate(${angle})` });
      label.appendChild(svgNode("rect", { x: -labelWidth / 2, y: -labelHeight / 2, width: labelWidth, height: labelHeight, rx: labelHeight / 2, class: "edge-dimension-bg" }));
      const value = svgNode("text", { x: 0, y: 0, class: "edge-dimension-text", "font-size": fontSize, "dominant-baseline": "middle" });
      value.textContent = text;
      label.appendChild(value);
      layer.appendChild(label);
    });

    el.floorPlan.appendChild(layer);
  }

  function addItemSymbol(group, item, fp) {
    const x = item.x;
    const y = item.y;
    if (item.type === "bed" && fp.width > 55 && fp.depth > 80) {
      group.appendChild(svgNode("line", { x1: x, y1: y + fp.depth * .25, x2: x + fp.width, y2: y + fp.depth * .25, class: "item-symbol" }));
      group.appendChild(svgNode("rect", { x: x + fp.width * .12, y: y + fp.depth * .06, width: fp.width * .32, height: fp.depth * .14, rx: 3, class: "item-symbol" }));
    } else if (item.type === "wardrobe" && fp.width > 40 && fp.depth > 35) {
      group.appendChild(svgNode("line", { x1: x + fp.width / 2, y1: y, x2: x + fp.width / 2, y2: y + fp.depth, class: "item-symbol" }));
    } else if (item.type === "door") {
      group.appendChild(svgNode("path", { d: `M ${x} ${y + fp.depth} A ${fp.width} ${fp.width} 0 0 1 ${x + Math.min(fp.width, fp.depth * 7.5)} ${y}`, class: "item-symbol" }));
    } else if (item.type === "window") {
      group.appendChild(svgNode("line", { x1: x + 4, y1: y + fp.depth / 2, x2: x + fp.width - 4, y2: y + fp.depth / 2, class: "item-symbol" }));
    } else if (item.type === "column") {
      group.appendChild(svgNode("line", { x1: x, y1: y, x2: x + fp.width, y2: y + fp.depth, class: "item-symbol" }));
      group.appendChild(svgNode("line", { x1: x + fp.width, y1: y, x2: x, y2: y + fp.depth, class: "item-symbol" }));
    }
  }

  function renderInspector() {
    const item = selectedItem();
    const zone = selectedZone();
    el.nothingSelected.hidden = Boolean(item || zone);
    el.itemInspector.hidden = !item;
    el.zoneInspector.hidden = !zone;
    if (item) {
      el.itemName.value = item.name;
      el.itemWidth.value = Math.round(item.width);
      el.itemDepth.value = Math.round(item.depth);
      el.itemX.value = Math.round(item.x);
      el.itemY.value = Math.round(item.y);
      const fp = getFootprint(item);
      el.itemX.max = Math.max(0, state.room.width - fp.width);
      el.itemY.max = Math.max(0, state.room.depth - fp.depth);
      const fits = isRectCoveredByZones({ x: item.x, y: item.y, width: fp.width, depth: fp.depth });
      el.fitStatus.classList.toggle("invalid", !fits);
      el.fitStatus.querySelector("span:last-child").textContent = fits ? "실제 구역 안에 잘 배치되어 있어요" : "가구 일부가 구역 밖으로 나갔어요";
    }
    if (zone) {
      el.zoneName.value = zone.name;
      el.zoneType.value = zone.type;
      el.zoneWidth.value = Math.round(zone.width);
      el.zoneDepth.value = Math.round(zone.depth);
      el.zoneX.value = Math.round(zone.x);
      el.zoneY.value = Math.round(zone.y);
      el.zoneX.max = Math.max(0, state.room.width - zone.width);
      el.zoneY.max = Math.max(0, state.room.depth - zone.depth);
      const fits = zone.width <= state.room.width && zone.depth <= state.room.depth;
      el.zoneFitStatus.classList.toggle("invalid", !fits);
      el.zoneFitStatus.querySelector("span:last-child").textContent = fits ? "전체 도면 안에 들어와 있어요" : "구역이 전체 도면보다 커요";
      const editingShape = shapeEditId === zone.id;
      el.zoneShapeEditBtn.setAttribute("aria-pressed", String(editingShape));
      el.zoneShapeEditBtn.querySelector("span").textContent = editingShape ? "편집 완료" : "모양 편집";
      el.shapeEditTools.hidden = !editingShape;
      el.deleteVertexBtn.disabled = selectedVertexIndex === null || getZoneLocalPoints(zone).length <= 3;
    }
  }

  function renderControls() {
    el.roomWidth.value = state.room.width;
    el.roomDepth.value = state.room.depth;
    el.roomName.value = state.room.name;
    el.roomSummary.textContent = `${state.room.width} × ${state.room.depth} cm · 구역 ${state.zones.length}개 · 가구 ${state.items.length}개`;
    el.roomNotes.value = state.room.notes || "";
    el.gridToggle.checked = state.showGrid;
    el.gridSize.value = state.room.grid;
    el.snapToggle.checked = state.snap;
    document.querySelectorAll("[data-check]").forEach(checkbox => {
      checkbox.checked = Boolean(state.checks?.[checkbox.dataset.check]);
    });
    updateHistoryButtons();
  }

  function renderAll() {
    renderControls();
    renderPlan();
    renderInspector();
  }

  function selectItem(id) {
    if (state.selectedId !== id) state.selectedId = id;
    shapeEditId = null;
    selectedVertexIndex = null;
    renderPlan();
    renderInspector();
  }

  function selectZone(id) {
    if (state.selectedId !== id) {
      state.selectedId = id;
      if (shapeEditId !== id) {
        shapeEditId = null;
        selectedVertexIndex = null;
      }
    }
    renderPlan();
    renderInspector();
  }

  function toggleZoneShapeEdit() {
    const zone = selectedZone();
    if (!zone) return;
    if (shapeEditId === zone.id) {
      shapeEditId = null;
      selectedVertexIndex = null;
      showToast("모양 편집을 마쳤어요");
    } else {
      if (!Array.isArray(zone.points)) zone.points = getZoneLocalPoints(zone).map(point => ({ ...point }));
      shapeEditId = zone.id;
      selectedVertexIndex = null;
      showToast("꼭짓점과 + 핸들을 드래그해 보세요");
    }
    renderAll();
    scheduleSave();
  }

  function resetSelectedZoneShape() {
    const zone = selectedZone();
    if (!zone) return;
    pushHistory();
    zone.points = [{ x: 0, y: 0 }, { x: zone.width, y: 0 }, { x: zone.width, y: zone.depth }, { x: 0, y: zone.depth }];
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
    showToast("직사각형 모양으로 되돌렸어요");
  }

  function deleteSelectedVertex() {
    const zone = selectedZone();
    if (!zone || selectedVertexIndex === null) return;
    const points = getZoneLocalPoints(zone);
    if (points.length <= 3) return;
    pushHistory();
    points.splice(selectedVertexIndex, 1);
    normalizeZonePoints(zone);
    selectedVertexIndex = null;
    renderAll();
    scheduleSave();
    showToast("꼭짓점을 삭제했어요");
  }

  function svgPoint(event) {
    const point = el.floorPlan.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = el.floorPlan.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }

  function startZoneResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    const zone = state.zones.find(candidate => candidate.id === id);
    if (!zone) return;
    pushHistory();
    const point = svgPoint(event);
    drag = { kind: "zone-resize", id, handle: event.currentTarget.dataset.handle, pointerId: event.pointerId, startPoint: point, original: structuredClone(zone), moved: false };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
  }

  function startVertexDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    const zone = state.zones.find(candidate => candidate.id === id);
    const index = Number(event.currentTarget.dataset.vertexIndex);
    if (!zone || !Number.isInteger(index)) return;
    if (!Array.isArray(zone.points)) zone.points = getZoneLocalPoints(zone).map(point => ({ ...point }));
    selectedVertexIndex = index;
    pushHistory();
    drag = { kind: "zone-vertex", id, vertexIndex: index, pointerId: event.pointerId, moved: false };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
    renderPlan();
    renderInspector();
  }

  function startAddVertex(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    const zone = state.zones.find(candidate => candidate.id === id);
    const edgeIndex = Number(event.currentTarget.dataset.edgeIndex);
    if (!zone || !Number.isInteger(edgeIndex)) return;
    if (!Array.isArray(zone.points)) zone.points = getZoneLocalPoints(zone).map(point => ({ ...point }));
    const points = zone.points;
    const current = points[edgeIndex];
    const next = points[(edgeIndex + 1) % points.length];
    const inserted = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
    pushHistory();
    points.splice(edgeIndex + 1, 0, inserted);
    selectedVertexIndex = edgeIndex + 1;
    renderPlan();
    renderInspector();
    drag = { kind: "zone-vertex", id, vertexIndex: selectedVertexIndex, pointerId: event.pointerId, moved: true };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
  }

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    const item = state.items.find(candidate => candidate.id === id);
    if (!item) return;
    if (state.selectedId !== id) {
      state.selectedId = id;
      renderInspector();
    }
    pushHistory();
    const point = svgPoint(event);
    drag = { kind: "item", id, pointerId: event.pointerId, offsetX: point.x - item.x, offsetY: point.y - item.y, moved: false };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
  }

  function startZoneDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    const zone = state.zones.find(candidate => candidate.id === id);
    if (!zone) return;
    if (state.selectedId !== id) {
      state.selectedId = id;
      renderInspector();
    }
    pushHistory();
    const point = svgPoint(event);
    drag = { kind: "zone", id, pointerId: event.pointerId, offsetX: point.x - zone.x, offsetY: point.y - zone.y, moved: false };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
  }

  function moveZoneResize(event) {
    const zone = state.zones.find(candidate => candidate.id === drag.id);
    if (!zone) return;
    const point = svgPoint(event);
    if (state.snap) {
      point.x = Math.round(point.x / state.room.grid) * state.room.grid;
      point.y = Math.round(point.y / state.room.grid) * state.room.grid;
    }
    const original = drag.original;
    const right = original.x + original.width;
    const bottom = original.y + original.depth;
    let x = original.x;
    let y = original.y;
    let width = original.width;
    let depth = original.depth;
    const handle = drag.handle;
    if (handle.includes("e")) width = clamp(point.x - original.x, 20, state.room.width - original.x);
    if (handle.includes("w")) { x = clamp(point.x, 0, right - 20); width = right - x; }
    if (handle.includes("s")) depth = clamp(point.y - original.y, 20, state.room.depth - original.y);
    if (handle.includes("n")) { y = clamp(point.y, 0, bottom - 20); depth = bottom - y; }
    zone.x = x;
    zone.y = y;
    zone.width = width;
    zone.depth = depth;
    if (Array.isArray(original.points)) {
      zone.points = original.points.map(pointValue => ({ x: pointValue.x * width / original.width, y: pointValue.y * depth / original.depth }));
    }
    drag.moved = drag.moved || Math.abs(width - original.width) > .1 || Math.abs(depth - original.depth) > .1 || Math.abs(x - original.x) > .1 || Math.abs(y - original.y) > .1;
    renderPlan();
    renderInspector();
  }

  function moveZoneVertex(event) {
    const zone = state.zones.find(candidate => candidate.id === drag.id);
    if (!zone || !Array.isArray(zone.points)) return;
    const point = svgPoint(event);
    let x = clamp(point.x, 0, state.room.width);
    let y = clamp(point.y, 0, state.room.depth);
    if (state.snap) {
      x = Math.round(x / state.room.grid) * state.room.grid;
      y = Math.round(y / state.room.grid) * state.room.grid;
    }
    zone.points[drag.vertexIndex] = { x: x - zone.x, y: y - zone.y };
    normalizeZonePoints(zone);
    drag.moved = true;
    renderPlan();
    renderInspector();
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.kind === "zone-resize") return moveZoneResize(event);
    if (drag.kind === "zone-vertex") return moveZoneVertex(event);
    const subject = drag.kind === "zone" ? state.zones.find(candidate => candidate.id === drag.id) : state.items.find(candidate => candidate.id === drag.id);
    if (!subject) return;
    const point = svgPoint(event);
    let x = point.x - drag.offsetX;
    let y = point.y - drag.offsetY;
    if (state.snap) {
      x = Math.round(x / state.room.grid) * state.room.grid;
      y = Math.round(y / state.room.grid) * state.room.grid;
    }
    if (Math.abs(x - subject.x) > .1 || Math.abs(y - subject.y) > .1) drag.moved = true;
    subject.x = x;
    subject.y = y;
    drag.kind === "zone" ? keepZoneInside(subject) : keepInside(subject);
    renderPlan();
    renderInspector();
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    el.floorPlan.releasePointerCapture?.(event.pointerId);
    el.floorPlan.removeEventListener("pointermove", moveDrag);
    el.floorPlan.removeEventListener("pointerup", endDrag);
    el.floorPlan.removeEventListener("pointercancel", endDrag);
    if (!drag.moved) undoStack.pop();
    drag = null;
    updateHistoryButtons();
    scheduleSave();
  }

  function onPlanPointerDown(event) {
    if (event.target === el.floorPlan || event.target.classList.contains("room-floor") || event.target.classList.contains("grid-fill")) {
      state.selectedId = null;
      shapeEditId = null;
      selectedVertexIndex = null;
      renderPlan();
      renderInspector();
    }
  }

  function applyRoomSize() {
    const width = number(el.roomWidth.value, state.room.width, ROOM_MIN, ROOM_MAX);
    const depth = number(el.roomDepth.value, state.room.depth, ROOM_MIN, ROOM_MAX);
    if (width === state.room.width && depth === state.room.depth) return;
    pushHistory();
    state.room.width = Math.round(width);
    state.room.depth = Math.round(depth);
    state.zones.forEach(keepZoneInside);
    state.items.forEach(keepInside);
    renderAll();
    scheduleSave();
    showToast("방 크기를 적용했어요");
  }

  function applyGridSize() {
    const grid = normalizeGrid(el.gridSize.value, state.room.grid);
    el.gridSize.value = grid;
    if (grid === state.room.grid) return;
    pushHistory();
    state.room.grid = grid;
    renderPlan();
    scheduleSave();
    showToast(`격자 간격을 ${grid}cm로 바꿨어요`);
  }

  function changeSelectedField(field, rawValue) {
    const item = selectedItem();
    if (!item) return;
    const oldValue = item[field];
    let value;
    if (field === "name") value = String(rawValue).trim().slice(0, 24) || item.name;
    else if (field === "width" || field === "depth") value = number(rawValue, oldValue, 10, 1000);
    else value = number(rawValue, oldValue, 0, 2000);
    if (value === oldValue) return;
    pushHistory();
    item[field] = value;
    keepInside(item);
    renderAll();
    scheduleSave();
  }

  function changeZoneField(field, rawValue) {
    const zone = selectedZone();
    if (!zone) return;
    const oldValue = zone[field];
    let value;
    if (field === "name") value = String(rawValue).trim().slice(0, 24) || zone.name;
    else if (field === "type") value = zonePresets.some(preset => preset.type === rawValue) ? rawValue : "custom";
    else if (field === "width" || field === "depth") value = number(rawValue, oldValue, 20, ROOM_MAX);
    else value = number(rawValue, oldValue, 0, ROOM_MAX);
    if (value === oldValue) return;
    pushHistory();
    if (Array.isArray(zone.points) && field === "width") {
      zone.points = zone.points.map(point => ({ x: point.x * value / zone.width, y: point.y }));
    }
    if (Array.isArray(zone.points) && field === "depth") {
      zone.points = zone.points.map(point => ({ x: point.x, y: point.y * value / zone.depth }));
    }
    zone[field] = value;
    keepZoneInside(zone);
    renderAll();
    scheduleSave();
  }

  function openCustomDialog() {
    el.customName.value = "새 가구";
    el.customWidth.value = 100;
    el.customDepth.value = 60;
    el.customDialog.showModal();
    requestAnimationFrame(() => el.customName.select());
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("show");
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  function safeFilename(extension) {
    const base = (state.room.name || "나의-자취방").replace(/[\\/:*?"<>|]/g, "-").trim() || "나의-자취방";
    return `${base}.${extension}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const data = {
      app: "방그림",
      version: 3,
      exportedAt: new Date().toISOString(),
      ...JSON.parse(snapshot()),
      selectedId: null
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), safeFilename("json"));
    el.exportDialog.close();
    showToast("도면 파일을 저장했어요");
  }

  function exportPng() {
    const room = state.room;
    const maxSide = 1800;
    const margin = 150;
    const scale = Math.min((maxSide - margin * 2) / room.width, (maxSide - margin * 2) / room.depth, 4);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(room.width * scale + margin * 2);
    canvas.height = Math.ceil(room.depth * scale + margin * 2 + 90);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#242720";
    ctx.font = "700 28px sans-serif";
    ctx.fillText(room.name, margin, 48);
    ctx.fillStyle = "#74776d";
    ctx.font = "18px sans-serif";
    ctx.fillText(`${room.width} × ${room.depth} cm`, margin, 76);

    const ox = margin;
    const oy = margin + 40;
    ctx.fillStyle = "#f7f4ed";
    ctx.fillRect(ox, oy, room.width * scale, room.depth * scale);
    const zoneColors = { living: "#edc57e", bathroom: "#b9cde6", kitchen: "#c9dfcb", entry: "#d7d4ce", balcony: "#c9dce2", custom: "#dfd1bc" };
    state.zones.forEach(zone => {
      const points = getZoneAbsolutePoints(zone);
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = ox + point.x * scale;
        const y = oy + point.y * scale;
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = zoneColors[zone.type] || zoneColors.custom;
      ctx.strokeStyle = "#3c4037";
      ctx.lineWidth = 6;
      ctx.fill();
      ctx.stroke();
    });

    if (state.showGrid) {
      ctx.strokeStyle = "#ddd8cd";
      ctx.lineWidth = 1;
      for (let x = 0; x <= room.width; x += room.grid) {
        ctx.beginPath(); ctx.moveTo(ox + x * scale, oy); ctx.lineTo(ox + x * scale, oy + room.depth * scale); ctx.stroke();
      }
      for (let y = 0; y <= room.depth; y += room.grid) {
        ctx.beginPath(); ctx.moveTo(ox, oy + y * scale); ctx.lineTo(ox + room.width * scale, oy + y * scale); ctx.stroke();
      }
    }
    ctx.strokeStyle = "#3c4037";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(ox, oy, room.width * scale, room.depth * scale);
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    state.zones.forEach(zone => {
      const points = getZoneAbsolutePoints(zone);
      const labelLayout = getZoneLabelLayout(zone);
      if (!labelLayout.name) return;
      const x = ox + (zone.x + labelLayout.x) * scale;
      const y = oy + (zone.y + labelLayout.y) * scale;
      const maxWidth = labelLayout.availableWidth * scale;
      ctx.save();
      ctx.beginPath();
      points.forEach((point, index) => {
        const pointX = ox + point.x * scale;
        const pointY = oy + point.y * scale;
        index === 0 ? ctx.moveTo(pointX, pointY) : ctx.lineTo(pointX, pointY);
      });
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#332f28";
      ctx.font = `700 ${Math.max(14, Math.min(32, labelLayout.nameFontSize * scale))}px sans-serif`;
      ctx.fillText(labelLayout.name, x, y + labelLayout.nameOffset * scale, maxWidth);
      if (labelLayout.dimensions) {
        ctx.fillStyle = "#665e50";
        ctx.font = `600 ${Math.max(11, Math.min(22, labelLayout.dimensionFontSize * scale))}px sans-serif`;
        ctx.fillText(labelLayout.dimensions, x, y + labelLayout.dimensionOffset * scale, maxWidth);
      }
      ctx.restore();
    });

    state.items.forEach(item => {
      const fp = getFootprint(item);
      const x = ox + item.x * scale;
      const y = oy + item.y * scale;
      const w = fp.width * scale;
      const h = fp.depth * scale;
      ctx.fillStyle = item.kind === "opening" ? "#b8d8d2" : item.kind === "structure" ? "#c9cbc6" : "#d9c8ad";
      ctx.strokeStyle = item.kind === "opening" ? "#4d7e76" : item.kind === "structure" ? "#676b64" : "#7f715b";
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      if (Math.min(w, h) > 34) {
        ctx.fillStyle = "#332f28";
        ctx.font = `700 ${Math.max(13, Math.min(22, Math.min(w, h) * .2))}px sans-serif`;
        ctx.fillText(item.name, x + w / 2, y + h / 2);
      }
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#74776d";
    ctx.font = "16px sans-serif";
    ctx.fillText("방그림에서 만든 배치도", margin, canvas.height - 25);
    canvas.toBlob(blob => {
      if (!blob) return showToast("이미지를 만들지 못했어요");
      downloadBlob(blob, safeFilename("png"));
      el.exportDialog.close();
      showToast("배치 이미지를 저장했어요");
    }, "image/png");
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!isValidState(imported)) throw new Error("invalid");
        pushHistory();
        state = {
          ...structuredClone(initialState),
          ...imported,
          room: { ...initialState.room, ...imported.room },
          zones: (Array.isArray(imported.zones) ? imported.zones : []).map(zone => ({
            ...zone,
            id: String(zone.id || uid("zone")),
            type: zonePresets.some(preset => preset.type === zone.type) ? zone.type : "custom",
            name: String(zone.name || "기타 공간").slice(0, 24),
            width: number(zone.width, 160, 20, ROOM_MAX),
            depth: number(zone.depth, 160, 20, ROOM_MAX),
            x: number(zone.x, 0, 0, ROOM_MAX),
            y: number(zone.y, 0, 0, ROOM_MAX),
            points: Array.isArray(zone.points) && zone.points.length >= 3 ? zone.points.map(point => ({ x: number(point.x, 0, 0, ROOM_MAX), y: number(point.y, 0, 0, ROOM_MAX) })) : undefined
          })),
          items: imported.items.map(item => ({
            ...item,
            id: String(item.id || uid()),
            width: number(item.width, 100, 10, 1000),
            depth: number(item.depth, 60, 10, 1000),
            x: number(item.x, 0, 0, ROOM_MAX),
            y: number(item.y, 0, 0, ROOM_MAX),
            rotation: Number(item.rotation) === 90 ? 90 : 0,
            kind: ["furniture", "opening", "structure"].includes(item.kind) ? item.kind : "furniture"
          })),
          selectedId: null
        };
        state.room.width = number(state.room.width, 360, ROOM_MIN, ROOM_MAX);
        state.room.depth = number(state.room.depth, 320, ROOM_MIN, ROOM_MAX);
        state.room.grid = normalizeGrid(state.room.grid);
        state.zones.forEach(keepZoneInside);
        state.items.forEach(keepInside);
        el.exportDialog.close();
        renderAll();
        scheduleSave();
        showToast("도면을 불러왔어요");
      } catch (_) {
        showToast("올바른 방그림 파일이 아니에요");
      } finally {
        el.importJsonInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    el.applyRoomBtn.addEventListener("click", applyRoomSize);
    [el.roomWidth, el.roomDepth].forEach(input => input.addEventListener("keydown", event => {
      if (event.key === "Enter") applyRoomSize();
    }));
    el.customFurnitureBtn.addEventListener("click", openCustomDialog);
    el.customForm.addEventListener("submit", event => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      if (!el.customForm.reportValidity()) return;
      addItem({ type: "custom", name: el.customName.value.trim() || "새 가구", width: el.customWidth.value, depth: el.customDepth.value, kind: "furniture" });
      el.customDialog.close();
    });

    el.roomName.addEventListener("change", () => {
      const next = el.roomName.value.trim() || "나의 자취방";
      if (next === state.room.name) return;
      pushHistory();
      state.room.name = next;
      renderControls();
      scheduleSave();
    });
    el.roomNotes.addEventListener("input", () => {
      state.room.notes = el.roomNotes.value;
      scheduleSave();
    });
    el.gridToggle.addEventListener("change", () => { state.showGrid = el.gridToggle.checked; renderPlan(); scheduleSave(); });
    el.gridSize.addEventListener("change", applyGridSize);
    el.gridSize.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyGridSize();
        el.gridSize.blur();
      }
    });
    el.snapToggle.addEventListener("change", () => { state.snap = el.snapToggle.checked; scheduleSave(); });
    el.resetViewBtn.addEventListener("click", () => {
      state.selectedId = null;
      shapeEditId = null;
      selectedVertexIndex = null;
      renderPlan();
      renderInspector();
    });
    el.floorPlan.addEventListener("pointerdown", onPlanPointerDown);

    el.itemName.addEventListener("change", () => changeSelectedField("name", el.itemName.value));
    el.itemWidth.addEventListener("change", () => changeSelectedField("width", el.itemWidth.value));
    el.itemDepth.addEventListener("change", () => changeSelectedField("depth", el.itemDepth.value));
    el.itemX.addEventListener("change", () => changeSelectedField("x", el.itemX.value));
    el.itemY.addEventListener("change", () => changeSelectedField("y", el.itemY.value));
    el.deleteItemBtn.addEventListener("click", deleteSelected);
    el.rotateItemBtn.addEventListener("click", rotateSelected);
    el.duplicateItemBtn.addEventListener("click", duplicateSelected);
    el.zoneName.addEventListener("change", () => changeZoneField("name", el.zoneName.value));
    el.zoneType.addEventListener("change", () => changeZoneField("type", el.zoneType.value));
    el.zoneWidth.addEventListener("change", () => changeZoneField("width", el.zoneWidth.value));
    el.zoneDepth.addEventListener("change", () => changeZoneField("depth", el.zoneDepth.value));
    el.zoneX.addEventListener("change", () => changeZoneField("x", el.zoneX.value));
    el.zoneY.addEventListener("change", () => changeZoneField("y", el.zoneY.value));
    el.deleteZoneBtn.addEventListener("click", deleteSelectedZone);
    el.duplicateZoneBtn.addEventListener("click", duplicateSelectedZone);
    el.zoneShapeEditBtn.addEventListener("click", toggleZoneShapeEdit);
    el.deleteVertexBtn.addEventListener("click", deleteSelectedVertex);
    el.resetZoneShapeBtn.addEventListener("click", resetSelectedZoneShape);
    el.undoBtn.addEventListener("click", undo);
    el.redoBtn.addEventListener("click", redo);

    document.querySelectorAll("[data-check]").forEach(checkbox => checkbox.addEventListener("change", () => {
      state.checks[checkbox.dataset.check] = checkbox.checked;
      scheduleSave();
    }));

    el.exportMenuBtn.addEventListener("click", () => el.exportDialog.showModal());
    el.closeExportBtn.addEventListener("click", () => el.exportDialog.close());
    el.exportPngBtn.addEventListener("click", exportPng);
    el.exportJsonBtn.addEventListener("click", exportJson);
    el.importJsonInput.addEventListener("change", () => importJson(el.importJsonInput.files?.[0]));

    document.addEventListener("keydown", event => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault(); redo(); return;
      }
      const item = selectedItem();
      const zone = selectedZone();
      if (typing || (!item && !zone)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (zone && shapeEditId === zone.id && selectedVertexIndex !== null) deleteSelectedVertex();
        else item ? deleteSelected() : deleteSelectedZone();
        return;
      }
      if (item && event.key.toLowerCase() === "r") {
        event.preventDefault(); rotateSelected(); return;
      }
      const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (movement) {
        event.preventDefault();
        pushHistory();
        const amount = event.shiftKey ? 10 : 1;
        if (zone && shapeEditId === zone.id && selectedVertexIndex !== null) {
          const points = getZoneAbsolutePoints(zone);
          const point = points[selectedVertexIndex];
          point.x = clamp(point.x + movement[0] * amount, 0, state.room.width);
          point.y = clamp(point.y + movement[1] * amount, 0, state.room.depth);
          zone.points = points.map(candidate => ({ x: candidate.x - zone.x, y: candidate.y - zone.y }));
          normalizeZonePoints(zone);
        } else {
          const subject = item || zone;
          subject.x += movement[0] * amount;
          subject.y += movement[1] * amount;
          item ? keepInside(subject) : keepZoneInside(subject);
        }
        renderPlan();
        renderInspector();
        scheduleSave();
      }
    });
  }

  function init() {
    renderFurnitureLibrary();
    bindEvents();
    renderAll();
    scheduleSave();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  init();
})();
