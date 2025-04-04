/**
 * Renders the vehicle interior grid specifically for the building UI.
 * This will allow placing tiles, objects, and visualizing the layout.
 */
export default class VehicleBuildingRenderer {
    constructor(game, canvasId) {
        this.game = game;
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`[VehicleBuildingRenderer] Canvas element #${canvasId} not found!`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        this.vehicle = null; // The vehicle being edited
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.cellPixelSize = 30; // Size of each grid cell in pixels

        this.colors = {
            background: '#2a2a2a',
            gridLines: 'rgba(255, 255, 255, 0.1)',
            gridBorder: 'rgba(255, 255, 255, 0.3)',
            hoverCell: 'rgba(168, 218, 220, 0.4)', // Light blue transparent
            selectedCell: 'rgba(230, 57, 70, 0.5)', // Red transparent
            door: '#f1faee',
            pilotSeat: '#e63946',
            defaultTile: '#444',
            defaultObject: '#a8dadc', // Fallback object color
            text: '#f1faee'
        };

        this.hoveredCell = { x: -1, y: -1 };
        this.selectedCell = { x: -1, y: -1 };

        this.setupMouseListeners();
    }

    setupMouseListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            this.updateHoveredCell(mouseX, mouseY);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredCell = { x: -1, y: -1 };
        });

        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            this.updateSelectedCell(mouseX, mouseY);
            // Trigger action in VehicleBuildingManager based on selected tool
             if (this.game.ui?.baseBuilding?.buildingManager) {
                 this.game.ui.baseBuilding.buildingManager.handleGridClick(this.selectedCell.x, this.selectedCell.y);
             }
        });
    }

    updateHoveredCell(mouseX, mouseY) {
        if (!this.vehicle) {
            this.hoveredCell = { x: -1, y: -1 };
            return;
        }
        const gridX = Math.floor((mouseX - this.gridOffsetX) / this.cellPixelSize);
        const gridY = Math.floor((mouseY - this.gridOffsetY) / this.cellPixelSize);

        if (gridX >= 0 && gridX < this.vehicle.gridWidth && gridY >= 0 && gridY < this.vehicle.gridHeight) {
            this.hoveredCell = { x: gridX, y: gridY };
        } else {
            this.hoveredCell = { x: -1, y: -1 };
        }
    }

    updateSelectedCell(mouseX, mouseY) {
         if (!this.vehicle) {
            this.selectedCell = { x: -1, y: -1 };
            return;
        }
        const gridX = Math.floor((mouseX - this.gridOffsetX) / this.cellPixelSize);
        const gridY = Math.floor((mouseY - this.gridOffsetY) / this.cellPixelSize);

        if (gridX >= 0 && gridX < this.vehicle.gridWidth && gridY >= 0 && gridY < this.vehicle.gridHeight) {
            this.selectedCell = { x: gridX, y: gridY };
        } else {
            this.selectedCell = { x: -1, y: -1 };
        }
         this.game.debug.log(`[BuildingRenderer] Selected Cell: (${this.selectedCell.x}, ${this.selectedCell.y})`);
    }

    setVehicle(vehicle) {
        this.vehicle = vehicle;
        this.resizeCanvasToFitGrid();
        // No initial render here, render() is called in BaseBuildingUI.update()
    }

    resizeCanvasToFitGrid() {
        if (!this.vehicle || !this.canvas) return;

        // Calculate required canvas size based on grid and cell size
        const requiredWidth = this.vehicle.gridWidth * this.cellPixelSize;
        const requiredHeight = this.vehicle.gridHeight * this.cellPixelSize;

        // Adjust canvas dimensions only if they changed significantly
        if (this.canvas.width !== requiredWidth || this.canvas.height !== requiredHeight) {
            this.canvas.width = requiredWidth;
            this.canvas.height = requiredHeight;
        }

        // Grid starts at 0,0 within this dedicated canvas
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
    }

    render() {
        if (!this.ctx) return; // Do nothing if no context

         // Ensure vehicle data is present before rendering it
         if (!this.vehicle) {
             this.ctx.fillStyle = this.colors.background;
             this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
             this.ctx.fillStyle = 'grey';
             this.ctx.font = '14px monospace';
             this.ctx.textAlign = 'center';
             this.ctx.fillText("No Vehicle Data", this.canvas.width / 2, this.canvas.height / 2);
             return;
         }

        // Re-check canvas size fits grid, resize if necessary
        this.resizeCanvasToFitGrid();

        const ctx = this.ctx;
        const gridWidth = this.vehicle.gridWidth;
        const gridHeight = this.vehicle.gridHeight;
        const cellPixelSize = this.cellPixelSize;
        const gridPixelWidth = gridWidth * cellPixelSize;
        const gridPixelHeight = gridHeight * cellPixelSize;

        // --- Clear Background ---
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // Use canvas dimensions

        // --- Draw Grid Background ---
        // (Tiles will cover this later)
        ctx.fillStyle = this.colors.defaultTile;
        ctx.fillRect(this.gridOffsetX, this.gridOffsetY, gridPixelWidth, gridPixelHeight);

        // --- Draw Grid Tiles ---
        if (this.vehicle.gridTiles) {
             for (const cellKey in this.vehicle.gridTiles) {
                 const tileTypeId = this.vehicle.gridTiles[cellKey];
                 if (!tileTypeId) continue; // Skip null/empty tiles

                 const [xStr, yStr] = cellKey.split(',');
                 const x = parseInt(xStr, 10);
                 const y = parseInt(yStr, 10);

                 if (isNaN(x) || isNaN(y)) continue;

                 this.drawTile(x, y, tileTypeId);
             }
        }

        // --- Draw Grid Objects ---
        if (this.vehicle.gridObjects) {
            for (const cellKey in this.vehicle.gridObjects) {
                 const objectTypeId = this.vehicle.gridObjects[cellKey];
                 if (!objectTypeId) continue; // Skip null/empty objects

                 const [xStr, yStr] = cellKey.split(',');
                 const x = parseInt(xStr, 10);
                 const y = parseInt(yStr, 10);

                 if (isNaN(x) || isNaN(y)) continue;

                 this.drawObject(x, y, objectTypeId);
            }
        }

        // --- Draw Special Locations (Over Objects/Tiles) ---
        this.drawSpecialLocation(this.vehicle.doorLocation, this.colors.door, 'D');
        this.drawSpecialLocation(this.vehicle.pilotSeatLocation, this.colors.pilotSeat, 'P');

        // --- Draw Grid Lines ---
        ctx.strokeStyle = this.colors.gridLines;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= gridWidth; i++) { // Draw lines including borders
            const xPos = this.gridOffsetX + i * cellPixelSize;
            ctx.moveTo(xPos, this.gridOffsetY);
            ctx.lineTo(xPos, this.gridOffsetY + gridPixelHeight);
        }
        for (let j = 0; j <= gridHeight; j++) { // Draw lines including borders
            const yPos = this.gridOffsetY + j * cellPixelSize;
            ctx.moveTo(this.gridOffsetX, yPos);
            ctx.lineTo(this.gridOffsetX + gridPixelWidth, yPos);
        }
        ctx.stroke();

        // --- Draw Hover Highlight ---
        if (this.hoveredCell.x !== -1 && this.hoveredCell.y !== -1) {
            ctx.fillStyle = this.colors.hoverCell;
            ctx.fillRect(
                this.gridOffsetX + this.hoveredCell.x * cellPixelSize,
                this.gridOffsetY + this.hoveredCell.y * cellPixelSize,
                cellPixelSize,
                cellPixelSize
            );
        }

        // --- Draw Selection Highlight ---
        if (this.selectedCell.x !== -1 && this.selectedCell.y !== -1) {
            ctx.fillStyle = this.colors.selectedCell;
            ctx.fillRect(
                this.gridOffsetX + this.selectedCell.x * cellPixelSize,
                this.gridOffsetY + this.selectedCell.y * cellPixelSize,
                cellPixelSize,
                cellPixelSize
            );
             ctx.strokeStyle = this.colors.gridBorder;
             ctx.lineWidth = 1;
             ctx.strokeRect(
                 this.gridOffsetX + this.selectedCell.x * cellPixelSize,
                 this.gridOffsetY + this.selectedCell.y * cellPixelSize,
                 cellPixelSize,
                 cellPixelSize
             );
        }
    }

    drawTile(x, y, tileTypeId) {
         const ctx = this.ctx;
         const cellPixelSize = this.cellPixelSize;
         const screenX = this.gridOffsetX + x * cellPixelSize;
         const screenY = this.gridOffsetY + y * cellPixelSize;

         // TODO: Look up tile config (color, sprite, etc.)
         const tileColor = this.colors.defaultTile; // Placeholder

         ctx.fillStyle = tileColor;
         ctx.fillRect(screenX, screenY, cellPixelSize, cellPixelSize);
         // Later: Draw tile sprite
    }

    drawObject(x, y, objectTypeId) {
         const ctx = this.ctx;
         const cellPixelSize = this.cellPixelSize;
         const screenX = this.gridOffsetX + x * cellPixelSize;
         const screenY = this.gridOffsetY + y * cellPixelSize;

         const objectConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectTypeId);
         const objectColor = objectConfig?.color || this.colors.defaultObject;
         const objectIcon = objectConfig?.icon || '?';

         // Simple colored square for now
         ctx.fillStyle = objectColor;
         ctx.fillRect(screenX + 2, screenY + 2, cellPixelSize - 4, cellPixelSize - 4); // Inset slightly

         // Draw Icon/Symbol
         ctx.fillStyle = this.colors.text;
         ctx.font = `bold ${cellPixelSize * 0.6}px monospace`;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText(objectIcon, screenX + cellPixelSize / 2, screenY + cellPixelSize / 2 + 1); // Adjust baseline slightly

         // Later: Draw object sprite if available
    }

    drawSpecialLocation(location, color, label) {
        if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') return;

        const locX = this.gridOffsetX + location.x * this.cellPixelSize;
        const locY = this.gridOffsetY + location.y * this.cellPixelSize;

        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = 0.6; // Make it semi-transparent
        this.ctx.fillRect(locX, locY, this.cellPixelSize, this.cellPixelSize);
        this.ctx.globalAlpha = 1.0;

        // Draw border and label
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(locX, locY, this.cellPixelSize, this.cellPixelSize);

        this.ctx.fillStyle = '#000'; // Contrasting label color
        this.ctx.font = `bold ${Math.max(8, this.cellPixelSize * 0.4)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, locX + this.cellPixelSize / 2, locY + this.cellPixelSize / 2);
        this.ctx.textBaseline = 'alphabetic'; // Reset baseline
    }

    // Methods to be called by VehicleBuildingManager or BaseBuildingUI
    show() {
        if (this.canvas) this.canvas.style.display = 'block';
    }

    hide() {
        if (this.canvas) this.canvas.style.display = 'none';
    }
}