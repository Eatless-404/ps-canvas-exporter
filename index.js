const { app, action, core } = require("photoshop");
const { batchPlay } = action;
const { storage } = require("uxp");
const fs = storage.localFileSystem;

const noDoc = document.getElementById("no-doc");
const panel = document.getElementById("panel");
const docName = document.getElementById("doc-name");
const docSize = document.getElementById("doc-size");
const layerCount = document.getElementById("layer-count");
const sliceCount = document.getElementById("slice-count");
const layerList = document.getElementById("layer-list");
const exportBtn = document.getElementById("export-btn");
const refreshBtn = document.getElementById("refresh-btn");
const toggleAll = document.getElementById("toggle-all");
const scaleSelect = document.getElementById("scale");
const progress = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const canvasModeBtn = document.getElementById("canvas-mode-btn");
const sliceModeBtn = document.getElementById("slice-mode-btn");

let mode = "canvas";
let currentDocData = null;

function getLayerType(layer) {
  if (layer.kind === "group") return "Group";
  if (layer.kind === "pixel") return "Pixel";
  if (layer.kind === "text") return "Text";
  if (layer.kind === "smartObject") return "Smart Object";
  if (layer.kind === "solidColor" || layer.kind === "gradientFill" || layer.kind === "patternFill") return "Fill";
  return layer.kind || "Layer";
}

function getNumber(value) {
  if (typeof value === "number") return value;
  if (value && typeof value._value === "number") return value._value;
  if (value && typeof value.value === "number") return value.value;
  return 0;
}

function getRect(value) {
  if (!value) return null;
  const source = value.bounds || value;
  const left = getNumber(source.left);
  const top = getNumber(source.top);
  const right = getNumber(source.right);
  const bottom = getNumber(source.bottom);

  if (right <= left || bottom <= top) return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function rectsIntersect(a, b) {
  return a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top;
}

function sanitizeFileName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, "_");
}

function makeExportName(parts, nameCount) {
  let exportName = sanitizeFileName(parts.join("_"));
  if (nameCount[exportName] === undefined) {
    nameCount[exportName] = 0;
  } else {
    nameCount[exportName]++;
    exportName = `${exportName}_${nameCount[exportName]}`;
  }
  return exportName;
}

function getLayerInfo(layer) {
  return {
    id: layer.id,
    name: layer.name,
    type: getLayerType(layer),
    visible: layer.visible,
    bounds: getRect(layer.bounds || layer.boundsNoEffects),
  };
}

function extractRectFromDescriptor(obj) {
  if (!obj || typeof obj !== "object") return null;
  return getRect(obj.bounds || obj.boundsNoEffects || obj);
}

function getDescriptorName(obj, fallback) {
  return obj.name || obj.sliceName || obj.title || fallback;
}

function looksLikeAutoSlice(obj) {
  const values = [obj.type, obj.sliceType, obj.kind, obj.userSlice, obj._value]
    .filter(Boolean)
    .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)).toLowerCase());
  return values.some((v) => v.includes("auto"));
}

function collectSliceDescriptors(value, path = [], result = []) {
  if (!value || typeof value !== "object") return result;

  const inSlicePath = path.some((key) => key.toLowerCase().includes("slice"));
  const rect = inSlicePath ? extractRectFromDescriptor(value) : null;

  if (rect && !looksLikeAutoSlice(value)) {
    const id = String(value.id || value.sliceID || value.sliceId || result.length + 1);
    result.push({
      id,
      name: getDescriptorName(value, `Slice ${result.length + 1}`),
      bounds: rect,
      width: rect.width,
      height: rect.height,
      layers: [],
    });
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSliceDescriptors(item, path.concat(String(index)), result));
    return result;
  }

  Object.keys(value).forEach((key) => {
    collectSliceDescriptors(value[key], path.concat(key), result);
  });

  return result;
}

