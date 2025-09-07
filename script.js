document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const propertiesContent = document.getElementById('properties-content');
    const objectIcons = document.querySelectorAll('.object-icon');

    let objects = [];
    let cables = [];
    let selectedItem = null;
    let isDragging = false;
    let dragStart = {};

    let isDrawingCable = false;
    let cableStart = null;
    let cableEndPos = null;
    let hoveredNodeInfo = null;

    let isMovingCableEnd = false;
    let movingCableInfo = null;

    // Viewport state
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let spacebarDown = false;

    let sequenceCounter = 1;

    class CanvasObject {
        constructor(x, y, category) {
            this.id = Date.now();
            this.x = x;
            this.y = y;
            this.category = category;
            this.tag = {
                parts: [category.toUpperCase(), String(sequenceCounter++).padStart(2, '0'), ''],
                modes: ['manual', 'sequence', 'manual']
            };
            switch (this.category) {
                case 'panel': this.width = 80; this.height = 120; break;
                case 'junction_box': this.width = 40; this.height = 40; break;
                case 'lamp': this.width = 40; this.height = 40; break;
                case 'switch': this.width = 40; this.height = 40; break;
                case 'circuit_breaker': this.width = 30; this.height = 60; break;
                default: this.width = 50; this.height = 50; break;
            }
            this.nodes = [
                { x: this.width / 2, y: 0 }, { x: this.width, y: this.height / 2 },
                { x: this.width / 2, y: this.height }, { x: 0, y: this.height / 2 }
            ];
        }
        draw(context) {
            context.save();
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            context.lineWidth = 1 / zoom;
            switch (this.category) {
                case 'panel': context.fillStyle = '#E0E0E0'; context.fillRect(this.x, this.y, this.width, this.height); context.strokeStyle = 'black'; context.strokeRect(this.x, this.y, this.width, this.height); break;
                case 'junction_box': context.fillStyle = '#D2B48C'; context.fillRect(this.x, this.y, this.width, this.height); context.fillStyle = 'black'; context.font = `${20 / zoom}px sans-serif`; context.fillText('J', centerX, centerY); break;
                case 'lamp': context.fillStyle = '#FFEB3B'; context.beginPath(); context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2); context.fill(); break;
                case 'switch': context.fillStyle = '#BDBDBD'; context.beginPath(); context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2); context.fill(); context.beginPath(); context.moveTo(this.x + 5, this.y + 5); context.lineTo(this.x + this.width - 5, this.y + this.height - 5); context.strokeStyle = 'black'; context.stroke(); break;
                case 'circuit_breaker': context.fillStyle = '#616161'; context.fillRect(this.x, this.y, this.width, this.height); context.fillStyle = '#FF5722'; context.fillRect(this.x + 10, this.y + 10, 10, 5); break;
                default: context.fillStyle = 'lightblue'; context.fillRect(this.x, this.y, this.width, this.height); break;
            }
            context.fillStyle = 'black';
            context.font = `${12 / zoom}px sans-serif`;
            context.fillText(this.getFullTag(), centerX, this.y + this.height + (10 / zoom));
            this.nodes.forEach((node, index) => {
                context.beginPath();
                context.arc(this.x + node.x, this.y + node.y, 5 / zoom, 0, 2 * Math.PI);
                if (hoveredNodeInfo && hoveredNodeInfo.obj === this && hoveredNodeInfo.nodeIndex === index) {
                    context.fillStyle = 'cyan';
                } else {
                    context.fillStyle = 'gray';
                }
                context.fill();
            });
            context.restore();
        }
        getNodeAt(pos) {
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];
                const dx = (this.x + node.x) - pos.x;
                const dy = (this.y + node.y) - pos.y;
                if (dx * dx + dy * dy < (10 / zoom) * (10 / zoom)) { return i; }
            }
            return null;
        }
        isClicked(mouseX, mouseY) {
            return mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
        }
        getFullTag() {
            return this.tag.parts.filter(p => p && String(p).trim() !== '').join('').toUpperCase();
        }
    }

    class Cable {
        constructor(startObj, startNodeIndex, endObj, endNodeIndex) {
            this.id = Date.now();
            this.startObj = startObj;
            this.startNodeIndex = startNodeIndex;
            this.endObj = endObj;
            this.endNodeIndex = endNodeIndex;
            this.tag = {
                parts: ['CABLE', String(sequenceCounter++).padStart(2, '0'), ''],
                modes: ['manual', 'sequence', 'manual']
            };
        }
        getFullTag() {
            return this.tag.parts.filter(p => p && String(p).trim() !== '').join('').toUpperCase();
        }
        getEndPoints() {
            const startNode = this.startObj.nodes[this.startNodeIndex];
            const endNode = this.endObj.nodes[this.endNodeIndex];
            return {
                start: { x: this.startObj.x + startNode.x, y: this.startObj.y + startNode.y },
                end: { x: this.endObj.x + endNode.x, y: this.endObj.y + endNode.y }
            };
        }
        draw(context) {
            const { start, end } = this.getEndPoints();
            context.save();
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            const isSelected = selectedItem === this;
            context.strokeStyle = isSelected ? 'red' : 'black';
            context.lineWidth = (isSelected ? 2 : 1) / zoom;
            context.stroke();
            if (isSelected) {
                context.beginPath();
                context.arc(start.x, start.y, 8 / zoom, 0, 2 * Math.PI);
                context.fillStyle = 'rgba(0, 255, 255, 0.5)';
                context.fill();
                context.beginPath();
                context.arc(end.x, end.y, 8 / zoom, 0, 2 * Math.PI);
                context.fill();
            }
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const textOffset = -15 / zoom;
            context.font = `${12 / zoom}px sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'bottom';
            const textMetrics = context.measureText(this.getFullTag());
            const textWidth = textMetrics.width;
            const textHeight = 12 / zoom;
            context.fillStyle = 'white';
            const bgX = midX - textWidth / 2 - (4 / zoom);
            const bgY = midY + textOffset - textHeight - (4 / zoom);
            context.fillRect(bgX, bgY, textWidth + (8 / zoom), textHeight + (8 / zoom));
            context.strokeStyle = '#CCCCCC';
            context.lineWidth = 1 / zoom;
            context.strokeRect(bgX, bgY, textWidth + (8 / zoom), textHeight + (8 / zoom));
            context.fillStyle = 'red';
            context.fillText(this.getFullTag(), midX, midY + textOffset);
            context.restore();
        }
        getHandleAt(pos) {
            const { start, end } = this.getEndPoints();
            if (Math.hypot(pos.x - start.x, pos.y - start.y) < 10 / zoom) return 'start';
            if (Math.hypot(pos.x - end.x, pos.y - end.y) < 10 / zoom) return 'end';
            return null;
        }
        isClicked(mouseX, mouseY) {
            if (this.getHandleAt({x: mouseX, y: mouseY})) return false;
            const { start, end } = this.getEndPoints();
            const dist = Math.abs((end.y - start.y) * mouseX - (end.x - start.x) * mouseY + end.x * start.y - end.y * start.x) / Math.sqrt(Math.pow(end.y - start.y, 2) + Math.pow(end.x - start.x, 2));
            return dist < 5 / zoom;
        }
    }

    function drawGrid() {
        const gridSize = 20;
        ctx.save();
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 1 / zoom;
        const x1 = (0 - panX) / zoom;
        const y1 = (0 - panY) / zoom;
        const x2 = (canvas.width - panX) / zoom;
        const y2 = (canvas.height - panY) / zoom;
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
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);
        
        drawGrid();
        cables.forEach(cable => cable.draw(ctx));
        objects.forEach(obj => obj.draw(ctx));

        ctx.lineWidth = 1 / zoom;
        if (isDrawingCable && cableStart) {
            const startNode = cableStart.obj.nodes[cableStart.nodeIndex];
            const startPos = { x: cableStart.obj.x + startNode.x, y: cableStart.obj.y + startNode.y };
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(cableEndPos.x, cableEndPos.y);
            ctx.strokeStyle = 'cyan';
            ctx.stroke();
        }
        if (isMovingCableEnd && movingCableInfo) {
            ctx.beginPath();
            ctx.moveTo(movingCableInfo.fixedPoint.x, movingCableInfo.fixedPoint.y);
            ctx.lineTo(cableEndPos.x, cableEndPos.y);
            ctx.strokeStyle = 'cyan';
            ctx.stroke();
        }
        if (selectedItem && selectedItem instanceof CanvasObject) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2 / zoom;
            ctx.strokeRect(selectedItem.x, selectedItem.y, selectedItem.width, selectedItem.height);
        }
        ctx.restore();
    }

    function updatePropertiesPanel() {
        propertiesContent.innerHTML = ''; // Clear previous content

        if (!selectedItem) {
            propertiesContent.innerHTML = '<p>Select an item to see its properties.</p>';
            return;
        }

        // Unified Tag Editor for both CanvasObject and Cable
        if (selectedItem.tag && typeof selectedItem.tag === 'object' && Array.isArray(selectedItem.tag.parts)) {
            const tagEditorWrapper = document.createElement('div');
            tagEditorWrapper.className = 'tag-editor';
            
            for (let i = 0; i < 3; i++) {
                const partWrapper = document.createElement('div');
                partWrapper.className = 'tag-part-editor';

                const label = document.createElement('label');
                label.textContent = `Tag Part ${i + 1}`;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = selectedItem.tag.parts[i];
                input.disabled = selectedItem.tag.modes[i] === 'sequence';
                input.addEventListener('input', (e) => {
                    selectedItem.tag.parts[i] = e.target.value.toUpperCase();
                    redrawCanvas();
                    updatePreviewTables();
                });

                const select = document.createElement('select');
                select.innerHTML = `<option value="manual">Manual</option><option value="sequence">Sequence</option>`;
                select.value = selectedItem.tag.modes[i];
                select.addEventListener('change', (e) => {
                    const newMode = e.target.value;
                    selectedItem.tag.modes[i] = newMode;
                    if (newMode === 'sequence') {
                        const seqValue = String(sequenceCounter++).padStart(2, '0');
                        selectedItem.tag.parts[i] = seqValue;
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

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteItem';
        deleteBtn.textContent = 'Delete Item';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.addEventListener('click', () => {
            if (!selectedItem) return;
            if (selectedItem instanceof CanvasObject) {
                objects = objects.filter(obj => obj.id !== selectedItem.id);
                cables = cables.filter(c => c.startObj.id !== selectedItem.id && c.endObj.id !== selectedItem.id);
            } else if (selectedItem instanceof Cable) {
                cables = cables.filter(c => c.id !== selectedItem.id);
            }
            selectedItem = null;
            updatePropertiesPanel();
            redrawCanvas();
            updatePreviewTables();
        });
        propertiesContent.appendChild(deleteBtn);
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const screenX = (evt.clientX - rect.left) * scaleX;
        const screenY = (evt.clientY - rect.top) * scaleY;
        return {
            x: (screenX - panX) / zoom,
            y: (screenY - panY) / zoom
        };
    }

    objectIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const category = icon.dataset.category;
            const worldX = (canvas.width / 2 - panX) / zoom;
            const worldY = (canvas.height / 2 - panY) / zoom;
            objects.push(new CanvasObject(worldX, worldY, category));
            redrawCanvas();
            updatePreviewTables();
        });

        icon.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', icon.dataset.category);
        });
    });

    canvas.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const category = e.dataTransfer.getData('text/plain');
        const pos = getMousePos(canvas, e);
        objects.push(new CanvasObject(pos.x, pos.y, category));
        redrawCanvas();
        updatePreviewTables();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (spacebarDown || e.button === 1) { // 1 is middle mouse button
            e.preventDefault();
            isPanning = true;
            panStart.x = e.clientX;
            panStart.y = e.clientY;
            canvas.style.cursor = 'grabbing';
            return;
        }
        const pos = getMousePos(canvas, e);
        if (selectedItem instanceof Cable) {
            const handle = selectedItem.getHandleAt(pos);
            if (handle) {
                isMovingCableEnd = true;
                const endpoints = selectedItem.getEndPoints();
                movingCableInfo = { cable: selectedItem, handle: handle, fixedPoint: handle === 'start' ? endpoints.end : endpoints.start };
                return;
            }
        }
        for (const obj of objects) {
            const nodeIndex = obj.getNodeAt(pos);
            if (nodeIndex !== null) {
                selectedItem = null;
                isDrawingCable = true;
                cableStart = { obj, nodeIndex };
                redrawCanvas();
                return;
            }
        }
        let clickedItem = null;
        for (let i = objects.length - 1; i >= 0; i--) {
            if (objects[i].isClicked(pos.x, pos.y)) {
                clickedItem = objects[i];
                isDragging = true;
                dragStart.x = pos.x - clickedItem.x;
                dragStart.y = pos.y - clickedItem.y;
                break;
            }
        }
        if (!clickedItem) {
            for (let i = cables.length - 1; i >= 0; i--) {
                if (cables[i].isClicked(pos.x, pos.y)) {
                    clickedItem = cables[i];
                    break;
                }
            }
        }
        selectedItem = clickedItem;
        updatePropertiesPanel();
        redrawCanvas();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            panX += dx;
            panY += dy;
            panStart.x = e.clientX;
            panStart.y = e.clientY;
            redrawCanvas();
            return;
        }
        const pos = getMousePos(canvas, e);
        hoveredNodeInfo = null;
        if (isMovingCableEnd) {
            cableEndPos = pos;
        } else if (isDrawingCable) {
            cableEndPos = pos;
        } else if (isDragging && selectedItem) {
            selectedItem.x = pos.x - dragStart.x;
            selectedItem.y = pos.y - dragStart.y;
        }
        for (const obj of objects) {
            const isConnectingToSelf = (isDrawingCable && obj.id === cableStart.obj.id);
            const isMovingToSameObj = (isMovingCableEnd && ((movingCableInfo.handle === 'start' && obj.id === movingCableInfo.cable.endObj.id) || (movingCableInfo.handle === 'end' && obj.id === movingCableInfo.cable.startObj.id)));
            if (isConnectingToSelf || isMovingToSameObj) continue;
            const nodeIndex = obj.getNodeAt(pos);
            if (nodeIndex !== null) {
                hoveredNodeInfo = { obj, nodeIndex };
                if (isDrawingCable || isMovingCableEnd) {
                    const node = obj.nodes[nodeIndex];
                    cableEndPos = { x: obj.x + node.x, y: obj.y + node.y };
                }
                break;
            }
        }
        redrawCanvas();
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = spacebarDown ? 'grab' : 'crosshair';
        }
        if (isMovingCableEnd) {
            if (hoveredNodeInfo) {
                const cable = movingCableInfo.cable;
                if (movingCableInfo.handle === 'start') {
                    cable.startObj = hoveredNodeInfo.obj;
                    cable.startNodeIndex = hoveredNodeInfo.nodeIndex;
                } else {
                    cable.endObj = hoveredNodeInfo.obj;
                    cable.endNodeIndex = hoveredNodeInfo.nodeIndex;
                }
            }
            isMovingCableEnd = false;
            movingCableInfo = null;
        } else if (isDrawingCable) {
            if (cableStart && hoveredNodeInfo) {
                cables.push(new Cable(cableStart.obj, cableStart.nodeIndex, hoveredNodeInfo.obj, hoveredNodeInfo.nodeIndex));
            }
            isDrawingCable = false;
            cableStart = null;
        }
        isDragging = false;
        hoveredNodeInfo = null;
        redrawCanvas();
        updatePreviewTables();
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        const zoomAmount = 0.1;
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        const oldZoom = zoom;
        
        zoom *= 1 + zoomDirection * zoomAmount;
        zoom = Math.max(0.1, Math.min(5, zoom));

        panX = screenX - (screenX - panX) * (zoom / oldZoom);
        panY = screenY - (screenY - panY) * (zoom / oldZoom);

        redrawCanvas();
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !spacebarDown) {
            e.preventDefault();
            spacebarDown = true;
            canvas.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            spacebarDown = false;
            if (!isPanning) {
                canvas.style.cursor = 'crosshair';
            }
        }
    });
    
    canvas.style.cursor = 'crosshair';

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        redrawCanvas();
    }

    function updatePreviewTables() {
        const objectsTableContent = document.getElementById('objects-table-content');
        const cablesTableContent = document.getElementById('cables-table-content');

        // Clear existing tables
        objectsTableContent.innerHTML = '';
        cablesTableContent.innerHTML = '';

        // Create Objects Table
        let objectsTable = '<table><thead><tr><th>ID</th><th>Category</th><th>Tag Part 1</th><th>Tag Part 2</th><th>Tag Part 3</th></tr></thead><tbody>';
        objects.forEach(obj => {
            objectsTable += `<tr><td>${obj.id}</td><td>${obj.category}</td><td>${obj.tag.parts[0]}</td><td>${obj.tag.parts[1]}</td><td>${obj.tag.parts[2]}</td></tr>`;
        });
        objectsTable += '</tbody></table>';
        objectsTableContent.innerHTML = objectsTable;
        
        // Create Cables Table
        let cablesTable = '<table><thead><tr><th>Cable Tag</th><th>From Object Tag</th><th>From Object Category</th><th>To Object Tag</th><th>To Object Category</th></tr></thead><tbody>';
        cables.forEach(cable => {
            cablesTable += `<tr><td>${cable.getFullTag()}</td><td>${cable.startObj.getFullTag()}</td><td>${cable.startObj.category}</td><td>${cable.endObj.getFullTag()}</td><td>${cable.endObj.category}</td></tr>`;
        });
        cablesTable += '</tbody></table>';
        cablesTableContent.innerHTML = cablesTable;
    }

    window.addEventListener('resize', resizeCanvas);
    
    // Table Toggling Logic
    const showObjectsBtn = document.getElementById('showObjectsBtn');
    const showCablesBtn = document.getElementById('showCablesBtn');
    const objectsTableWrapper = document.getElementById('objects-table-wrapper');
    const cablesTableWrapper = document.getElementById('cables-table-wrapper');

    // Default view
    objectsTableWrapper.style.display = 'none';
    cablesTableWrapper.style.display = 'block';

    showObjectsBtn.addEventListener('click', () => {
        objectsTableWrapper.style.display = 'block';
        cablesTableWrapper.style.display = 'none';
    });

    showCablesBtn.addEventListener('click', () => {
        objectsTableWrapper.style.display = 'none';
        cablesTableWrapper.style.display = 'block';
    });

    // Initial resize and draw
    resizeCanvas();
    updatePreviewTables();

    // Download Logic
    const downloadObjectsBtn = document.getElementById('downloadObjectsBtn');
    const downloadCablesBtn = document.getElementById('downloadCablesBtn');

    function escapeCsvCell(cell) {
        if (cell === null || cell === undefined) {
            return '';
        }
        const str = String(cell);
        // If the string contains a comma, double quote, or newline, enclose it in double quotes.
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            // Also, double up any existing double quotes.
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
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    downloadObjectsBtn.addEventListener('click', () => {
        const rows = [['ID', 'Category', 'Tag Part 1', 'Tag Part 2', 'Tag Part 3']];
        objects.forEach(obj => {
            rows.push([obj.id, obj.category, obj.tag.parts[0], obj.tag.parts[1], obj.tag.parts[2]]);
        });
        downloadCSV('objects.csv', rows);
    });

    downloadCablesBtn.addEventListener('click', () => {
        const rows = [['Cable Tag', 'From Object Tag', 'From Object Category', 'To Object Tag', 'To Object Category']];
        cables.forEach(cable => {
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
});
