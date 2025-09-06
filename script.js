document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const objectCategorySelect = document.getElementById('objectCategory');
    const addObjectBtn = document.getElementById('addObjectBtn');
    const connectObjectsBtn = document.getElementById('connectObjects');
    const propertiesContent = document.getElementById('properties-content');

    let objects = [];
    let cables = [];
    let selectedItem = null;
    let isDragging = false;
    let startX, startY;
    let connectMode = false;
    let firstObject = null;

    class CanvasObject {
        constructor(x, y, category, width = 50, height = 50, tag = 'Untitled Object') {
            this.id = Date.now();
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.tag = tag;
            this.category = category;
        }

        draw(context) {
            context.save();
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Base properties
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            switch (this.category) {
                case 'panel':
                    this.width = 80; this.height = 120;
                    context.fillStyle = '#E0E0E0'; // light grey
                    context.fillRect(this.x, this.y, this.width, this.height);
                    context.strokeStyle = 'black';
                    context.strokeRect(this.x, this.y, this.width, this.height);
                    break;
                case 'junction_box':
                    this.width = 40; this.height = 40;
                    context.fillStyle = '#D2B48C'; // tan
                    context.fillRect(this.x, this.y, this.width, this.height);
                     context.fillStyle = 'black';
                    context.font = '20px sans-serif';
                    context.fillText('J', centerX, centerY);
                    break;
                case 'lamp':
                    this.width = 40; this.height = 40;
                    context.fillStyle = '#FFEB3B'; // yellow
                    context.beginPath();
                    context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
                    context.fill();
                    break;
                case 'switch':
                    this.width = 40; this.height = 40;
                    context.fillStyle = '#BDBDBD'; // grey
                    context.beginPath();
                    context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2);
                    context.fill();
                    context.beginPath();
                    context.moveTo(this.x + 5, this.y + 5);
                    context.lineTo(this.x + this.width - 5, this.y + this.height - 5);
                    context.strokeStyle = 'black';
                    context.stroke();
                    break;
                case 'circuit_breaker':
                    this.width = 30; this.height = 60;
                    context.fillStyle = '#616161'; // dark grey
                    context.fillRect(this.x, this.y, this.width, this.height);
                    context.fillStyle = '#FF5722'; // orange lever
                    context.fillRect(this.x + 10, this.y + 10, 10, 5);
                    break;
                default:
                    context.fillStyle = 'lightblue';
                    context.fillRect(this.x, this.y, this.width, this.height);
                    break;
            }

            // Draw tag for all types
            context.fillStyle = 'black';
            context.font = '12px sans-serif';
            context.fillText(this.tag, centerX, this.y + this.height + 10);
            context.restore();
        }

        getCenter() {
            return {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2
            };
        }

        isClicked(mouseX, mouseY) {
            return mouseX >= this.x && mouseX <= this.x + this.width &&
                   mouseY >= this.y && mouseY <= this.y + this.height;
        }
    }

    class Cable {
        constructor(obj1, obj2, tag = 'Untitled Cable') {
            this.id = Date.now();
            this.obj1 = obj1;
            this.obj2 = obj2;
            this.tag = tag;
        }

        draw(context) {
            const start = this.obj1.getCenter();
            const end = this.obj2.getCenter();

            context.save();

            // Draw the line
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.strokeStyle = 'black';
            context.lineWidth = 1;
            context.stroke();

            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const textOffset = -15; // Place text 15px "above" the line

            // Settings for the text
            context.font = '12px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'bottom';

            // Measure text for background
            const textMetrics = context.measureText(this.tag);
            const textWidth = textMetrics.width;
            const textHeight = 12;

            // Draw background
            context.fillStyle = 'white';
            const bgX = midX - textWidth / 2 - 4;
            const bgY = midY + textOffset - textHeight - 4;
            const bgWidth = textWidth + 8;
            const bgHeight = textHeight + 8;
            context.fillRect(bgX, bgY, bgWidth, bgHeight);

            // Draw a border around the background
            context.strokeStyle = '#CCCCCC';
            context.strokeRect(bgX, bgY, bgWidth, bgHeight);

            // Draw text
            context.fillStyle = 'red';
            context.fillText(this.tag, midX, midY + textOffset);

            context.restore();
        }

        isClicked(mouseX, mouseY) {
            const start = this.obj1.getCenter();
            const end = this.obj2.getCenter();
            const dist = Math.abs((end.y - start.y) * mouseX - (end.x - start.x) * mouseY + end.x * start.y - end.y * start.x) / Math.sqrt(Math.pow(end.y - start.y, 2) + Math.pow(end.x - start.x, 2));
            return dist < 5;
        }
    }

    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cables.forEach(cable => cable.draw(ctx));
        objects.forEach(obj => obj.draw(ctx));

        if (selectedItem) {
            ctx.strokeStyle = 'red';
            if (selectedItem instanceof CanvasObject) {
                // Adjust selection box to match resized object
                ctx.strokeRect(selectedItem.x, selectedItem.y, selectedItem.width, selectedItem.height);
            }
        }
    }

    function updatePropertiesPanel() {
        if (selectedItem) {
            propertiesContent.innerHTML = `
                <div>
                    <label for="tag-input">Tag:</label>
                    <input type="text" id="tag-input" value="${selectedItem.tag}">
                </div>
                <button id="deleteItem" style="margin-top: 10px;">Delete Item</button>
            `;
            const tagInput = document.getElementById('tag-input');
            tagInput.addEventListener('input', (e) => {
                selectedItem.tag = e.target.value;
                redrawCanvas();
            });

            const deleteBtn = document.getElementById('deleteItem');
            deleteBtn.addEventListener('click', () => {
                if (!selectedItem) return;

                if (selectedItem instanceof CanvasObject) {
                    objects = objects.filter(obj => obj.id !== selectedItem.id);
                    cables = cables.filter(cable => cable.obj1.id !== selectedItem.id && cable.obj2.id !== selectedItem.id);
                } else if (selectedItem instanceof Cable) {
                    cables = cables.filter(cable => cable.id !== selectedItem.id);
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
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    }

    addObjectBtn.addEventListener('click', () => {
        const category = objectCategorySelect.value;
        const newObject = new CanvasObject(50, 50, category, 50, 50, `New ${category}`);
        objects.push(newObject);
        redrawCanvas();
    });

    connectObjectsBtn.addEventListener('click', () => {
        connectMode = !connectMode;
        connectObjectsBtn.textContent = connectMode ? 'Cancel Connection' : 'Connect Objects';
        firstObject = null;
    });

    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(canvas, e);
        startX = pos.x;
        startY = pos.y;

        if (connectMode) {
            const clickedObject = objects.find(obj => obj.isClicked(pos.x, pos.y));
            if (clickedObject) {
                if (!firstObject) {
                    firstObject = clickedObject;
                } else if (firstObject !== clickedObject) {
                    cables.push(new Cable(firstObject, clickedObject));
                    firstObject = null;
                    connectMode = false;
                    connectObjectsBtn.textContent = 'Connect Objects';
                    redrawCanvas();
                }
            }
        } else {
            selectedItem = null;
            for (let i = objects.length - 1; i >= 0; i--) {
                if (objects[i].isClicked(pos.x, pos.y)) {
                    selectedItem = objects[i];
                    isDragging = true;
                    break;
                }
            }

            if (!selectedItem) {
                for (let i = cables.length - 1; i >= 0; i--) {
                    if (cables[i].isClicked(pos.x, pos.y)) {
                        selectedItem = cables[i];
                        break;
                    }
                }
            }

            updatePropertiesPanel();
            redrawCanvas();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectedItem instanceof CanvasObject) {
            const pos = getMousePos(canvas, e);
            const dx = pos.x - startX;
            const dy = pos.y - startY;
            selectedItem.x += dx;
            selectedItem.y += dy;
            startX = pos.x;
            startY = pos.y;
            redrawCanvas();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    redrawCanvas();
});
