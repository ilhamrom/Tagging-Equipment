import { CanvasObject } from './CanvasObject.js';
import { Cable } from './Cable.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const propertiesContent = document.getElementById('properties-content');
    const objectIcons = document.querySelectorAll('.object-icon');

    // App State
    let state = {
        objects: [],
        cables: [],
        selectedItem: null,
        isDragging: false,
        dragStart: {},
        isDrawingCable: false,
        cableStart: null,
        cableEndPos: null,
        hoveredNodeInfo: null,
        isMovingCableEnd: false,
        movingCableInfo: null,
        zoom: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        spacebarDown: false,
        sequenceCounter: 1,
    };

    function drawGrid() {
        const gridSize = 20;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1 / state.zoom;
        
        const x1 = (0 - state.panX) / state.zoom;
        const y1 = (0 - state.panY) / state.zoom;
        const x2 = (canvas.width - state.panX) / state.zoom;
        const y2 = (canvas.height - state.panY) / state.zoom;
        
        const startX = Math.floor(x1 / gridSize) * gridSize;
        const startY = Math.floor(y1 / gridSize) * gridSize;

        for (let x = startX; x < x2; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.stroke();
        }
        for (let y = startY; y < y2; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function redrawCanvas() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(state.panX, state.panY);
        ctx.scale(state.zoom, state.zoom);
        
        drawGrid();

        state.cables.forEach(cable => cable.draw(ctx, state.zoom, state.selectedItem === cable));
        state.objects.forEach(obj => obj.draw(ctx, state.zoom, state.hoveredNodeInfo));

        ctx.lineWidth = 1 / state.zoom;
        if (state.isDrawingCable && state.cableStart) {
            const startNode = state.cableStart.obj.nodes[state.cableStart.nodeIndex];
            const startPos = { x: state.cableStart.obj.x + startNode.x, y: state.cableStart.obj.y + startNode.y };
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(state.cableEndPos.x, state.cableEndPos.y);
            ctx.strokeStyle = '#00ffff'; // Cyan
            ctx.stroke();
        }
        if (state.isMovingCableEnd && state.movingCableInfo) {
            ctx.beginPath();
            ctx.moveTo(state.movingCableInfo.fixedPoint.x, state.movingCableInfo.fixedPoint.y);
            ctx.lineTo(state.cableEndPos.x, state.cableEndPos.y);
            ctx.strokeStyle = '#00ffff'; // Cyan
            ctx.stroke();
        }
        if (state.selectedItem && state.selectedItem instanceof CanvasObject) {
            ctx.strokeStyle = '#ef4444'; // Red
            ctx.lineWidth = 2 / state.zoom;
            ctx.strokeRect(state.selectedItem.x, state.selectedItem.y, state.selectedItem.width, state.selectedItem.height);
        }
        ctx.restore();
    }

    function updatePropertiesPanel() {
        propertiesContent.innerHTML = ''; 

        if (!state.selectedItem) {
            propertiesContent.innerHTML = '<p>Select an item to see its properties.</p>';
            return;
        }

        if (state.selectedItem.tag && typeof state.selectedItem.tag === 'object' && Array.isArray(state.selectedItem.tag.parts)) {
            const tagEditorWrapper = document.createElement('div');
            tagEditorWrapper.className = 'tag-editor';
            
            for (let i = 0; i < 3; i++) {
                const partWrapper = document.createElement('div');
                partWrapper.className = 'tag-part-editor';

                const label = document.createElement('label');
                label.textContent = `Tag Part ${i + 1}`;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = state.selectedItem.tag.parts[i];
                input.disabled = state.selectedItem.tag.modes[i] === 'sequence';
                input.addEventListener('input', (e) => {
                    state.selectedItem.tag.parts[i] = e.target.value.toUpperCase();
                    redrawCanvas();
                    updatePreviewTables();
                });

                const select = document.createElement('select');
                select.innerHTML = `<option value="manual">Manual</option><option value="sequence">Sequence</option>`;
                select.value = state.selectedItem.tag.modes[i];
                select.addEventListener('change', (e) => {
                    const newMode = e.target.value;
                    state.selectedItem.tag.modes[i] = newMode;
                    if (newMode === 'sequence') {
                        const seqValue = String(state.sequenceCounter++).padStart(2, '0');
                        state.selectedItem.tag.parts[i] = seqValue;
                        input.value = seqValue;
                        input.disabled = true;
                    } else {
                        input.disabled = false;
                    }
                    redrawCanvas();
                    updatePreviewTables();
                });

                partWrapper.appendChild(label);
                partWrapper.appendChild(select);
                partWrapper.appendChild(input);
                tagEditorWrapper.appendChild(partWrapper);
            }
            propertiesContent.appendChild(tagEditorWrapper);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteItem';
        deleteBtn.textContent = 'Delete Item';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.addEventListener('click', deleteSelectedItem);
        propertiesContent.appendChild(deleteBtn);
    }

    function deleteSelectedItem() {
        if (!state.selectedItem) return;

        if (state.selectedItem instanceof CanvasObject) {
            state.objects = state.objects.filter(obj => obj.id !== state.selectedItem.id);
            state.cables = state.cables.filter(c => c.startObj.id !== state.selectedItem.id && c.endObj.id !== state.selectedItem.id);
        } else if (state.selectedItem instanceof Cable) {
            state.cables = state.cables.filter(c => c.id !== state.selectedItem.id);
        }

        state.selectedItem = null;
        updatePropertiesPanel();
        redrawCanvas();
        updatePreviewTables();
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (evt.clientX - rect.left) * scaleX;
        const mouseY = (evt.clientY - rect.top) * scaleY;
        return {
            x: (mouseX - state.panX) / state.zoom,
            y: (mouseY - state.panY) / state.zoom
        };
    }

    objectIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const category = icon.dataset.category;
            const worldX = (canvas.width / 2 - state.panX) / state.zoom;
            const worldY = (canvas.height / 2 - state.panY) / state.zoom;
            state.objects.push(new CanvasObject(worldX, worldY, category, state.sequenceCounter++));
            redrawCanvas();
            updatePreviewTables();
        });

        icon.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', icon.dataset.category);
        });
    });

    canvas.addEventListener('dragover', (e) => e.preventDefault());

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const category = e.dataTransfer.getData('text/plain');
        const pos = getMousePos(canvas, e);
        state.objects.push(new CanvasObject(pos.x, pos.y, category, state.sequenceCounter++));
        redrawCanvas();
        updatePreviewTables();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (state.spacebarDown || e.button === 1) {
            e.preventDefault();
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            return;
        }
        const pos = getMousePos(canvas, e);
        if (state.selectedItem instanceof Cable) {
            const handle = state.selectedItem.getHandleAt(pos, state.zoom);
            if (handle) {
                state.isMovingCableEnd = true;
                const endpoints = state.selectedItem.getEndPoints();
                state.movingCableInfo = { cable: state.selectedItem, handle: handle, fixedPoint: handle === 'start' ? endpoints.end : endpoints.start };
                return;
            }
        }
        for (const obj of state.objects) {
            const nodeIndex = obj.getNodeAt(pos, state.zoom);
            if (nodeIndex !== null) {
                state.selectedItem = null;
                state.isDrawingCable = true;
                state.cableStart = { obj, nodeIndex };
                redrawCanvas();
                return;
            }
        }
        let clickedItem = null;
        for (let i = state.objects.length - 1; i >= 0; i--) {
            if (state.objects[i].isClicked(pos.x, pos.y)) {
                clickedItem = state.objects[i];
                state.isDragging = true;
                state.dragStart = { x: pos.x - clickedItem.x, y: pos.y - clickedItem.y };
                break;
            }
        }
        if (!clickedItem) {
            for (let i = state.cables.length - 1; i >= 0; i--) {
                if (state.cables[i].isClicked(pos.x, pos.y, state.zoom)) {
                    clickedItem = state.cables[i];
                    break;
                }
            }
        }
        state.selectedItem = clickedItem;
        updatePropertiesPanel();
        redrawCanvas();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (state.isPanning) {
            const dx = e.clientX - state.panStart.x;
            const dy = e.clientY - state.panStart.y;
            state.panX += dx;
            state.panY += dy;
            state.panStart = { x: e.clientX, y: e.clientY };
            redrawCanvas();
            return;
        }
        const pos = getMousePos(canvas, e);
        state.hoveredNodeInfo = null;
        if (state.isMovingCableEnd) {
            state.cableEndPos = pos;
        } else if (state.isDrawingCable) {
            state.cableEndPos = pos;
        } else if (state.isDragging && state.selectedItem) {
            state.selectedItem.x = pos.x - state.dragStart.x;
            state.selectedItem.y = pos.y - state.dragStart.y;
        }
        for (const obj of state.objects) {
            const isConnectingToSelf = (state.isDrawingCable && obj.id === state.cableStart.obj.id);
            const isMovingToSameObj = (state.isMovingCableEnd && ((state.movingCableInfo.handle === 'start' && obj.id === state.movingCableInfo.cable.endObj.id) || (state.movingCableInfo.handle === 'end' && obj.id === state.movingCableInfo.cable.startObj.id)));
            if (isConnectingToSelf || isMovingToSameObj) continue;
            const nodeIndex = obj.getNodeAt(pos, state.zoom);
            if (nodeIndex !== null) {
                state.hoveredNodeInfo = { obj, nodeIndex };
                if (state.isDrawingCable || state.isMovingCableEnd) {
                    const node = obj.nodes[nodeIndex];
                    state.cableEndPos = { x: obj.x + node.x, y: obj.y + node.y };
                }
                break;
            }
        }
        redrawCanvas();
    });

    canvas.addEventListener('mouseup', () => {
        if (state.isPanning) {
            state.isPanning = false;
            canvas.style.cursor = state.spacebarDown ? 'grab' : 'crosshair';
        }
        if (state.isMovingCableEnd) {
            if (state.hoveredNodeInfo) {
                const cable = state.movingCableInfo.cable;
                if (state.movingCableInfo.handle === 'start') {
                    cable.startObj = state.hoveredNodeInfo.obj;
                    cable.startNodeIndex = state.hoveredNodeInfo.nodeIndex;
                } else {
                    cable.endObj = state.hoveredNodeInfo.obj;
                    cable.endNodeIndex = state.hoveredNodeInfo.nodeIndex;
                }
            }
            state.isMovingCableEnd = false;
            state.movingCableInfo = null;
        } else if (state.isDrawingCable) {
            if (state.cableStart && state.hoveredNodeInfo) {
                state.cables.push(new Cable(state.cableStart.obj, state.cableStart.nodeIndex, state.hoveredNodeInfo.obj, state.hoveredNodeInfo.nodeIndex, state.sequenceCounter++));
            }
            state.isDrawingCable = false;
            state.cableStart = null;
        }
        state.isDragging = false;
        state.hoveredNodeInfo = null;
        redrawCanvas();
        updatePreviewTables();
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomAmount = 0.1;
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        const oldZoom = state.zoom;
        
        state.zoom *= 1 + zoomDirection * zoomAmount;
        state.zoom = Math.max(0.2, Math.min(5, state.zoom));

        state.panX = mouseX - (mouseX - state.panX) * (state.zoom / oldZoom);
        state.panY = mouseY - (mouseY - state.panY) * (state.zoom / oldZoom);

        redrawCanvas();
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !state.spacebarDown) {
            e.preventDefault();
            state.spacebarDown = true;
            canvas.style.cursor = 'grab';
        }

        // Handle deletion with Delete/Backspace keys
        if ((e.code === 'Delete' || e.code === 'Backspace') && state.selectedItem) {
            e.preventDefault();
            deleteSelectedItem();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            state.spacebarDown = false;
            if (!state.isPanning) {
                canvas.style.cursor = 'crosshair';
            }
        }
    });
    
    canvas.style.cursor = 'crosshair';

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        redrawCanvas();
    }

    function updatePreviewTables() {
        const objectsTableContent = document.getElementById('objects-table-content');
        const cablesTableContent = document.getElementById('cables-table-content');

        objectsTableContent.innerHTML = '';
        cablesTableContent.innerHTML = '';

        let objectsTable = '<table><thead><tr><th>ID</th><th>Category</th><th>Tag Part 1</th><th>Tag Part 2</th><th>Tag Part 3</th></tr></thead><tbody>';
        state.objects.forEach(obj => {
            objectsTable += `<tr><td>${obj.id}</td><td>${obj.category}</td><td>${obj.tag.parts[0]}</td><td>${obj.tag.parts[1]}</td><td>${obj.tag.parts[2]}</td></tr>`;
        });
        objectsTable += '</tbody></table>';
        objectsTableContent.innerHTML = objectsTable;
        
        let cablesTable = '<table><thead><tr><th>Cable Tag</th><th>From Object Tag</th><th>From Object Category</th><th>To Object Tag</th><th>To Object Category</th></tr></thead><tbody>';
        state.cables.forEach(cable => {
            cablesTable += `<tr><td>${cable.getFullTag()}</td><td>${cable.startObj.getFullTag()}</td><td>${cable.startObj.category}</td><td>${cable.endObj.getFullTag()}</td><td>${cable.endObj.category}</td></tr>`;
        });
        cablesTable += '</tbody></table>';
        cablesTableContent.innerHTML = cablesTable;
    }

    const showObjectsBtn = document.getElementById('showObjectsBtn');
    const showCablesBtn = document.getElementById('showCablesBtn');
    const objectsTableWrapper = document.getElementById('objects-table-wrapper');
    const cablesTableWrapper = document.getElementById('cables-table-wrapper');

    objectsTableWrapper.style.display = 'none';
    cablesTableWrapper.style.display = 'block';
    showCablesBtn.classList.add('active');

    showObjectsBtn.addEventListener('click', () => {
        objectsTableWrapper.style.display = 'block';
        cablesTableWrapper.style.display = 'none';
        showObjectsBtn.classList.add('active');
        showCablesBtn.classList.remove('active');
    });

    showCablesBtn.addEventListener('click', () => {
        objectsTableWrapper.style.display = 'none';
        cablesTableWrapper.style.display = 'block';
        showCablesBtn.classList.add('active');
        showObjectsBtn.classList.remove('active');
    });
    
    window.addEventListener('resize', resizeCanvas);
    
    function escapeCsvCell(cell) {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function downloadCSV(filename, rows) {
        const csvContent = rows.map(row => row.map(escapeCsvCell).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    document.getElementById('downloadObjectsBtn').addEventListener('click', () => {
        const rows = [['ID', 'Category', 'Tag Part 1', 'Tag Part 2', 'Tag Part 3']];
        state.objects.forEach(obj => {
            rows.push([obj.id, obj.category, obj.tag.parts[0], obj.tag.parts[1], obj.tag.parts[2]]);
        });
        downloadCSV('objects.csv', rows);
    });

    document.getElementById('downloadCablesBtn').addEventListener('click', () => {
        const rows = [['Cable Tag', 'From Object Tag', 'From Object Category', 'To Object Tag', 'To Object Category']];
        state.cables.forEach(cable => {
            rows.push([
                cable.getFullTag(),
                cable.startObj.getFullTag(),
                cable.startObj.category,
                cable.endObj.getFullTag(),
                cable.endObj.category
            ]);
        });
        downloadCSV('cables.csv', rows);
    });

    // Project Management Logic
    const newProjectBtn = document.getElementById('newProjectBtn');

    function resetState() {
        state.objects = [];
        state.cables = [];
        state.selectedItem = null;
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        state.sequenceCounter = 1;
        // Clear properties panel and tables
        updatePropertiesPanel();
        updatePreviewTables();
        // Redraw the empty canvas
        redrawCanvas();
    }

    newProjectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to start a new project? Any unsaved changes will be lost.')) {
            resetState();
        }
    });

    const saveProjectBtn = document.getElementById('saveProjectBtn');

    function getSerializableState() {
        // Create plain objects for serialization
        const serializableObjects = state.objects.map(obj => ({
            id: obj.id,
            x: obj.x,
            y: obj.y,
            category: obj.category,
            tag: obj.tag,
            width: obj.width,
            height: obj.height,
            nodes: obj.nodes
        }));

        const serializableCables = state.cables.map(cable => ({
            id: cable.id,
            startObjId: cable.startObj.id,
            startNodeIndex: cable.startNodeIndex,
            endObjId: cable.endObj.id,
            endNodeIndex: cable.endNodeIndex,
            tag: cable.tag
        }));

        return {
            objects: serializableObjects,
            cables: serializableCables,
            sequenceCounter: state.sequenceCounter
        };
    }

    saveProjectBtn.addEventListener('click', () => {
        try {
            const projectData = getSerializableState();
            const jsonString = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `project-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error saving project:", error);
            alert("Could not save project. See console for details.");
        }
    });

    const openProjectBtn = document.getElementById('openProjectBtn');
    const fileInput = document.getElementById('fileInput');

    openProjectBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                if (projectData && projectData.objects && projectData.cables) {
                    loadState(projectData);
                } else {
                    throw new Error("Invalid project file format.");
                }
            } catch (error) {
                console.error("Error opening project file:", error);
                alert("Could not open project file. It may be corrupted or not a valid project file.");
            }
        };
        reader.readAsText(file);
        event.target.value = null;
    });

    function loadState(projectData) {
        // Reset the state without confirmation
        state.objects = [];
        state.cables = [];
        state.selectedItem = null;
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;

        const objectMap = new Map();

        projectData.objects.forEach(objData => {
            const newObj = new CanvasObject(objData.x, objData.y, objData.category, 0);
            Object.assign(newObj, objData); // Assign all saved properties
            state.objects.push(newObj);
            objectMap.set(newObj.id, newObj);
        });

        projectData.cables.forEach(cableData => {
            const startObj = objectMap.get(cableData.startObjId);
            const endObj = objectMap.get(cableData.endObjId);

            if (startObj && endObj) {
                const newCable = new Cable(startObj, cableData.startNodeIndex, endObj, cableData.endNodeIndex, 0);
                Object.assign(newCable, { id: cableData.id, tag: cableData.tag });
                state.cables.push(newCable);
            }
        });

        state.sequenceCounter = projectData.sequenceCounter || 1;

        updatePropertiesPanel();
        updatePreviewTables();
        redrawCanvas();
    }

    resizeCanvas();
    updatePreviewTables();
});
