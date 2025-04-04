/**
 * Manages the Base Building UI panel.
 * Handles displaying vehicle interior grid for editing and tool selection.
 */
import VehicleBuildingRenderer from '../rendering/VehicleBuildingRenderer.js';
import VehicleBuildingManager from '../entities/VehicleBuildingManager.js';

export default class BaseBuildingUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.activeVehicle = null;
        this.selectedModule = null; // Keep for potential future use, but grid is primary now

        // Obtain the main container element for the UI
        this.container = document.getElementById('building-ui');

        if (!this.container) {
            console.error("Building UI container '#building-ui' not found!");
            this.container = this.createBuildingContainer();
            document.getElementById('ui-overlay')?.appendChild(this.container);
        } else {
            if (!this.container.innerHTML.trim()) {
                this.injectContainerHTML(this.container);
            }
        }

        // Cache element references - **crucially, query within this.container**
        this.cacheElements();

        // --- NEW: Instantiate Building Systems ---
        // Use the specific canvas ID created in injectContainerHTML
        this.buildingRenderer = new VehicleBuildingRenderer(this.game, 'vehicle-building-canvas');
        this.buildingManager = new VehicleBuildingManager(this.game, this.game.ui); // Pass game and UIManager

        // Add event listeners using cached elements
        this.setupEventListeners();
    }

    // New method to cache frequently accessed elements within the container
    cacheElements() {
        if (!this.container) return;
        this.elements = {
            closeButton: this.container.querySelector('#building-close'),
            // Remove vehicle stat elements as they are replaced by grid
            // vehicleType: this.container.querySelector('#vehicle-type'),
            // vehicleHealth: this.container.querySelector('#vehicle-health'),
            // vehicleSpeed: this.container.querySelector('#vehicle-speed'),
            // vehicleStorage: this.container.querySelector('#vehicle-storage'),

            // Remove module elements as they are replaced by grid tools
            // modulesList: this.container.querySelector('#modules-list'),
            // moduleDetails: this.container.querySelector('#module-details'),
            // installButton: this.container.querySelector('#btn-install-module'),
            // removeButton: this.container.querySelector('#btn-remove-module'),

            // Keep enter button for now, might move later
            enterButton: this.container.querySelector('#btn-enter-vehicle'),

            // Reference the building canvas container
            buildingCanvasContainer: this.container.querySelector('#vehicle-building-canvas-container'),
            buildingCanvas: this.container.querySelector('#vehicle-building-canvas'), // Renderer manages this canvas element directly

            // Tool Buttons
            toolSelectButton: this.container.querySelector('#tool-select'),
            toolPlaceTileButton: this.container.querySelector('#tool-place-tile'),
            toolPlaceObjectButton: this.container.querySelector('#tool-place-object'),
            toolRemoveButton: this.container.querySelector('#tool-remove'),

            // Tool Info/Selection Area
            toolInfoArea: this.container.querySelector('#tool-info-area')
        };

        // Check if any essential elements are missing after caching
        for (const key in this.elements) {
            // Allow buildingCanvas to be initially null as Renderer creates it
            if (!this.elements[key] && key !== 'buildingCanvas') {
                console.warn(`[BaseBuildingUI] Element cache failed for: ${key}`);
            }
        }
    }

    // Reusable function to generate/inject the HTML structure for Grid Building
    injectContainerHTML(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="building-header">
                <h2>Vehicle Interior Edit</h2>
                 <div class="tool-buttons">
                     <button id="tool-select" class="tool-button active" title="Select Tool"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12.9999 15.6641L18.3638 10.3001L19.778 11.7143L14.4141 17.0783L12.9999 15.6641ZM11 19.9999L4 12.9999L11.7144 5.285L18.7139 12.2856L11 19.9999Z"></path></svg></button>
                     <button id="tool-place-tile" class="tool-button" title="Place Tile"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M22 13H20V11H22V13ZM22 17H20V15H22V17ZM22 9H20V7H22V9ZM22 21H2V3H18V7H16V5H4V19H18V17H16V21H22ZM14 21V19H12V21H14ZM10 21V19H8V21H10ZM6 21V19H4V21H6ZM18 13H16V11H18V13ZM18 17H16V15H18V17ZM18 9H16V7H18V9Z"></path></svg></button>
                     <button id="tool-place-object" class="tool-button" title="Place Object"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 18H19V16H21V18ZM21 14H19V12H21V14ZM21 10H19V8H21V10ZM21 6H19V4H21V6ZM7 18H5V16H7V18ZM7 14H5V12H7V14ZM7 10H5V8H7V10ZM7 6H5V4H7V6ZM17 18H9V4H17V18Z"></path></svg></button>
                     <button id="tool-remove" class="tool-button" title="Remove Tool"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM9 4V6H15V4H9ZM18 8H6V20H18V8ZM9 10V18H11V10H9ZM13 10V18H15V10H13Z"></path></svg></button>
                 </div>
                <button class="close-button" id="building-close">×</button>
            </div>
            <div class="building-content-grid">
                 <div id="tool-info-area">
                     <p>Select a tool.</p>
                     <!-- Add tile/object selection here later -->
                 </div>
                 <div id="vehicle-building-canvas-container">
                    <canvas id="vehicle-building-canvas" width="300" height="200"></canvas>
                    <!-- Renderer will control this canvas -->
                 </div>
            </div>
            <div class="building-footer">
                <div class="footer-info">
                    <!-- Placeholder for stats or info -->
                    <span>Vehicle: <span id="footer-vehicle-name">None</span></span>
                </div>
                <div class="action-buttons">
                    <!-- Removed module install/remove -->
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
        if (this.elements.closeButton) {
            this.elements.closeButton.addEventListener('click', () => this.hide());
        }
        if (this.elements.enterButton) {
            this.elements.enterButton.addEventListener('click', () => this.enterVehicle());
        }

        // Tool Button Listeners
        if (this.elements.toolSelectButton) {
            this.elements.toolSelectButton.addEventListener('click', () => this.setActiveTool('select'));
        }
        if (this.elements.toolPlaceTileButton) {
            this.elements.toolPlaceTileButton.addEventListener('click', () => this.setActiveTool('place_tile'));
        }
        if (this.elements.toolPlaceObjectButton) {
            this.elements.toolPlaceObjectButton.addEventListener('click', () => this.setActiveTool('place_object'));
        }
        if (this.elements.toolRemoveButton) {
            this.elements.toolRemoveButton.addEventListener('click', () => this.setActiveTool('remove'));
        }

        // Key listener for 'B' remains global (likely in UIManager now)
        document.addEventListener('keydown', (e) => {
            // Let UIManager handle B key toggle
            // if (e.code === 'KeyB' && !this.game.ui?.isMajorUIActive()) {
            //     this.toggle();
            // }
            if (e.code === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

     setActiveTool(toolName) {
         if (!this.buildingManager) return;
         this.buildingManager.setSelectedTool(toolName);

         // Update button active states
         this.container.querySelectorAll('.tool-button').forEach(btn => {
             btn.classList.remove('active');
         });
         const buttonElement = this.elements[`tool${toolName.charAt(0).toUpperCase() + toolName.slice(1)}Button`];
         if (buttonElement) {
             buttonElement.classList.add('active');
         }

         // Update tool info area (basic for now)
         if (this.elements.toolInfoArea) {
             let infoText = `Active Tool: ${toolName}`;
             if (toolName === 'place_tile') infoText += ` (Type: ${this.buildingManager.selectedTileType})`;
             if (toolName === 'place_object') infoText += ` (Type: ${this.buildingManager.selectedObjectType})`;
             this.elements.toolInfoArea.innerHTML = `<p>${infoText}</p>`;
         }
     }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            // Only show if near a vehicle
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

        // Ensure elements are cached before updating
        if (!this.elements?.buildingCanvasContainer) this.cacheElements();

        // Set up building systems
        this.buildingRenderer.setVehicle(this.activeVehicle);
        this.buildingManager.setActiveVehicle(this.activeVehicle);

        // Set default tool
        this.setActiveTool('select');

        // Set player state
        if (this.game.player && this.game.player.playerState !== 'Building') {
            this.game.player.playerState = 'Building';
            this.game.player.currentVehicleId = this.activeVehicle.id; // Store context
            this.game.player._stateChanged = true;
             // Force network update
             this.game.network.updatePresence(this.game.player.getNetworkState());
             this.game.player.clearStateChanged();
        }

        // Update footer info
        const footerName = this.container.querySelector('#footer-vehicle-name');
        if(footerName) footerName.textContent = this.activeVehicle.name;

        this.update(); // Initial update
    }

    hide() {
        if (!this.isVisible) return;

        this.container.classList.add('hidden');
        this.isVisible = false;

        // Reset building systems
        this.buildingRenderer.setVehicle(null); // Clear renderer
        this.buildingManager.setActiveVehicle(null);
        this.activeVehicle = null;

        // Reset player state IF they were in Building mode
        if (this.game.player && this.game.player.playerState === 'Building') {
            this.game.player.playerState = 'Overworld'; // Return to overworld
            this.game.player.currentVehicleId = null;
            this.game.player._stateChanged = true;
             // Force network update
             this.game.network.updatePresence(this.game.player.getNetworkState());
             this.game.player.clearStateChanged();
        }
    }

    findNearbyVehicle() {
        // Keep existing findNearbyVehicle logic
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
            // If UI is open but vehicle somehow disappears, hide the UI
            if (this.isVisible) {
                 this.game.debug.warn("[BaseBuildingUI] Update called but activeVehicle lost. Hiding UI.");
                 this.hide();
            }
            return;
        }

        // Ensure we are using the latest vehicle instance from entity manager
        const vehicleEntity = this.game.entities.get(this.activeVehicle.id);
        if (!vehicleEntity) {
            this.game.debug.warn(`[BaseBuildingUI] Active vehicle (ID: ${this.activeVehicle.id}) not found in EntityManager during update. Closing UI.`);
            this.hide();
            return;
        }
        // Only update if the entity reference actually changed
        if (this.activeVehicle !== vehicleEntity) {
            this.activeVehicle = vehicleEntity;
             this.buildingRenderer.setVehicle(this.activeVehicle); // Update renderer's vehicle ref
             this.buildingManager.setActiveVehicle(this.activeVehicle); // Update manager's vehicle ref
        }


        // Render the building grid - this now happens continuously
        this.buildingRenderer.render();

        // Update footer info (in case name changes etc.)
        const footerName = this.container.querySelector('#footer-vehicle-name');
        if(footerName && footerName.textContent !== this.activeVehicle.name) {
             footerName.textContent = this.activeVehicle.name;
        }

        // Update button states if needed (Enter vehicle button)
        if (this.elements.enterButton) {
            this.elements.enterButton.disabled = !(this.activeVehicle && this.activeVehicle.driver !== this.game.player?.id);
        }

        // Call Building Manager update (currently does nothing, but good practice)
        this.buildingManager.update(this.game.deltaTime);
    }

    enterVehicle() {
         // This action should transition the player state to 'Interior'
        if (!this.activeVehicle || !this.game.player) return;

        this.game.debug.log(`[BaseBuildingUI] Enter vehicle button clicked. Transitioning player state.`);

         // Transition logic is now handled by Game's handleInputInteractions ('E' key)
         // We can trigger a similar transition here if needed, or just close the UI
         // For now, just close the UI. User can press 'E' immediately after.
         // Alternatively, we could simulate the 'E' key press action:
         // this.game.handleInputInteractions(performance.now()); // Risky if interaction cooldown is active

         // Safest approach: Just close the building UI.
         this.hide();
         this.game.ui.showNotification("Press 'E' to enter the vehicle.", "info");
    }

    // Keep helper methods (canCraftModule, getResourceConfig) if module system is reintegrated later
    canCraftModule(module) {
        // ... (logic remains the same) ...
         if (!module || !this.game.player) return false;
        if (!module.cost) return true;
        for (const [resource, amount] of Object.entries(module.cost)) {
            const playerAmount = this.game.player.resources[resource] || 0;
            if (playerAmount < amount) return false;
        }
        return true;
    }

    getResourceConfig(resourceType) {
        // ... (logic remains the same) ...
        return this.game.config?.RESOURCE_TYPES?.find(r => r.id === resourceType) || null;
    }
}