function dedupeSlices(slices) {
  const seen = new Set();
  return slices.filter((slice) => {
    const key = `${Math.round(slice.bounds.left)}:${Math.round(slice.bounds.top)}:${Math.round(slice.bounds.right)}:${Math.round(slice.bounds.bottom)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getDocumentSlices() {
  try {
    const [descriptor] = await batchPlay(
      [
        {
          _obj: "get",
          _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
        },
      ],
      { synchronousExecution: true }
    );

    return dedupeSlices(collectSliceDescriptors(descriptor));
  } catch (e) {
    console.warn("Unable to read Photoshop slices", e);
    return [];
  }
}

async function buildDocData(doc) {
  const layers = [...doc.layers].map(getLayerInfo);
  const slices = await getDocumentSlices();

  slices.forEach((slice) => {
    slice.layers = layers.filter((layer) => layer.bounds && rectsIntersect(slice.bounds, layer.bounds));
  });

  return {
    name: doc.name || "Untitled",
    baseName: (doc.name || "Untitled").replace(/\.[^.]+$/, ""),
    width: doc.width,
    height: doc.height,
    layers,
    slices,
  };
}

async function refreshDocInfo() {
  const doc = app.activeDocument;
  if (!doc) {
    currentDocData = null;
    noDoc.style.display = "block";
    panel.style.display = "none";
    return;
  }

  currentDocData = await buildDocData(doc);

  noDoc.style.display = "none";
  panel.style.display = "block";
  docName.textContent = currentDocData.name;
  docSize.textContent = `${currentDocData.width} × ${currentDocData.height}`;
  layerCount.textContent = currentDocData.layers.length + " 个";
  sliceCount.textContent = currentDocData.slices.length + " 个";

  sliceModeBtn.disabled = currentDocData.slices.length === 0;
  if (mode === "slice" && currentDocData.slices.length === 0) mode = "canvas";
  renderCurrentMode();
}

function renderCanvasLayers(layers) {
  layerList.innerHTML = "";

  layers.forEach((layer) => {
    const div = document.createElement("div");
    div.className = layer.visible ? "layer-item" : "layer-item is-hidden";
    div.style.paddingLeft = "6px";
    div.innerHTML = `
      <input type="checkbox" ${layer.visible ? "checked" : ""} data-layer-id="${layer.id}">
      <span class="name">${layer.name}</span>
      ${layer.visible ? "" : '<span class="hidden-badge">隐藏</span>'}
      <span class="type">${layer.type}</span>
    `;
    layerList.appendChild(div);
  });
}

function renderSliceLayers(slices) {
  layerList.innerHTML = "";

  slices.forEach((slice) => {
    const group = document.createElement("div");

    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `
      <input type="checkbox" ${slice.layers.some((layer) => layer.visible) ? "checked" : ""} data-slice-toggle="${slice.id}">
      <span class="name">${slice.name}</span>
      <span class="size">${Math.round(slice.width)}×${Math.round(slice.height)} / ${slice.layers.length} 个</span>
    `;
    group.appendChild(header);

    const headerCheckbox = header.querySelector("input");
    headerCheckbox.addEventListener("change", () => {
      const boxes = group.querySelectorAll(".layer-item input[type=checkbox]");
      boxes.forEach((box) => (box.checked = headerCheckbox.checked));
    });

    if (slice.layers.length === 0) {
      const div = document.createElement("div");
      div.className = "layer-item";
      div.innerHTML = '<span class="name" style="color: var(--text-dim)">这个 Slice 区域内没有顶层图层</span>';
      group.appendChild(div);
    }

    slice.layers.forEach((layer) => {
      const div = document.createElement("div");
      div.className = layer.visible ? "layer-item" : "layer-item is-hidden";
      div.innerHTML = `
        <input type="checkbox" ${layer.visible ? "checked" : ""} data-slice-id="${slice.id}" data-layer-id="${layer.id}">
        <span class="name">${layer.name}</span>
        ${layer.visible ? "" : '<span class="hidden-badge">隐藏</span>'}
        <span class="type">${layer.type}</span>
      `;
      group.appendChild(div);
    });

    layerList.appendChild(group);
  });
}

function renderCurrentMode() {
  if (!currentDocData) return;

  canvasModeBtn.classList.toggle("active", mode === "canvas");
  sliceModeBtn.classList.toggle("active", mode === "slice");

  if (mode === "slice") {
    renderSliceLayers(currentDocData.slices);
  } else {
    renderCanvasLayers(currentDocData.layers);
  }
}

canvasModeBtn.addEventListener("click", () => {
  mode = "canvas";
  renderCurrentMode();
});

sliceModeBtn.addEventListener("click", () => {
  if (!currentDocData || currentDocData.slices.length === 0) return;
  mode = "slice";
  renderCurrentMode();
});

toggleAll.addEventListener("click", () => {
  const boxes = layerList.querySelectorAll("input[type=checkbox]");
  const allChecked = [...boxes].every((b) => b.checked);
  boxes.forEach((b) => (b.checked = !allChecked));
});

refreshBtn.addEventListener("click", () => {
  refreshDocInfo();
});

function saveVisibility(layers) {
  return layers.map((layer) => ({ id: layer.id, visible: layer.visible }));
}

function restoreVisibility(layers, state) {
  state.forEach((s) => {
    const layer = layers.find((item) => item.id === s.id);
    if (layer) layer.visible = s.visible;
  });
}

function setAllLayersVisible(layers, visible) {
  layers.forEach((layer) => {
    try {
      layer.visible = visible;
    } catch (e) {
      console.warn("Unable to change layer visibility", layer.name, e);
    }
  });
}

async function resizeActiveDocument(width, height) {
  await batchPlay(
    [
      {
        _obj: "imageSize",
        width: { _unit: "pixelsUnit", _value: width },
        height: { _unit: "pixelsUnit", _value: height },
        interfaceIconFrameDimmed: { _enum: "interpolationType", _value: "bicubicAutomatic" },
      },
    ],
    { synchronousExecution: true }
  );
}

async function cropActiveDocument(bounds) {
  await batchPlay(
    [
      {
        _obj: "crop",
        to: {
          _obj: "rectangle",
          top: { _unit: "pixelsUnit", _value: bounds.top },
          left: { _unit: "pixelsUnit", _value: bounds.left },
          bottom: { _unit: "pixelsUnit", _value: bounds.bottom },
          right: { _unit: "pixelsUnit", _value: bounds.right },
        },
        angle: { _unit: "angleUnit", _value: 0 },
        delete: true,
      },
    ],
    { synchronousExecution: true }
  );
}

async function duplicateActiveDocument(name) {
  await batchPlay(
    [
      {
        _obj: "duplicate",
        _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
        name,
      },
    ],
    { synchronousExecution: true }
  );
  return app.activeDocument;
}

async function closeActiveDocumentWithoutSaving() {
  await batchPlay(
    [
      {
        _obj: "close",
        saving: { _enum: "yesNo", _value: "no" },
      },
    ],
    { synchronousExecution: true }
  );
}

async function exportActiveDocumentPng(file, scale, restoreSize = false) {
  const doc = app.activeDocument;
  const origW = doc.width;
  const origH = doc.height;

  if (scale !== 1) {
    await resizeActiveDocument(Math.round(doc.width * scale), Math.round(doc.height * scale));
  }

  try {
    await app.activeDocument.saveAs.png(file, { compression: 6, interlaced: false });
  } finally {
    if (restoreSize && scale !== 1) {
      await resizeActiveDocument(origW, origH);
    }
  }
}

function getSelectedCanvasLayerIds() {
  const boxes = layerList.querySelectorAll("input[data-layer-id]:checked");
  return [...boxes].map((box) => parseInt(box.dataset.layerId));
}

function getSelectedSliceItems() {
  const boxes = layerList.querySelectorAll("input[data-slice-id]:checked");
  return [...boxes].map((box) => ({
    sliceId: box.dataset.sliceId,
    layerId: parseInt(box.dataset.layerId),
  }));
}

async function exportCanvasLayers(doc, folder, scale, selectedIds) {
  const allLayers = [...doc.layers];
  const savedState = saveVisibility(allLayers);
  const nameCount = {};
  let exported = 0;

  for (const layerId of selectedIds) {
    const layer = allLayers.find((item) => item.id === layerId);
    if (!layer) continue;

    const exportName = makeExportName([currentDocData.baseName, layer.name], nameCount);
    setAllLayersVisible(allLayers, false);
    layer.visible = true;

    const file = await folder.createFile(exportName + ".png", { overwrite: true });
    await exportActiveDocumentPng(file, scale, true);

    exported++;
    const pct = Math.round((exported / selectedIds.length) * 100);
    progressFill.style.width = pct + "%";
    progressText.textContent = `导出中 ${exported}/${selectedIds.length}：${layer.name}`;
  }

  restoreVisibility(allLayers, savedState);
  return exported;
}

async function exportSliceLayers(doc, folder, scale, selectedItems) {
  const allLayers = [...doc.layers];
  const savedState = saveVisibility(allLayers);
  const nameCount = {};
  let exported = 0;

  const sliceMap = {};
  currentDocData.slices.forEach((slice) => {
    sliceMap[slice.id] = slice;
  });

  for (const item of selectedItems) {
    const slice = sliceMap[item.sliceId];
    const layer = allLayers.find((candidate) => candidate.id === item.layerId);
    if (!slice || !layer) continue;

    const exportName = makeExportName([currentDocData.baseName, slice.name, layer.name], nameCount);
    setAllLayersVisible(allLayers, false);
    layer.visible = true;

    let tempDoc = null;
    try {
      tempDoc = await duplicateActiveDocument(`Canvas Exporter Temp ${Date.now()}`);
      await cropActiveDocument(slice.bounds);

      const file = await folder.createFile(exportName + ".png", { overwrite: true });
      await exportActiveDocumentPng(file, scale);
      await closeActiveDocumentWithoutSaving();
      tempDoc = null;
    } finally {
      if (tempDoc && app.activeDocument && app.activeDocument.id === tempDoc.id) {
        await closeActiveDocumentWithoutSaving();
      }
    }

    exported++;
    const pct = Math.round((exported / selectedItems.length) * 100);
    progressFill.style.width = pct + "%";
    progressText.textContent = `按切片导出中 ${exported}/${selectedItems.length}：${slice.name} / ${layer.name}`;
  }

  restoreVisibility(allLayers, savedState);
  return exported;
}

exportBtn.addEventListener("click", async () => {
  const doc = app.activeDocument;
  if (!doc || !currentDocData) return;

  const selectedIds = mode === "canvas" ? getSelectedCanvasLayerIds() : [];
  const selectedSliceItems = mode === "slice" ? getSelectedSliceItems() : [];
  const total = mode === "canvas" ? selectedIds.length : selectedSliceItems.length;
  if (total === 0) return;

  const folder = await fs.getFolder();
  if (!folder) return;

  const scale = parseInt(scaleSelect.value);

  exportBtn.disabled = true;
  progress.style.display = "block";
  progressFill.style.width = "0%";
  progressText.textContent = "准备导出...";

  try {
    const exported = await core.executeAsModal(
      async () => {
        if (mode === "slice") {
          return exportSliceLayers(doc, folder, scale, selectedSliceItems);
        }
        return exportCanvasLayers(doc, folder, scale, selectedIds);
      },
      { commandName: mode === "slice" ? "Slice Canvas Exporter" : "Canvas Exporter" }
    );

    progressFill.style.width = "100%";
    progressText.textContent = `完成！共导出 ${exported} 个图层`;
  } catch (e) {
    progressText.textContent = "导出出错：" + e.message;
  }

  exportBtn.disabled = false;
  refreshDocInfo();
});

refreshDocInfo();
