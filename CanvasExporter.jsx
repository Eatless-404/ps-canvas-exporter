/*
 * Canvas Exporter for Photoshop
 * 将每个图层/组按文档尺寸单独导出为透明背景 PNG
 * 组可展开显示子图层，导出自动创建子文件夹
 * 使用方式：File → Scripts → Canvas Exporter
 */

#target photoshop

if (app.documents.length === 0) {
    alert("请先打开一个 PSD 文档");
} else {
    main();
}

function main() {
    var doc = app.activeDocument;
    var docName = doc.name.replace(/\.[^.]+$/, "");
    var layers = doc.layers;
    var slices = sortAndNameSlices(getDocumentSlices());
    var topLayerItems = getTopLayerItems(layers, docName);

    // 构建图层树结构
    var layerTree = buildLayerTree(layers, 0);

    // 弹出对话框
    var dlg = new Window("dialog", "Canvas Exporter");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.preferredSize = [380, -1];

    // 文档信息
    var infoGroup = dlg.add("panel", undefined, "文档信息");
    infoGroup.alignChildren = ["fill", "top"];
    infoGroup.add("statictext", undefined, "文档：" + doc.name);
    infoGroup.add("statictext", undefined, "尺寸：" + doc.width.as("px") + " × " + doc.height.as("px"));
    infoGroup.add("statictext", undefined, "图层：" + countAllLayers(layers) + " 个");
    infoGroup.add("statictext", undefined, "切片：" + slices.length + " 个");

    // 导出模式
    var modePanel = dlg.add("panel", undefined, "导出模式");
    modePanel.orientation = "row";
    modePanel.alignChildren = ["left", "center"];
    var canvasModeRadio = modePanel.add("radiobutton", undefined, "完整画布");
    var sliceModeRadio = modePanel.add("radiobutton", undefined, "按切片");
    canvasModeRadio.value = true;
    sliceModeRadio.enabled = slices.length > 0;
    if (slices.length === 0) {
        modePanel.add("statictext", undefined, "未检测到切片");
    }

    // 图层选择列表（可滚动）
    var layerPanel = dlg.add("panel", undefined, "选择要导出的图层");
    layerPanel.alignChildren = ["fill", "top"];
    layerPanel.maximumSize = [400, 340];

    var slicePickerGroup = layerPanel.add("group");
    slicePickerGroup.orientation = "row";
    slicePickerGroup.alignChildren = ["left", "center"];
    slicePickerGroup.add("statictext", undefined, "切片：");
    var slicePicker = slicePickerGroup.add("dropdownlist", undefined, buildSlicePickerLabels(slices));
    slicePicker.preferredSize.width = 220;
    slicePicker.selection = 0;
    slicePickerGroup.visible = false;

    var exportList = layerPanel.add("listbox", undefined, [], { multiselect: true });
    exportList.preferredSize = [360, 220];

    var exportItems = [];
    var currentMode = "canvas";
    var currentSliceIndex = -1;

    renderExportList(exportList, exportItems, currentMode, currentSliceIndex, layers, slices, topLayerItems, docName);

    canvasModeRadio.onClick = function () {
        currentMode = "canvas";
        slicePickerGroup.visible = false;
        currentSliceIndex = -1;
        renderExportList(exportList, exportItems, currentMode, currentSliceIndex, layers, slices, topLayerItems, docName);
        dlg.layout.layout(true);
    };

    sliceModeRadio.onClick = function () {
        currentMode = "slice";
        slicePickerGroup.visible = true;
        currentSliceIndex = -1;
        slicePicker.selection = 0;
        renderExportList(exportList, exportItems, currentMode, currentSliceIndex, layers, slices, topLayerItems, docName);
        dlg.layout.layout(true);
    };

    slicePicker.onChange = function () {
        if (!slicePicker.selection) return;
        currentSliceIndex = slicePicker.selection.index - 1;
        renderExportList(exportList, exportItems, currentMode, currentSliceIndex, layers, slices, topLayerItems, docName);
        dlg.layout.layout(true);
    };

    // 全选/取消按钮
    var selGroup = dlg.add("group");
    selGroup.alignment = ["fill", "top"];
    var selectAllBtn = selGroup.add("button", undefined, "全选");
    var deselectAllBtn = selGroup.add("button", undefined, "取消全选");

    selectAllBtn.onClick = function () {
        for (var i = 0; i < exportList.items.length; i++) {
            if (!exportItems[i] || exportItems[i].header) continue;
            exportList.items[i].selected = true;
        }
    };

    deselectAllBtn.onClick = function () {
        for (var i = 0; i < exportList.items.length; i++) {
            exportList.items[i].selected = false;
        }
    };

    // 导出倍率
    var scaleGroup = dlg.add("group");
    scaleGroup.add("statictext", undefined, "导出倍率：");
    var scaleDropdown = scaleGroup.add("dropdownlist", undefined, ["1x", "2x", "3x"]);
    scaleDropdown.selection = 0;

    // 按钮
    var btnGroup = dlg.add("group");
    btnGroup.alignment = ["fill", "top"];
    var exportBtn = btnGroup.add("button", undefined, "选择文件夹并导出", { name: "ok" });
    var cancelBtn = btnGroup.add("button", undefined, "取消", { name: "cancel" });

    if (dlg.show() !== 1) return;

    // 收集选中的图层
    var selectedLayers = [];
    for (var i = 0; i < exportList.items.length; i++) {
        if (exportList.items[i].selected && exportItems[i] && !exportItems[i].header) {
            if (exportItems[i].sliceSummary) {
                appendSliceSummaryTasks(selectedLayers, exportItems[i]);
            } else {
                selectedLayers.push(exportItems[i]);
            }
        }
    }

    if (selectedLayers.length === 0) {
        alert("没有选中任何图层");
        return;
    }

    // 选择保存位置，并创建一个命名子文件夹，避免用户找不到导出结果。
    var parentFolder = Folder.selectDialog("选择导出位置（插件会在里面新建命名文件夹）");
    if (!parentFolder) return;

    var defaultFolderName = docName + (currentMode === "slice" ? "_slice_export" : "_canvas_export");
    var folderName = prompt("给本次导出结果文件夹命名：", defaultFolderName);
    if (!folderName) return;
    folderName = folderName.replace(/[\/\\:*?"<>|]/g, "_");

    var exportFolder = new Folder(parentFolder.fsName + "/" + folderName);
    if (!exportFolder.exists) {
        exportFolder.create();
    }

    var scale = parseInt(scaleDropdown.selection.text);
    var origWidth = doc.width.as("px");
    var origHeight = doc.height.as("px");

    // 记录所有图层的原始可见性（递归）
    var visibilityMap = {};
    saveAllVisibility(doc.layers, visibilityMap);

    var exported = 0;
    var nameCount = {};

    try {
        for (var s = 0; s < selectedLayers.length; s++) {
            var item = selectedLayers[s];
            var layer = item.layer;
            var exportName = item.exportName;

            // 处理重名
            if (nameCount[exportName] === undefined) {
                nameCount[exportName] = 0;
            } else {
                nameCount[exportName]++;
                exportName = exportName + "_" + nameCount[exportName];
            }

            // 清理文件名非法字符
            exportName = exportName.replace(/[\/\\:*?"<>|]/g, "_");

            // 隐藏所有图层（递归）
            hideAllLayers(doc.layers);

            // 显示目标图层及其父级链
            showLayerWithParents(layer);

            if (item.slice) {
                exportVisibleLayerInSlice(doc, item.slice, exportFolder, exportName, scale);
            } else {
                // 缩放
                if (scale > 1) {
                    doc.resizeImage(
                        UnitValue(origWidth * scale, "px"),
                        UnitValue(origHeight * scale, "px"),
                        doc.resolution,
                        ResampleMethod.BICUBIC
                    );
                }

                // 导出 PNG
                var pngFile = new File(exportFolder.fsName + "/" + exportName + ".png");
                var pngOpts = new PNGSaveOptions();
                pngOpts.compression = 6;
                pngOpts.interlaced = false;
                doc.saveAs(pngFile, pngOpts, true, Extension.LOWERCASE);

                // 恢复尺寸
                if (scale > 1) {
                    doc.resizeImage(
                        UnitValue(origWidth, "px"),
                        UnitValue(origHeight, "px"),
                        doc.resolution,
                        ResampleMethod.BICUBIC
                    );
                }
            }

            exported++;
        }
    } catch (e) {
        alert("导出出错：" + e.message);
    }

    // 恢复所有图层可见性
    restoreAllVisibility(doc.layers, visibilityMap);

    alert("完成！共导出 " + exported + " 个 PNG。\n保存位置：\n" + exportFolder.fsName);
}

function buildSlicePickerLabels(slices) {
    var labels = ["全部切片"];
    for (var i = 0; i < slices.length; i++) {
        labels.push(slices[i].name + "  " + slices[i].width + "×" + slices[i].height);
    }
    return labels;
}

function renderExportList(list, exportItems, mode, currentSliceIndex, layers, slices, layerItems, docName) {
    clearListBox(list);
    exportItems.length = 0;

    if (mode === "slice") {
        if (currentSliceIndex >= 0) {
            addSingleSliceListItems(list, exportItems, slices[currentSliceIndex], layerItems, docName);
        } else {
            addAllSliceListItems(list, exportItems, slices, layerItems, docName);
        }
    } else {
        addCanvasListItems(list, exportItems, layers, 0, docName);
    }
}

function clearListBox(list) {
    while (list.items.length > 0) {
        list.remove(list.items[0]);
    }
}

function addCanvasListItems(list, exportItems, layers, depth, docName) {
    var indent = "";
    for (var d = 0; d < depth; d++) indent += "    ";

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var isGroup = (layer.typename === "LayerSet");
        var prefix = indent + (isGroup ? "▼ " : "");
        var label = prefix + layer.name + (layer.visible ? "" : "（隐藏）");

        var exportName = docName + "_" + layer.name;
        if (depth > 0) {
            exportName = docName + "_" + getParentName(layer) + "_" + layer.name;
        }

        var row = list.add("item", label);
        row.selected = layer.visible;
        exportItems.push({ layer: layer, exportName: exportName });

        if (isGroup && layer.layers.length > 0) {
            addCanvasListItems(list, exportItems, layer.layers, depth + 1, docName);
        }
    }
}

function addSliceListItems(list, exportItems, slices, layerItems, docName) {
    for (var i = 0; i < slices.length; i++) {
        var slice = slices[i];
        list.add("item", "▼ " + slice.name + "  " + slice.width + "×" + slice.height);
        exportItems.push({ header: true });

        var matched = 0;
        for (var j = 0; j < layerItems.length; j++) {
            var item = layerItems[j];
            if (!item.bounds || !rectsIntersect(slice, item.bounds)) continue;

            matched++;
            var label = "    " + item.layer.name + (item.layer.visible ? "" : "（隐藏）");
            var row = list.add("item", label);
            row.selected = item.layer.visible;
            exportItems.push({
                layer: item.layer,
                exportName: docName + "_" + slice.name + "_" + item.layer.name,
                slice: slice
            });
        }

        if (matched === 0) {
            list.add("item", "    这个切片区域内没有顶层图层");
            exportItems.push({ header: true });
        }
    }
}

function addAllSliceListItems(list, exportItems, slices, layerItems, docName) {
    for (var i = 0; i < slices.length; i++) {
        var slice = slices[i];
        var matched = getMatchedLayerItems(slice, layerItems);
        var visibleCount = 0;
        for (var j = 0; j < matched.length; j++) {
            if (matched[j].layer.visible) visibleCount++;
        }

        var row = list.add("item", slice.name + "  " + slice.width + "×" + slice.height + " / " + matched.length + " 个图层");
        row.selected = matched.length > 0 && visibleCount > 0;
        exportItems.push({
            sliceSummary: true,
            slice: slice,
            matched: matched,
            docName: docName
        });
    }
}

function addSingleSliceListItems(list, exportItems, slice, layerItems, docName) {
    var matched = getMatchedLayerItems(slice, layerItems);
    for (var i = 0; i < matched.length; i++) {
        var item = matched[i];
        var label = item.layer.name + (item.layer.visible ? "" : "（隐藏）");
        var row = list.add("item", label);
        row.selected = item.layer.visible;
        exportItems.push({
            layer: item.layer,
            exportName: docName + "_" + slice.name + "_" + item.layer.name,
            slice: slice
        });
    }

    if (matched.length === 0) {
        list.add("item", "这个切片区域内没有顶层图层");
        exportItems.push({ header: true });
    }
}

function getMatchedLayerItems(slice, layerItems) {
    var matched = [];
    for (var i = 0; i < layerItems.length; i++) {
        var item = layerItems[i];
        if (item.bounds && rectsIntersect(slice, item.bounds)) {
            matched.push(item);
        }
    }
    return matched;
}

function appendSliceSummaryTasks(tasks, summary) {
    for (var i = 0; i < summary.matched.length; i++) {
        var item = summary.matched[i];
        if (!item.layer.visible) continue;
        tasks.push({
            layer: item.layer,
            exportName: summary.docName + "_" + summary.slice.name + "_" + item.layer.name,
            slice: summary.slice
        });
    }
}

// 递归添加图层复选框，组展开一层子图层
function addLayerCheckboxes(parent, layers, depth, checkboxes, docName) {
    var indent = "";
    for (var d = 0; d < depth; d++) indent += "    ";

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var isGroup = (layer.typename === "LayerSet");
        var prefix = indent + (isGroup ? "▼ " : "");
        var label = prefix + layer.name + (layer.visible ? "" : "（隐藏）");

        // 生成导出名称：文档名_父组名_图层名
        var exportName = docName + "_" + layer.name;
        if (depth > 0) {
            exportName = docName + "_" + getParentName(layer) + "_" + layer.name;
        }

        var cb = parent.add("checkbox", undefined, label);
        cb.value = layer.visible;
        checkboxes.push({ cb: cb, layer: layer, exportName: exportName });

        // 如果是组，展开一层子图层
        if (isGroup && layer.layers.length > 0) {
            addLayerCheckboxes(parent, layer.layers, depth + 1, checkboxes, docName);
        }
    }
}

// 按切片分组添加顶层图层/组复选框
function addSliceCheckboxes(parent, slices, layerItems, checkboxes, docName) {
    for (var i = 0; i < slices.length; i++) {
        var slice = slices[i];
        var headerGroup = parent.add("group");
        headerGroup.orientation = "row";
        headerGroup.alignChildren = ["left", "center"];
        var header = headerGroup.add("statictext", undefined, "▼ " + slice.name + "  " + slice.width + "×" + slice.height);
        header.preferredSize.width = 320;

        var matched = 0;
        for (var j = 0; j < layerItems.length; j++) {
            var item = layerItems[j];
            if (!item.bounds || !rectsIntersect(slice, item.bounds)) continue;

            matched++;
            var label = "    " + item.layer.name + (item.layer.visible ? "" : "（隐藏）");
            var exportName = docName + "_" + slice.name + "_" + item.layer.name;
            var cb = parent.add("checkbox", undefined, label);
            cb.value = item.layer.visible;
            checkboxes.push({
                cb: cb,
                layer: item.layer,
                exportName: exportName,
                slice: slice
            });
        }

        if (matched === 0) {
            parent.add("statictext", undefined, "    这个 Slice 区域内没有顶层图层");
        }
    }
}

function clearGroup(group) {
    while (group.children.length > 0) {
        group.remove(group.children[0]);
    }
}

// 获取图层的父组名称
function getParentName(layer) {
    try {
        if (layer.parent && layer.parent.typename === "LayerSet") {
            return layer.parent.name;
        }
    } catch (e) {}
    return "";
}

function getTopLayerItems(layers, docName) {
    var items = [];
    for (var i = 0; i < layers.length; i++) {
        items.push({
            layer: layers[i],
            exportName: docName + "_" + layers[i].name,
            bounds: getLayerBounds(layers[i])
        });
    }
    return items;
}

function getLayerBounds(layer) {
    try {
        var b = layer.bounds;
        var left = Number(b[0].as("px"));
        var top = Number(b[1].as("px"));
        var right = Number(b[2].as("px"));
        var bottom = Number(b[3].as("px"));
        if (right <= left || bottom <= top) return null;
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: right - left,
            height: bottom - top
        };
    } catch (e) {
        return null;
    }
}

function rectsIntersect(a, b) {
    return a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
}

function getDescriptorNumber(desc, keyName) {
    var key = app.stringIDToTypeID(keyName);
    if (!desc.hasKey(key)) key = app.charIDToTypeID(keyName);

    var type = desc.getType(key);
    if (type === DescValueType.INTEGERTYPE) return desc.getInteger(key);
    if (type === DescValueType.DOUBLETYPE) return desc.getDouble(key);
    if (type === DescValueType.UNITDOUBLE) return desc.getUnitDoubleValue(key);
    return 0;
}

function getDocumentSlices() {
    var result = [];
    try {
        var ref = new ActionReference();
        ref.putProperty(app.stringIDToTypeID("property"), app.stringIDToTypeID("slices"));
        ref.putIdentifier(app.stringIDToTypeID("document"), app.activeDocument.id);
        var desc = executeActionGet(ref);
        var slicesDesc = desc.getObjectValue(app.stringIDToTypeID("slices"));
        var list = slicesDesc.getList(app.stringIDToTypeID("slices"));

        for (var i = 0; i < list.count; i++) {
            var item = list.getObjectValue(i);
            var origin = "";
            try {
                origin = app.typeIDToStringID(item.getEnumerationValue(app.stringIDToTypeID("origin")));
            } catch (e) {}

            if (origin && origin !== "userGenerated") continue;

            var bounds = item.getObjectValue(app.stringIDToTypeID("bounds"));
            var left = getDescriptorNumber(bounds, "left");
            var top = getDescriptorNumber(bounds, "top");
            var right = getDescriptorNumber(bounds, "right");
            var bottom = getDescriptorNumber(bounds, "bottom");
            if (right <= left || bottom <= top) continue;

            var id = result.length + 1;
            try {
                if (item.hasKey(app.stringIDToTypeID("sliceID"))) {
                    id = item.getInteger(app.stringIDToTypeID("sliceID"));
                }
            } catch (e2) {}

            result.push({
                id: id,
                name: "Slice " + id,
                left: left,
                top: top,
                right: right,
                bottom: bottom,
                width: right - left,
                height: bottom - top
            });
        }
    } catch (e3) {}

    return result;
}

function sortAndNameSlices(slices) {
    slices.sort(function (a, b) {
        if (a.top !== b.top) return a.top - b.top;
        return a.left - b.left;
    });

    for (var i = 0; i < slices.length; i++) {
        var index = i + 1;
        slices[i].name = "切片 " + (index < 10 ? "0" + index : String(index));
    }

    return slices;
}

function exportVisibleLayerInSlice(doc, slice, exportFolder, exportName, scale) {
    var originalDoc = app.activeDocument;
    var tempDoc = null;

    try {
        tempDoc = doc.duplicate("Canvas Exporter Temp", true);
        app.activeDocument = tempDoc;

        tempDoc.crop([
            UnitValue(slice.left, "px"),
            UnitValue(slice.top, "px"),
            UnitValue(slice.right, "px"),
            UnitValue(slice.bottom, "px")
        ]);

        if (scale > 1) {
            tempDoc.resizeImage(
                UnitValue(slice.width * scale, "px"),
                UnitValue(slice.height * scale, "px"),
                tempDoc.resolution,
                ResampleMethod.BICUBIC
            );
        }

        var pngFile = new File(exportFolder.fsName + "/" + exportName + ".png");
        var pngOpts = new PNGSaveOptions();
        pngOpts.compression = 6;
        pngOpts.interlaced = false;
        tempDoc.saveAs(pngFile, pngOpts, true, Extension.LOWERCASE);
        tempDoc.close(SaveOptions.DONOTSAVECHANGES);
        tempDoc = null;
        app.activeDocument = originalDoc;
    } finally {
        if (tempDoc) {
            try {
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e) {}
        }
        try {
            app.activeDocument = originalDoc;
        } catch (e2) {}
    }
}

// 统计所有图层数量（含子图层）
function countAllLayers(layers) {
    var count = 0;
    for (var i = 0; i < layers.length; i++) {
        count++;
        if (layers[i].typename === "LayerSet") {
            count += countAllLayers(layers[i].layers);
        }
    }
    return count;
}

// 构建图层树（辅助）
function buildLayerTree(layers, depth) {
    var tree = [];
    for (var i = 0; i < layers.length; i++) {
        var node = { layer: layers[i], depth: depth, children: [] };
        if (layers[i].typename === "LayerSet") {
            node.children = buildLayerTree(layers[i].layers, depth + 1);
        }
        tree.push(node);
    }
    return tree;
}

// 递归保存所有图层可见性
function saveAllVisibility(layers, map) {
    for (var i = 0; i < layers.length; i++) {
        map[layers[i].id] = layers[i].visible;
        if (layers[i].typename === "LayerSet") {
            saveAllVisibility(layers[i].layers, map);
        }
    }
}

// 递归恢复所有图层可见性
function restoreAllVisibility(layers, map) {
    for (var i = 0; i < layers.length; i++) {
        if (map[layers[i].id] !== undefined) {
            layers[i].visible = map[layers[i].id];
        }
        if (layers[i].typename === "LayerSet") {
            restoreAllVisibility(layers[i].layers, map);
        }
    }
}

// 递归隐藏所有图层
function hideAllLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
        layers[i].visible = false;
        if (layers[i].typename === "LayerSet") {
            hideAllLayers(layers[i].layers);
        }
    }
}

// 显示目标图层及其所有父级（确保可见链完整）
function showLayerWithParents(layer) {
    layer.visible = true;
    // 如果是组，也显示其所有子图层
    if (layer.typename === "LayerSet") {
        showAllChildren(layer.layers);
    }
    // 向上遍历父级
    try {
        var parent = layer.parent;
        while (parent && parent.typename === "LayerSet") {
            parent.visible = true;
            parent = parent.parent;
        }
    } catch (e) {}
}

// 显示组内所有子图层
function showAllChildren(layers) {
    for (var i = 0; i < layers.length; i++) {
        layers[i].visible = true;
        if (layers[i].typename === "LayerSet") {
            showAllChildren(layers[i].layers);
        }
    }
}
