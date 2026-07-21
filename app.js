(() => {
  "use strict";

  const STORAGE_KEY = "room-picture-state-v1";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ROOM_MIN = 100;
  const ROOM_MAX = 2000;

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

  const initialState = {
    room: { name: "나의 자취방", width: 360, depth: 320, grid: 20, notes: "" },
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

  const el = {};
  const ids = [
    "saveState", "undoBtn", "redoBtn", "exportMenuBtn", "roomWidth", "roomDepth", "applyRoomBtn",
    "furnitureGrid", "customFurnitureBtn", "roomNotes", "roomName", "roomSummary", "gridToggle", "snapToggle",
    "resetViewBtn", "canvasFrame", "floorPlan", "emptyHint", "mobileFurnitureList", "nothingSelected",
    "itemInspector", "itemName", "itemWidth", "itemDepth", "itemX", "itemY", "deleteItemBtn", "rotateItemBtn",
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
      return {
        ...structuredClone(initialState),
        ...parsed,
        room: { ...initialState.room, ...parsed.room },
        selectedId: null
      };
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

  function uid() {
    return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function getFootprint(item) {
    return item.rotation % 180 === 90
      ? { width: item.depth, depth: item.width }
      : { width: item.width, depth: item.depth };
  }

  function selectedItem() {
    return state.items.find(item => item.id === state.selectedId) || null;
  }

  function keepInside(item) {
    const footprint = getFootprint(item);
    item.x = clamp(item.x, 0, Math.max(0, state.room.width - footprint.width));
    item.y = clamp(item.y, 0, Math.max(0, state.room.depth - footprint.depth));
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

  function renderFurnitureLibrary() {
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
    const margin = Math.max(42, Math.min(room.width, room.depth) * .15);
    el.floorPlan.setAttribute("viewBox", `${-margin} ${-margin} ${room.width + margin * 2} ${room.depth + margin * 2}`);
    el.floorPlan.innerHTML = "";

    const title = svgNode("title", { id: "planTitle" });
    title.textContent = `${room.name}, 가로 ${room.width}cm 세로 ${room.depth}cm 평면도`;
    const desc = svgNode("desc", { id: "planDesc" });
    desc.textContent = `가구 ${state.items.length}개가 배치되어 있습니다. 가구를 누르고 드래그해 이동할 수 있습니다.`;
    el.floorPlan.append(title, desc);

    const defs = svgNode("defs");
    const pattern = svgNode("pattern", { id: "roomGrid", width: room.grid, height: room.grid, patternUnits: "userSpaceOnUse" });
    pattern.appendChild(svgNode("path", { d: `M ${room.grid} 0 L 0 0 0 ${room.grid}`, class: "grid-line", fill: "none" }));
    defs.appendChild(pattern);
    el.floorPlan.appendChild(defs);

    el.floorPlan.appendChild(svgNode("rect", { x: 0, y: 0, width: room.width, height: room.depth, rx: 2, class: "room-floor" }));
    if (state.showGrid) el.floorPlan.appendChild(svgNode("rect", { x: 0, y: 0, width: room.width, height: room.depth, class: "grid-fill", "pointer-events": "none" }));

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

      const minDimension = Math.min(fp.width, fp.depth);
      if (minDimension >= 28) {
        const label = svgNode("text", { x: item.x + fp.width / 2, y: item.y + fp.depth / 2 - (minDimension > 45 ? 3 : -4), class: "item-label" });
        label.textContent = compactName(item.name, fp.width);
        group.appendChild(label);
      }
      if (minDimension >= 48) {
        const dim = svgNode("text", { x: item.x + fp.width / 2, y: item.y + fp.depth / 2 + 13, class: "item-dim" });
        dim.textContent = `${item.width}×${item.depth}`;
        group.appendChild(dim);
      }

      group.addEventListener("pointerdown", startDrag);
      group.addEventListener("click", event => {
        event.stopPropagation();
        selectItem(item.id);
      });
      el.floorPlan.appendChild(group);
    });

    el.emptyHint.hidden = state.items.length !== 0;
  }

  function compactName(name, availableWidth) {
    const maxChars = Math.max(2, Math.floor(availableWidth / 14));
    return name.length > maxChars ? `${name.slice(0, Math.max(1, maxChars - 1))}…` : name;
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
    el.nothingSelected.hidden = Boolean(item);
    el.itemInspector.hidden = !item;
    if (!item) return;
    el.itemName.value = item.name;
    el.itemWidth.value = Math.round(item.width);
    el.itemDepth.value = Math.round(item.depth);
    el.itemX.value = Math.round(item.x);
    el.itemY.value = Math.round(item.y);
    const fp = getFootprint(item);
    el.itemX.max = Math.max(0, state.room.width - fp.width);
    el.itemY.max = Math.max(0, state.room.depth - fp.depth);
    const fits = fp.width <= state.room.width && fp.depth <= state.room.depth;
    el.fitStatus.classList.toggle("invalid", !fits);
    el.fitStatus.querySelector("span:last-child").textContent = fits ? "방 안에 잘 배치되어 있어요" : "가구가 방보다 커서 일부가 넘쳐요";
  }

  function renderControls() {
    el.roomWidth.value = state.room.width;
    el.roomDepth.value = state.room.depth;
    el.roomName.value = state.room.name;
    el.roomSummary.textContent = `${state.room.width} × ${state.room.depth} cm · 가구 ${state.items.length}개`;
    el.roomNotes.value = state.room.notes || "";
    el.gridToggle.checked = state.showGrid;
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
    renderPlan();
    renderInspector();
  }

  function svgPoint(event) {
    const point = el.floorPlan.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = el.floorPlan.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
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
    drag = { id, pointerId: event.pointerId, offsetX: point.x - item.x, offsetY: point.y - item.y, moved: false };
    el.floorPlan.setPointerCapture?.(event.pointerId);
    el.floorPlan.addEventListener("pointermove", moveDrag);
    el.floorPlan.addEventListener("pointerup", endDrag);
    el.floorPlan.addEventListener("pointercancel", endDrag);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const item = state.items.find(candidate => candidate.id === drag.id);
    if (!item) return;
    const point = svgPoint(event);
    let x = point.x - drag.offsetX;
    let y = point.y - drag.offsetY;
    if (state.snap) {
      x = Math.round(x / state.room.grid) * state.room.grid;
      y = Math.round(y / state.room.grid) * state.room.grid;
    }
    if (Math.abs(x - item.x) > .1 || Math.abs(y - item.y) > .1) drag.moved = true;
    item.x = x;
    item.y = y;
    keepInside(item);
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
    state.items.forEach(keepInside);
    renderAll();
    scheduleSave();
    showToast("방 크기를 적용했어요");
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
      version: 1,
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
    ctx.lineWidth = 6;
    ctx.strokeRect(ox, oy, room.width * scale, room.depth * scale);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
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
    el.snapToggle.addEventListener("change", () => { state.snap = el.snapToggle.checked; scheduleSave(); });
    el.resetViewBtn.addEventListener("click", () => { state.selectedId = null; renderPlan(); renderInspector(); });
    el.floorPlan.addEventListener("pointerdown", onPlanPointerDown);

    el.itemName.addEventListener("change", () => changeSelectedField("name", el.itemName.value));
    el.itemWidth.addEventListener("change", () => changeSelectedField("width", el.itemWidth.value));
    el.itemDepth.addEventListener("change", () => changeSelectedField("depth", el.itemDepth.value));
    el.itemX.addEventListener("change", () => changeSelectedField("x", el.itemX.value));
    el.itemY.addEventListener("change", () => changeSelectedField("y", el.itemY.value));
    el.deleteItemBtn.addEventListener("click", deleteSelected);
    el.rotateItemBtn.addEventListener("click", rotateSelected);
    el.duplicateItemBtn.addEventListener("click", duplicateSelected);
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
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault(); redo(); return;
      }
      if (typing || !selectedItem()) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault(); deleteSelected(); return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault(); rotateSelected(); return;
      }
      const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (movement) {
        event.preventDefault();
        const item = selectedItem();
        pushHistory();
        const amount = event.shiftKey ? 10 : 1;
        item.x += movement[0] * amount;
        item.y += movement[1] * amount;
        keepInside(item);
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
