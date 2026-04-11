/**
 * Manages the Base Building UI panel.
 * Handles displaying vehicle interior grid for editing and tool selection.
 */
import VehicleBuildingRenderer from '../rendering/VehicleBuildingRenderer.js';
import VehicleBuildingManager from '../entities/VehicleBuildingManager.js';
import BuildingToolPanel from './BuildingToolPanel.js'; // Import the new panel

export default class BaseBuildingUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.activeVehicle = null;

        // Obtain the main container element for the UI
        this.container = document.getElementById('building-ui');

        if (!this.container) {
            console.error("Building UI container '#building-ui' not found!");
            this.container = this.createBuildingContainer();
            document.getElementById('ui-overlay')?.appendChild(this.container);
        } else {
            // Ensure HTML is injected if container exists but is empty
            if (!this.container.innerHTML.trim()) {
                this.injectContainerHTML(this.container);
            }
        }

        // Cache core element references (less specific now)
        this.elements = {
            closeButton: this.container.querySelector('#building-close'),
            enterButton: this.container.querySelector('#btn-enter-vehicle'),
            footerVehicleName: this.container.querySelector('#footer-vehicle-name'),
            toolInfoArea: this.container.querySelector('#tool-info-area'), // ToolPanel needs this
            buildingCanvasContainer: this.container.querySelector('#vehicle-building-canvas-container'),
        };

        // --- Instantiate Building Systems ---
        this.buildingRenderer = new VehicleBuildingRenderer(this.game, 'vehicle-building-canvas');
        this.buildingManager = new VehicleBuildingManager(this.game, this.game.ui);

        // --- Instantiate the new Tool Panel ---
        this.toolPanel = new BuildingToolPanel(
            this.game,
            this.buildingManager,
            this.elements.toolInfoArea // Pass the container for the tool panel
        );

        this.setupEventListeners();
    }

    // Keep the HTML injection logic
    injectContainerHTML(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="building-header">
                <h2>Vehicle Interior Edit</h2>
                 <div id="tool-buttons" class="tool-buttons"> <!-- Moved ID here for ToolPanel -->
                     <button id="tool-select" class="tool-button active" title="Select Tool"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.9999 15.6641L18.3638 10.3001L19.778 11.7143L14.4141 17.0783L12.9999 15.6641ZM11 19.9999L4 12.9999L11.7144 5.285L18.7139 12.2856L11 19.9999Z"></path></svg></button>
                     <button id="tool-place-tile" class="tool-button" title="Place Tile"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M22 13H20V11H22V13ZM22 17H20V15H22V17ZM22 9H20V7H22V9ZM22 21H2V3H18V7H16V5H4V19H18V17H16V21H22ZM14 21V19H12V21H14ZM10 21V19H8V21H10ZM6 21V19H4V21H6ZM18 13H16V11H18V13ZM18 17H16V15H18V17ZM18 9H16V7H18V9Z"></path></svg></button>
                     <button id="tool-place-object" class="tool-button" title="Place Object"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 18H19V16H21V18ZM21 14H19V12H21V14ZM21 10H19V8H21V10ZM21 6H19V4H21V6ZM7 18H5V16H7V18ZM7 14H5V12H7V14ZM7 10H5V8H7V10ZM7 6H5V4H7V6ZM17 18H9V4H17V18Z"></path></svg></button>
                     <button id="tool-remove" class="tool-button" title="Remove Tool"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM9 4V6H15V4H9ZM18 8H6V20H18V8ZM9 10V18H11V10H9ZM13 10V18H15V10H13Z"></path></svg></button>
                 </div>
                <button class="close-button" id="building-close">×</button>
            </div>
            <div class="building-content-grid">
                 <div id="tool-info-area">
                     <!-- Tool Panel will populate this -->
                 </div>
                 <div id="vehicle-building-canvas-container">
                    <canvas id="vehicle-building-canvas" width="300" height="200"></canvas>
                 </div>
            </div>
            <div class="building-footer">
                <div class="footer-info">
                    <span>Vehicle: <span id="footer-vehicle-name">None</span></span>
                </div>
                <div class="action-buttons">
                    <button id="btn-enter-vehicle">Enter Vehicle</button>
                </div>
            </div>
        `;
    }

     createBuildingContainer() {
        let container = document.getElementById('building-ui');
        if (container) {
            if (!container.innerHTML.trim()) {
                this.injectContainerHTML(container);
            }
            return container;
        }
        container = document.createElement('div');
        container.id = 'building-ui';
        container.className = 'game-ui hidden';
        this.injectContainerHTML(container);
        return container;
    }


    setupEventListeners() {
        // Main UI listeners
        if (this.elements.closeButton) {
            this.elements.closeButton.addEventListener('click', () => this.hide());
        }
        if (this.elements.enterButton) {
            this.elements.enterButton.addEventListener('click', () => this.enterVehicle());
        }

        // Tool panel handles its own internal listeners now

        // Global key listeners remain (handled by UIManager)
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            const nearbyVehicle = this.findNearbyVehicle();
            if (nearbyVehicle) {
                this.show(nearbyVehicle);
            } else {
                 this.game.ui.showNotification("No vehicle nearby to modify", "warn");
            }
        }
    }

    show(vehicle) {
        if (this.isVisible || !vehicle) return;

        this.activeVehicle = vehicle;
        this.container.classList.remove('hidden');
        this.isVisible = true;

        // Set up building systems
        this.buildingRenderer.setVehicle(this.activeVehicle);
        this.buildingManager.setActiveVehicle(this.activeVehicle);
        this.toolPanel.setActiveVehicle(this.activeVehicle); // Inform tool panel

        // Set default tool via ToolPanel
        this.toolPanel.setActiveTool('select');

        // Set player state
        if (this.game.player && this.game.player.playerState !== 'Building') {
            this.game.player.playerState = 'Building';
            this.game.player.currentVehicleId = this.activeVehicle.id;
            this.game.player._stateChanged = true;
        }

        // Update footer info
        if(this.elements.footerVehicleName) this.elements.footerVehicleName.textContent = this.activeVehicle.name;

        this.update(); // Initial update
    }

    hide() {
        if (!this.isVisible) return;

        this.container.classList.add('hidden');
        this.isVisible = false;

        // Reset building systems
        this.buildingRenderer.setVehicle(null);
        this.buildingManager.setActiveVehicle(null);
        this.toolPanel.setActiveVehicle(null); // Clear tool panel vehicle context
        this.activeVehicle = null;

        // Reset player state IF they were in Building mode
        if (this.game.player && this.game.player.playerState === 'Building') {
            this.game.player.playerState = 'Overworld';
            this.game.player.currentVehicleId = null;
            this.game.player._stateChanged = true;
        }
    }

    findNearbyVehicle() {
        if (!this.game.player) return null;
        const vehicles = this.game.entities.getByType('vehicle');
        const interactionDistance = 100;
        let closestVehicle = null;
        let closestDistanceSq = interactionDistance * interactionDistance;
        for (const vehicle of vehicles) {
            if (!vehicle) continue;
            const dx = vehicle.x - this.game.player.x;
            const dy = vehicle.y - this.game.player.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestVehicle = vehicle;
            }
        }
        return closestVehicle;
    }

    update() {
        if (!this.isVisible || !this.activeVehicle) {
            if (this.isVisible) {
                 this.game.debug.warn("[BaseBuildingUI] Update called but activeVehicle lost. Hiding UI.");
                 this.hide();
            }
            return;
        }

        // Ensure we are using the latest vehicle instance
        const vehicleEntity = this.game.entities.get(this.activeVehicle.id);
        if (!vehicleEntity) {
            this.game.debug.warn(`[BaseBuildingUI] Active vehicle (ID: ${this.activeVehicle.id}) not found in EntityManager during update. Closing UI.`);
            this.hide();
            return;
        }
        if (this.activeVehicle !== vehicleEntity) {
            this.activeVehicle = vehicleEntity;
             this.buildingRenderer.setVehicle(this.activeVehicle);
             this.buildingManager.setActiveVehicle(this.activeVehicle);
             this.toolPanel.setActiveVehicle(this.activeVehicle); // Update tool panel too
        }

        // Render the building grid
        this.buildingRenderer.render();

        // Update footer info
        if(this.elements.footerVehicleName && this.elements.footerVehicleName.textContent !== this.activeVehicle.name) {
             this.elements.footerVehicleName.textContent = this.activeVehicle.name;
        }

        // Update button states
        if (this.elements.enterButton) {
            this.elements.enterButton.disabled = !(this.activeVehicle && this.activeVehicle.driver !== this.game.player?.id);
        }

        // --- Update Tool Panel ---
        // This replaces updateObjectButtonStates()
        this.toolPanel.update();

        // Call Building Manager update
        this.buildingManager.update(this.game.deltaTime);
    }

    enterVehicle() {
        if (!this.activeVehicle || !this.game.player) return;
        this.game.debug.log(`[BaseBuildingUI] Enter vehicle button clicked.`);
        this.hide();
        this.game.ui.showNotification("Press 'E' to enter the vehicle.", "info");
    }
}