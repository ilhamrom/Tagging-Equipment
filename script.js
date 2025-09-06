document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const objectCategorySelect = document.getElementById('objectCategory');
    const addObjectBtn = document.getElementById('addObjectBtn');
    const propertiesContent = document.getElementById('properties-content');

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

    class CanvasObject {
        constructor(x, y, category, tag = 'Untitled Object') {
            this.id = Date.now();
            this.x = x;
            this.y = y;
            this.tag = tag;
            this.category = category;
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
            context.fillText(this.tag, centerX, this.y + this.height + (10 / zoom));
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
    }

    class Cable {
        constructor(startObj, startNodeIndex, endObj, endNodeIndex, tag = 'Untitled Cable') {
            this.id = Date.now();
            this.startObj = startObj;
            this.startNodeIndex = startNodeIndex;
            this.endObj = endObj;
            this.endNodeIndex = endNodeIndex;
            this.tag = tag;
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
            const textMetrics = context.measureText(this.tag);
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
            context.fillText(this.tag, midX, midY + textOffset);
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
        if (selectedItem) {
            propertiesContent.innerHTML = `<div><label for="tag-input">Tag:</label><input type="text" id="tag-input" value="${selectedItem.tag}"></div><button id="deleteItem" style="margin-top: 10px;">Delete Item</button>`;
            document.getElementById('tag-input').addEventListener('input', (e) => {
                selectedItem.tag = e.target.value;
                redrawCanvas();
            });
            document.getElementById('deleteItem').addEventListener('click', () => {
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
            });
        } else {
            propertiesContent.innerHTML = '<p>Select an item to see its properties.</p>';
        }
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

    addObjectBtn.addEventListener('click', () => {
        const category = objectCategorySelect.value;
        const worldX = (canvas.width / 2 - panX) / zoom;
        const worldY = (canvas.height / 2 - panY) / zoom;
        objects.push(new CanvasObject(worldX, worldY, category));
        redrawCanvas();
    });

    canvas.addEventListener('mousedown', (e) => {
        if (spacebarDown) {
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
    redrawCanvas();
});
