export class CanvasObject {
    constructor(x, y, category, sequenceCounter) {
        this.id = Date.now();
        this.x = x;
        this.y = y;
        this.category = category;
        this.tag = {
            parts: [category.toUpperCase(), String(sequenceCounter).padStart(2, '0'), ''],
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

    draw(context, zoom, hoveredNodeInfo) {
        context.save();
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        context.lineWidth = 1 / zoom;

        // Modernized Drawing Styles
        const a = (c, v) => `rgba(${c}, ${v})`;
        context.strokeStyle = a('220, 220, 220', 0.8);
        
        switch (this.category) {
            case 'panel': 
                context.fillStyle = '#4a4a4a'; 
                context.fillRect(this.x, this.y, this.width, this.height); 
                context.strokeRect(this.x, this.y, this.width, this.height); 
                break;
            case 'junction_box': 
                context.fillStyle = '#616161'; 
                context.fillRect(this.x, this.y, this.width, this.height); 
                context.fillStyle = '#f5f5f5'; 
                context.font = `${20 / zoom}px var(--font-main)`; 
                context.fillText('J', centerX, centerY); 
                break;
            case 'lamp': 
                context.fillStyle = '#4f46e5'; 
                context.beginPath(); 
                context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2); 
                context.fill(); 
                break;
            case 'switch': 
                context.fillStyle = '#757575'; 
                context.beginPath(); 
                context.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2); 
                context.fill(); 
                context.beginPath(); 
                context.moveTo(this.x + 5, this.y + 5); 
                context.lineTo(this.x + this.width - 5, this.y + this.height - 5); 
                context.strokeStyle = '#f5f5f5'; 
                context.stroke(); 
                break;
            case 'circuit_breaker': 
                context.fillStyle = '#555'; 
                context.fillRect(this.x, this.y, this.width, this.height); 
                context.fillStyle = '#ef4444'; 
                context.fillRect(this.x + 10, this.y + 10, 10, 5); 
                break;
            default: 
                context.fillStyle = '#4f46e5'; 
                context.fillRect(this.x, this.y, this.width, this.height); 
                break;
        }
        
        context.fillStyle = '#f5f5f5';
        context.font = `${12 / zoom}px var(--font-main)`;
        context.fillText(this.getFullTag(), centerX, this.y + this.height + (15 / zoom));

        this.nodes.forEach((node, index) => {
            context.beginPath();
            context.arc(this.x + node.x, this.y + node.y, 6 / zoom, 0, 2 * Math.PI);
            if (hoveredNodeInfo && hoveredNodeInfo.obj === this && hoveredNodeInfo.nodeIndex === index) {
                context.fillStyle = '#00ffff'; // Cyan
            } else {
                context.fillStyle = '#9e9e9e'; // Grey
            }
            context.fill();
        });

        context.restore();
    }

    getNodeAt(pos, zoom) {
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
