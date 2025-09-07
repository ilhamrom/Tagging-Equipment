export class Cable {
    constructor(startObj, startNodeIndex, endObj, endNodeIndex, sequenceCounter) {
        this.id = Date.now();
        this.startObj = startObj;
        this.startNodeIndex = startNodeIndex;
        this.endObj = endObj;
        this.endNodeIndex = endNodeIndex;
        this.tag = {
            parts: ['CABLE', String(sequenceCounter).padStart(2, '0'), ''],
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

    draw(context, zoom, isSelected) {
        const { start, end } = this.getEndPoints();
        context.save();
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);

        context.strokeStyle = isSelected ? '#ef4444' : '#f5f5f5'; // Red or White
        context.lineWidth = (isSelected ? 3 : 1.5) / zoom;
        context.stroke();

        if (isSelected) {
            context.beginPath();
            context.arc(start.x, start.y, 8 / zoom, 0, 2 * Math.PI);
            context.fillStyle = 'rgba(0, 255, 255, 0.5)'; // Cyan with transparency
            context.fill();

            context.beginPath();
            context.arc(end.x, end.y, 8 / zoom, 0, 2 * Math.PI);
            context.fill();
        }

        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const textOffset = -15 / zoom;

        context.font = `${12 / zoom}px var(--font-main)`;
        context.textAlign = 'center';
        context.textBaseline = 'bottom';

        const tagText = this.getFullTag();
        const textMetrics = context.measureText(tagText);
        const textWidth = textMetrics.width;
        const textHeight = 12 / zoom;

        context.fillStyle = '#2c2c2c'; // Surface color for background
        const bgX = midX - textWidth / 2 - (4 / zoom);
        const bgY = midY + textOffset - textHeight - (4 / zoom);
        context.fillRect(bgX, bgY, textWidth + (8 / zoom), textHeight + (8 / zoom));

        context.strokeStyle = '#404040'; // Border color
        context.lineWidth = 1 / zoom;
        context.strokeRect(bgX, bgY, textWidth + (8 / zoom), textHeight + (8 / zoom));

        context.fillStyle = '#ef4444'; // Red text
        context.fillText(tagText, midX, midY + textOffset);

        context.restore();
    }

    getHandleAt(pos, zoom) {
        const { start, end } = this.getEndPoints();
        if (Math.hypot(pos.x - start.x, pos.y - start.y) < 10 / zoom) return 'start';
        if (Math.hypot(pos.x - end.x, pos.y - end.y) < 10 / zoom) return 'end';
        return null;
    }

    isClicked(mouseX, mouseY, zoom) {
        if (this.getHandleAt({x: mouseX, y: mouseY}, zoom)) return false;

        const { start, end } = this.getEndPoints();
        const dist = Math.abs((end.y - start.y) * mouseX - (end.x - start.x) * mouseY + end.x * start.y - end.y * start.x) / Math.hypot(end.y - start.y, end.x - start.x);

        return dist < 5 / zoom;
    }
}
