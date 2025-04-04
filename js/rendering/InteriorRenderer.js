import InteriorSpriteRenderer from './InteriorSpriteRenderer.js';

export default class InteriorRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;

        // Initialize sprite renderer
        this.spriteRenderer = new InteriorSpriteRenderer(game);

        // Define colors
        this.colors = {
            background: '#1a1a1a',
            gridLines: 'rgba(255, 255, 255, 0.1)',
            gridBorder: 'rgba(255, 255, 255, 0.4)', 
            door: '#f1faee',
            pilotSeat: '#e63946',
            player: '#457b9d',
            defaultTile: '#333',
            defaultObject: '#a8dadc',
            text: '#f1faee',
            errorBg: 'rgba(50, 0, 0, 0.8)', 
        };

        // Define rendering parameters
        this.padding = 30; 
        this.maxGridWidthPixels = 600; 
        this.maxGridHeightPixels = 400; 
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
        const cellPixelSize = Math.min(cellPixelWidth, cellPixelHeight); 

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
        this.ctx.fillStyle = this.colors.defaultTile; 
        this.ctx.fillRect(gridStartX, gridStartY, finalGridPixelWidth, finalGridPixelHeight);
        this.ctx.strokeStyle = this.colors.gridBorder;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(gridStartX, gridStartY, finalGridPixelWidth, finalGridPixelHeight);

        // --- Draw Grid Tiles ---
        if (vehicle.gridTiles) {
            for (const cellKey in vehicle.gridTiles) {
                const tileTypeId = vehicle.gridTiles[cellKey];
                if (!tileTypeId) continue; 

                // Basic validation of cellKey format
                const parts = cellKey.split(',');
                if (parts.length !== 2) continue;
                const x = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
                if (isNaN(x) || isNaN(y) || x < 0 || x >= vehicle.gridWidth || y < 0 || y >= vehicle.gridHeight) {
                    this.game.debug.warn(`[InteriorRenderer] Invalid tile key '${cellKey}' for vehicle ${vehicle.id}`);
                    continue;
                }

                this.drawTile(x, y, tileTypeId, gridStartX, gridStartY, cellPixelSize);
            }
        }

        // --- Draw Grid Objects ---
        if (vehicle.gridObjects) {
            for (const cellKey in vehicle.gridObjects) {
                const objectTypeId = vehicle.gridObjects[cellKey];
                if (!objectTypeId) continue; 

                // Basic validation of cellKey format
                const parts = cellKey.split(',');
                if (parts.length !== 2) continue;
                const x = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
                if (isNaN(x) || isNaN(y) || x < 0 || x >= vehicle.gridWidth || y < 0 || y >= vehicle.gridHeight) {
                    this.game.debug.warn(`[InteriorRenderer] Invalid object key '${cellKey}' for vehicle ${vehicle.id}`);
                    continue;
                }

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
        const playerScreenSize = cellPixelSize * 0.6; 

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

        // Look up tile config
        const tileConfig = this.game.config?.INTERIOR_TILE_TYPES?.find(t => t.id === tileTypeId);
        const tileColor = tileConfig?.color || this.colors.defaultTile;

        // First draw the base color as fallback
        this.ctx.fillStyle = tileColor;
        this.ctx.fillRect(screenX, screenY, cellPixelSize, cellPixelSize);

        // Try to draw the sprite if available
        const spriteId = this.spriteRenderer.getSpriteIdForItem(tileTypeId, 'tile');
        if (spriteId) {
            // Draw sprite centered in the cell
            const success = this.spriteRenderer.renderSprite(
                this.ctx, 
                spriteId, 
                screenX + cellPixelSize / 2, 
                screenY + cellPixelSize / 2, 
                cellPixelSize, 
                cellPixelSize,
                { smoothing: false }
            );
            
            // If sprite rendering failed, we already have the color background
            if (!success) {
                // Add grid lines for better visibility
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(screenX + 0.5, screenY + 0.5, cellPixelSize - 1, cellPixelSize - 1);
            }
        } else {
            // Draw a subtle border for tiles without sprites
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenX + 0.5, screenY + 0.5, cellPixelSize - 1, cellPixelSize - 1);
        }
    }

    drawObject(x, y, objectTypeId, gridStartX, gridStartY, cellPixelSize) {
        const screenX = gridStartX + x * cellPixelSize;
        const screenY = gridStartY + y * cellPixelSize;

        // Look up object configuration from game config
        const objectConfig = this.game.config?.INTERIOR_OBJECT_TYPES?.find(o => o.id === objectTypeId);
        const objectColor = objectConfig?.color || this.colors.defaultObject;
        const objectIcon = objectConfig?.icon || '?';

        // Draw colored square for the object base (fallback)
        this.ctx.fillStyle = objectColor;
        this.ctx.fillRect(screenX + 1, screenY + 1, cellPixelSize - 2, cellPixelSize - 2);

        // Try to draw the sprite if available
        const spriteId = this.spriteRenderer.getSpriteIdForItem(objectTypeId, 'object');
        let spriteDrawn = false;
        
        if (spriteId) {
            // Draw sprite centered in the cell
            spriteDrawn = this.spriteRenderer.renderSprite(
                this.ctx,
                spriteId,
                screenX + cellPixelSize / 2,
                screenY + cellPixelSize / 2,
                cellPixelSize,
                cellPixelSize,
                { smoothing: false }
            );
        }
        
        // If no sprite or sprite drawing failed, use the icon fallback
        if (!spriteDrawn) {
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = `bold ${cellPixelSize * 0.6}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(objectIcon, screenX + cellPixelSize / 2, screenY + cellPixelSize / 2 + 1);
        }
    }

    drawSpecialLocation(location, color, label, gridStartX, gridStartY, cellPixelSize) {
        if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') return;

        const locX = gridStartX + location.x * cellPixelSize;
        const locY = gridStartY + location.y * cellPixelSize;

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.3; 
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
        this.ctx.textBaseline = 'alphabetic'; 
    }

    renderError(message) {
        this.ctx.fillStyle = this.colors.errorBg;
        this.ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Interior Render Error: ${message}`, this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);
    }
}