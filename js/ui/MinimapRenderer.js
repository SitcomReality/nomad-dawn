// New file to handle minimap rendering logic

export default class MinimapRenderer {
    constructor(elementId) {
        this.minimapElement = document.getElementById(elementId);
        this.minimapCanvas = null;
        this.ctx = null;
        this.minimapSize = 150; // Default size, can be adjusted
        this.minimapScale = 0.02; // Scale factor for world to minimap

        this.initializeCanvas();
    }

    initializeCanvas() {
        if (!this.minimapElement) {
            console.error('Minimap DOM element not found:', this.elementId);
            return;
        }

        // Ensure size is applied to the container
        this.minimapElement.style.width = `${this.minimapSize}px`;
        this.minimapElement.style.height = `${this.minimapSize}px`;

        this.minimapCanvas = this.minimapElement.querySelector('canvas');
        if (!this.minimapCanvas) {
            this.minimapCanvas = document.createElement('canvas');
            this.minimapCanvas.width = this.minimapSize;
            this.minimapCanvas.height = this.minimapSize;
            this.minimapElement.appendChild(this.minimapCanvas);
        }
        this.ctx = this.minimapCanvas.getContext('2d');
    }

    render(world, player, entities, camera) {
        if (!this.ctx || !world || !player || !camera) return;

        const mCtx = this.ctx;
        const minimapSize = this.minimapSize;
        const minimapScale = this.minimapScale;

        // Clear minimap
        mCtx.clearRect(0, 0, minimapSize, minimapSize);
        mCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Slightly transparent background
        mCtx.fillRect(0, 0, minimapSize, minimapSize);
        
        // Draw minimap border (inside the circle)
        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        mCtx.lineWidth = 2;
        mCtx.beginPath();
        mCtx.arc(minimapSize / 2, minimapSize / 2, minimapSize / 2 - 1, 0, Math.PI * 2);
        mCtx.stroke();

        // Center coordinates on the minimap
        const centerX = minimapSize / 2;
        const centerY = minimapSize / 2;
        const visibleRadius = minimapSize / (2 * minimapScale); // World units visible in minimap radius

        // Clip drawing to the circular minimap area
        mCtx.save();
        mCtx.beginPath();
        mCtx.arc(centerX, centerY, minimapSize / 2, 0, Math.PI * 2);
        mCtx.clip();

        // Draw world chunks in minimap
        const chunksToRender = world.getChunksInRadius(player.x, player.y, visibleRadius * 1.5); // Load slightly more chunks
        for (const chunk of chunksToRender) {
            const mmX = centerX + (chunk.x - player.x) * minimapScale;
            const mmY = centerY + (chunk.y - player.y) * minimapScale;
            const mmChunkSize = chunk.size * minimapScale;

            // Check if chunk is roughly within minimap bounds before drawing
            if (mmX + mmChunkSize / 2 > 0 && mmX - mmChunkSize / 2 < minimapSize &&
                mmY + mmChunkSize / 2 > 0 && mmY - mmChunkSize / 2 < minimapSize) 
            {
                mCtx.fillStyle = chunk.biome ? chunk.biome.color : '#333';
                mCtx.globalAlpha = 0.7; // Make chunks slightly transparent
                mCtx.fillRect(
                    mmX - mmChunkSize / 2,
                    mmY - mmChunkSize / 2,
                    mmChunkSize,
                    mmChunkSize
                );
                 mCtx.globalAlpha = 1.0;
            }
        }

        // Draw entities
        for (const entity of entities) {
            // Check if entity is within visible radius
            const dx = entity.x - player.x;
            const dy = entity.y - player.y;
            if (dx * dx + dy * dy > visibleRadius * visibleRadius) {
                continue;
            }

            const mmX = centerX + dx * minimapScale;
            const mmY = centerY + dy * minimapScale;

            // Simple circle representation for entities
            let entityColor = '#f0f'; // Default magenta
            let entityRadius = 2;

            if (entity.id === player.id) { // Current player
                entityColor = '#fff'; // White
                entityRadius = 3;
            } else if (entity.type === 'player') { // Other players
                entityColor = '#5af'; // Blue
            } else if (entity.type === 'vehicle') { // Vehicles
                entityColor = '#fa0'; // Orange
                entityRadius = 2.5;
            } else if (entity.type === 'resource') { // Resources
                 entityColor = entity.color || '#ff0'; // Resource specific color or yellow
                 entityRadius = 1.5;
            }

             // Draw entity marker if within bounds
             if (mmX >= 0 && mmX <= minimapSize && mmY >= 0 && mmY <= minimapSize) {
                mCtx.fillStyle = entityColor;
                mCtx.beginPath();
                mCtx.arc(mmX, mmY, entityRadius, 0, Math.PI * 2);
                mCtx.fill();
             }
        }

        // Draw player view area (camera frustum representation)
        const viewWidth = 1 / camera.zoom * minimapSize * minimapScale;
        const viewHeight = 1 / camera.zoom * minimapSize * minimapScale;

        mCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        mCtx.lineWidth = 1;
        mCtx.strokeRect(
            minimapSize / 2 - viewWidth / 2,
            minimapSize / 2 - viewHeight / 2,
            viewWidth,
            viewHeight
        );

        // Restore context state (removes clipping path)
        mCtx.restore();

        // Draw cardinal directions (outside the clipped area)
        mCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        mCtx.font = 'bold 10px monospace';
        mCtx.textAlign = 'center';
        mCtx.textBaseline = 'middle';

        mCtx.fillText('N', minimapSize / 2, 8);
        mCtx.fillText('S', minimapSize / 2, minimapSize - 8);
        mCtx.fillText('W', 8, minimapSize / 2);
        mCtx.fillText('E', minimapSize - 8, minimapSize / 2);
    }
}