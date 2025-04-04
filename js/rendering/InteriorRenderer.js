// New file: js/rendering/InteriorRenderer.js

export default class InteriorRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;

        // Define colors
        this.colors = {
            background: '#1a1a1a',
            gridLines: 'rgba(255, 255, 255, 0.1)',
            gridBorder: 'rgba(255, 255, 255, 0.3)',
            door: '#f1faee',
            pilotSeat: '#e63946',
            player: '#457b9d',
            defaultTile: '#333',
            defaultObject: '#a8dadc',
            text: '#f1faee' // Added for object icons
        };

        // Define rendering parameters
        this.padding = 30; // Padding around the grid
        this.maxGridWidthPixels = 600; // Max width for the grid display
        this.maxGridHeightPixels = 400; // Max height for the grid display
    }

    render(vehicle, player) {
        if (!vehicle || !player) {
            this.game.debug.warn("[InteriorRenderer] Render called without valid vehicle or player.");
            this.renderError("Vehicle or Player data missing");
            return;
        }

        // --- Calculate Grid Rendering Dimensions ---
        const canvasWidth = this.renderer.canvas.width;
        const canvasHeight = this.renderer.canvas.height;
        const availableWidth = canvasWidth - 2 * this.padding;
        const availableHeight = canvasHeight - 2 * this.padding;

        const gridPixelWidth = Math.min(this.maxGridWidthPixels, availableWidth);
        const gridPixelHeight = Math.min(this.maxGridHeightPixels, availableHeight);

        // Calculate cell size based on fitting the grid within the allocated space
        const cellPixelWidth = gridPixelWidth / vehicle.gridWidth;
        const cellPixelHeight = gridPixelHeight / vehicle.gridHeight;
        const cellPixelSize = Math.min(cellPixelWidth, cellPixelHeight); // Use the smaller dimension to maintain aspect ratio

        // Recalculate actual grid pixel dimensions based on uniform cell size
        const finalGridPixelWidth = cellPixelSize * vehicle.gridWidth;
        const finalGridPixelHeight = cellPixelSize * vehicle.gridHeight;

        // Calculate top-left corner of the grid for centering
        const gridStartX = (canvasWidth - finalGridPixelWidth) / 2;
        const gridStartY = (canvasHeight - finalGridPixelHeight) / 2;

        // --- Clear Background ---
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // --- Draw Grid Background & Border ---
        this.ctx.fillStyle = this.colors.defaultTile; // Default background tile color
        this.ctx.fillRect(gridStartX, gridStartY, finalGridPixelWidth, finalGridPixelHeight);
        this.ctx.strokeStyle = this.colors.gridBorder;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(gridStartX, gridStartY, finalGridPixelWidth, finalGridPixelHeight);

        // --- Draw Grid Tiles ---
        if (vehicle.gridTiles) {
             for (const cellKey in vehicle.gridTiles) {
                 const tileTypeId = vehicle.gridTiles[cellKey];
                 if (!tileTypeId) continue; // Skip null/empty tiles

                 const [xStr, yStr] = cellKey.split(',');
                 const x = parseInt(xStr, 10);
                 const y = parseInt(yStr, 10);
                 if (isNaN(x) || isNaN(y)) continue;

                 this.drawTile(x, y, tileTypeId, gridStartX, gridStartY, cellPixelSize);
             }
        }

        // --- Draw Grid Objects ---
        if (vehicle.gridObjects) {
            for (const cellKey in vehicle.gridObjects) {
                 const objectTypeId = vehicle.gridObjects[cellKey];
                 if (!objectTypeId) continue; // Skip null/empty objects

                 const [xStr, yStr] = cellKey.split(',');
                 const x = parseInt(xStr, 10);
                 const y = parseInt(yStr, 10);
                 if (isNaN(x) || isNaN(y)) continue;

                 this.drawObject(x, y, objectTypeId, gridStartX, gridStartY, cellPixelSize);
            }
        }

        // --- Draw Grid Lines ---
        this.ctx.strokeStyle = this.colors.gridLines;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 1; i < vehicle.gridWidth; i++) {
            const x = gridStartX + i * cellPixelSize;
            this.ctx.moveTo(x, gridStartY);
            this.ctx.lineTo(x, gridStartY + finalGridPixelHeight);
        }
        for (let j = 1; j < vehicle.gridHeight; j++) {
            const y = gridStartY + j * cellPixelSize;
            this.ctx.moveTo(gridStartX, y);
            this.ctx.lineTo(gridStartX + finalGridPixelWidth, y);
        }
        this.ctx.stroke();

        // --- Draw Special Locations (Door, Pilot Seat) ---
        this.drawSpecialLocation(vehicle.doorLocation, this.colors.door, 'Door', gridStartX, gridStartY, cellPixelSize);
        this.drawSpecialLocation(vehicle.pilotSeatLocation, this.colors.pilotSeat, 'Pilot', gridStartX, gridStartY, cellPixelSize);

        // --- Draw Player ---
        const playerScreenX = gridStartX + player.gridX * cellPixelSize + cellPixelSize / 2;
        const playerScreenY = gridStartY + player.gridY * cellPixelSize + cellPixelSize / 2;
        const playerScreenSize = cellPixelSize * 0.6; // Player smaller than cell

        this.ctx.fillStyle = this.colors.player;
        this.ctx.beginPath();
        this.ctx.arc(playerScreenX, playerScreenY, playerScreenSize / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // --- Draw UI Text Info ---
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Vehicle: ${vehicle.name} (${vehicle.id})`, this.padding, this.padding);
        this.ctx.fillText(`Grid Pos: (${player.gridX.toFixed(1)}, ${player.gridY.toFixed(1)})`, this.padding, this.padding + 20);
        this.ctx.fillText(`[WASD] Move | [E] Use/Exit`, this.padding, canvasHeight - this.padding);

    }

    drawTile(x, y, tileTypeId, gridStartX, gridStartY, cellPixelSize) {
         const screenX = gridStartX + x * cellPixelSize;
         const screenY = gridStartY + y * cellPixelSize;

         // TODO: Look up tile config (color, sprite, etc.) if tiles become complex
         const tileColor = this.colors.defaultTile; // Currently all tiles are the same default

         this.ctx.fillStyle = tileColor;
         this.ctx.fillRect(screenX, screenY, cellPixelSize, cellPixelSize);
         // Later: Draw tile sprite if available
    }

    drawObject(x, y, objectTypeId, gridStartX, gridStartY, cellPixelSize) {
         const screenX = gridStartX + x * cellPixelSize;
         const screenY = gridStartY + y * cellPixelSize;

         // Look up object configuration from game config
         const objectConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectTypeId);
         const objectColor = objectConfig?.color || this.colors.defaultObject;
         const objectIcon = objectConfig?.icon || '?';

         // Draw colored square for the object base
         this.ctx.fillStyle = objectColor;
         this.ctx.fillRect(screenX + 1, screenY + 1, cellPixelSize - 2, cellPixelSize - 2); // Slightly inset

         // Draw Icon/Symbol in the center
         this.ctx.fillStyle = this.colors.text;
         this.ctx.font = `bold ${cellPixelSize * 0.6}px monospace`; // Scale icon size with cell size
         this.ctx.textAlign = 'center';
         this.ctx.textBaseline = 'middle';
         this.ctx.fillText(objectIcon, screenX + cellPixelSize / 2, screenY + cellPixelSize / 2 + 1); // Center icon (+1px vertical adjust)

         // Later: Draw object sprite if available
    }


    drawSpecialLocation(location, color, label, gridStartX, gridStartY, cellPixelSize) {
        if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') return;

        const locX = gridStartX + location.x * cellPixelSize;
        const locY = gridStartY + location.y * cellPixelSize;

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.3; // Make it slightly transparent
        this.ctx.fillRect(locX, locY, cellPixelSize, cellPixelSize);
        this.ctx.globalAlpha = 1.0;

        // Draw border and label
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(locX, locY, cellPixelSize, cellPixelSize);

        this.ctx.fillStyle = color;
        this.ctx.font = `${Math.max(8, cellPixelSize * 0.2)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, locX + cellPixelSize / 2, locY + cellPixelSize / 2);
        this.ctx.textBaseline = 'alphabetic'; // Reset baseline
    }

    renderError(message) {
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Interior Render Error: ${message}`, this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);
    }
}