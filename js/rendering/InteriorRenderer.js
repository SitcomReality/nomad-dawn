// New file: js/rendering/InteriorRenderer.js

export default class InteriorRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
    }

    /**
     * Renders the interior view of a vehicle.
     * @param {Vehicle} vehicle - The vehicle entity being viewed.
     * @param {Player} player - The player entity inside the vehicle.
     */
    render(vehicle, player) {
        if (!vehicle || !player) return;

        const { gridWidth, gridHeight, gridTiles, gridObjects, doorLocation, pilotSeatLocation } = vehicle;
        const canvasWidth = this.renderer.canvas.width;
        const canvasHeight = this.renderer.canvas.height;

        // --- Calculate Grid Display Properties ---
        const maxGridSize = Math.min(canvasWidth * 0.8, canvasHeight * 0.8); // Use 80% of screen
        const cellWidth = maxGridSize / gridWidth;
        const cellHeight = maxGridSize / gridHeight;
        const cellSize = Math.min(cellWidth, cellHeight); // Use square cells

        const gridDisplayWidth = cellSize * gridWidth;
        const gridDisplayHeight = cellSize * gridHeight;

        // Center the grid on the canvas
        const gridStartX = (canvasWidth - gridDisplayWidth) / 2;
        const gridStartY = (canvasHeight - gridDisplayHeight) / 2;

        // --- Clear Background ---
        this.ctx.fillStyle = 'rgba(0, 10, 20, 0.95)'; // Dark blue overlay
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // --- Draw Grid Background ---
        this.ctx.fillStyle = 'rgba(40, 50, 70, 1)';
        this.ctx.fillRect(gridStartX, gridStartY, gridDisplayWidth, gridDisplayHeight);

        // --- Draw Tiles ---
        for (let gy = 0; gy < gridHeight; gy++) {
            for (let gx = 0; gx < gridWidth; gx++) {
                const tileKey = `${gx},${gy}`;
                const tileType = gridTiles ? gridTiles[tileKey] : 'Empty'; // Default if gridTiles missing
                const screenX = gridStartX + gx * cellSize;
                const screenY = gridStartY + gy * cellSize;

                // Basic tile rendering
                let tileColor = 'rgba(60, 70, 90, 1)'; // Default empty space
                if (tileType === 'Floor') {
                    tileColor = 'rgba(100, 110, 130, 1)';
                } else if (tileType === 'Wall') {
                    tileColor = 'rgba(150, 160, 180, 1)';
                }

                // Highlight special locations
                if (doorLocation && gx === doorLocation.x && gy === doorLocation.y) {
                    tileColor = 'rgba(100, 180, 100, 1)'; // Greenish for door
                } else if (pilotSeatLocation && gx === pilotSeatLocation.x && gy === pilotSeatLocation.y) {
                    tileColor = 'rgba(100, 100, 180, 1)'; // Bluish for pilot seat
                }

                this.ctx.fillStyle = tileColor;
                this.ctx.fillRect(screenX, screenY, cellSize, cellSize);
            }
        }

        // --- Draw Grid Lines ---
        this.ctx.strokeStyle = 'rgba(20, 30, 50, 0.5)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= gridWidth; i++) {
            const x = gridStartX + i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, gridStartY);
            this.ctx.lineTo(x, gridStartY + gridDisplayHeight);
            this.ctx.stroke();
        }
        for (let i = 0; i <= gridHeight; i++) {
            const y = gridStartY + i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(gridStartX, y);
            this.ctx.lineTo(gridStartX + gridDisplayWidth, y);
            this.ctx.stroke();
        }

        // --- Draw Grid Objects ---
        if (gridObjects) {
            for (const objectId in gridObjects) {
                const obj = gridObjects[objectId];
                if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') continue;

                const screenX = gridStartX + obj.x * cellSize;
                const screenY = gridStartY + obj.y * cellSize;
                const objectSize = cellSize * 0.8; // Example: 80% of cell size

                // Simple rendering for now
                let objectColor = '#ffcc66'; // Default object color (orange)
                if (obj.type === 'StorageContainer') objectColor = '#996633'; // Brown
                else if (obj.type === 'CraftingBench') objectColor = '#cccccc'; // Light grey

                this.ctx.fillStyle = objectColor;
                this.ctx.fillRect(
                    screenX + (cellSize - objectSize) / 2,
                    screenY + (cellSize - objectSize) / 2,
                    objectSize,
                    objectSize
                );

                // Draw object label (optional)
                if (this.game.debug.isEnabled()) {
                     this.ctx.fillStyle = 'white';
                     this.ctx.font = `${cellSize * 0.2}px monospace`;
                     this.ctx.textAlign = 'center';
                     this.ctx.fillText(obj.type || 'Object', screenX + cellSize / 2, screenY + cellSize / 2);
                }
            }
        }


        // --- Draw Player Character on Grid ---
        const playerScreenX = gridStartX + player.gridX * cellSize + cellSize / 2;
        const playerScreenY = gridStartY + player.gridY * cellSize + cellSize / 2;
        const playerSize = cellSize * 0.6; // Player smaller than cell

        this.ctx.fillStyle = '#45aaf2'; // Player color
        this.ctx.beginPath();
        this.ctx.arc(playerScreenX, playerScreenY, playerSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw player direction indicator (if angle is tracked in interior)
        // const playerAngle = player.angle; // Assuming angle is still relevant/updated
        // this.ctx.strokeStyle = 'white';
        // this.ctx.lineWidth = 2;
        // this.ctx.beginPath();
        // this.ctx.moveTo(playerScreenX, playerScreenY);
        // this.ctx.lineTo(playerScreenX + Math.cos(playerAngle) * playerSize / 2, playerScreenY + Math.sin(playerAngle) * playerSize / 2);
        // this.ctx.stroke();

         // Draw Player Name/ID above character
         this.ctx.fillStyle = 'white';
         this.ctx.font = `bold ${cellSize * 0.2}px monospace`;
         this.ctx.textAlign = 'center';
         this.ctx.fillText(player.name || player.id.substring(0, 4), playerScreenX, playerScreenY - playerSize * 0.6);


        // --- Draw UI Hints (Optional) ---
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Vehicle: ${vehicle.name} | [WASD] Move | [E] Interact`, canvasWidth / 2, 30);

    }
}
