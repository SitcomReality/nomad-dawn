/**
 * Manages the Base Building UI panel.
 */
export default class BaseBuildingUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.activeVehicle = null; // Vehicle currently being modified
        this.selectedModule = null; // Keep for potential module interaction later?

        // Obtain the main container element for the UI
        this.container = document.getElementById('building-ui');

        if (!this.container) {
            console.error("Building UI container '#building-ui' not found!");
            // Attempt to create it if missing (basic fallback)
            this.container = this.createBuildingContainer();
            document.getElementById('ui-overlay')?.appendChild(this.container);
        } else {
            // Ensure the container has the base structure if it exists but is empty
            if (!this.container.innerHTML.trim()) {
                this.injectContainerHTML(this.container);
            }
        }

        // Cache element references - **crucially, query within this.container**
        this.cacheElements();

        // Add event listeners using cached elements
        this.setupEventListeners();
    }

    // New method to cache frequently accessed elements within the container
    cacheElements() {
        if (!this.container) return;
        this.elements = {
            closeButton: this.container.querySelector('#building-close'),
            buildingHeader: this.container.querySelector('.building-header h2'), // To update title
            gridEditorContainer: this.container.querySelector('#grid-editor-container'), // Area for grid
            toolPanel: this.container.querySelector('#building-tool-panel'), // Area for tools
        };

        // Check if any essential elements are missing after caching
        for (const key in this.elements) {
            if (!this.elements[key]) {
                console.warn(`[BaseBuildingUI] Element cache failed for: ${key}`);
            }
        }
    }

    // Reusable function to generate/inject the HTML structure
    injectContainerHTML(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="building-header">
                <h2>Vehicle Construction</h2>
                <button class="close-button" id="building-close">×</button>
            </div>
            <!-- Content will be replaced with grid editor and tool panel in Step 9 -->
            <div class="building-content" id="building-main-content">
                 <!-- Placeholder for Step 8 -->
                 <div id="grid-editor-container" style="flex-grow: 1; background: #334; padding: 10px; text-align: center;">Grid Editor Area (Step 9)</div>
                 <div id="building-tool-panel" style="width: 200px; background: #223; padding: 10px;">Tool Panel (Step 9+)</div>
            </div>
            <div class="building-footer">
                 <!-- Footer might be simplified or removed for grid editor -->
                 <div class="status-bar">Status: Building Mode</div>
                 <button id="btn-exit-building">Exit Building</button> <!-- Optional exit button -->
            </div>
        `;
        // Re-cache elements after injecting HTML
        this.cacheElements();
    }

    createBuildingContainer() {
        // Check if it already exists (e.g., from HTML)
        let container = document.getElementById('building-ui');
        if (container) {
            // If it exists but is empty, populate it
            if (!container.innerHTML.trim()) {
                this.injectContainerHTML(container);
            }
            return container;
        }

        // If it doesn't exist at all, create it
        container = document.createElement('div');
        container.id = 'building-ui';
        container.className = 'game-ui hidden';
        this.injectContainerHTML(container); // Inject the standard HTML structure

        // Append to the overlay is handled in the constructor now
        // document.getElementById('ui-overlay')?.appendChild(container);

        return container;
    }

    setupEventListeners() {
        // Use cached elements
        if (this.elements.closeButton) {
            this.elements.closeButton.addEventListener('click', () => {
                this.hide();
                // Also need to ensure player exits building state
                if (this.game.playerController && this.game.player?.playerState === 'Building') {
                    this.game.playerController.exitBuildingMode();
                }
            });
        }

        // Optional Exit button listener
        const exitButton = this.container.querySelector('#btn-exit-building');
        if (exitButton) {
            exitButton.addEventListener('click', () => {
                this.hide();
                if (this.game.playerController && this.game.player?.playerState === 'Building') {
                    this.game.playerController.exitBuildingMode();
                }
            });
        }

        // Key listener ('B') is now handled in PlayerController
        // Keep Escape listener for closing the panel
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.isVisible) {
                this.hide();
                // Ensure player exits building state when Esc is pressed
                if (this.game.playerController && this.game.player?.playerState === 'Building') {
                    this.game.playerController.exitBuildingMode();
                }
            }
        });
    }

    toggle() {
        // This might be deprecated if PlayerController handles state transitions directly
        // If kept, it needs to coordinate with PlayerController
        // For now, let PlayerController call show/hide directly
        console.warn("BaseBuildingUI.toggle() called - Use PlayerController to manage state and call show/hide.");
    }

    // Modified show to accept vehicle context
    show(vehicle) {
        if (!this.isVisible && vehicle) {
            // Ensure player is actually in Building state before showing
            if (this.game.player?.playerState !== 'Building') {
                this.game.debug.warn("Attempted to show BaseBuildingUI but player not in 'Building' state.");
                return;
            }

            this.activeVehicle = vehicle; // Set the active vehicle context
            this.container.classList.remove('hidden');
            this.isVisible = true;
            this.game.ui.activeUI = this; // Mark as active UI

            // Ensure elements are cached before updating title
            if (!this.elements) this.cacheElements();
            if (this.elements.buildingHeader) {
                this.elements.buildingHeader.textContent = `Modify: ${this.activeVehicle.name || 'Vehicle'}`;
            }

            this.update(); // Initial update for the new view (will draw grid in Step 9)
        } else if (!vehicle) {
            this.game.debug.error("BaseBuildingUI.show() called without a vehicle reference.");
        }
    }

    hide() {
        if (this.isVisible) {
            this.container.classList.add('hidden');
            this.isVisible = false;
            this.activeVehicle = null; // Clear active vehicle
            if (this.game.ui.activeUI === this) {
                this.game.ui.activeUI = null;
            }
            // Important: Hiding the UI should trigger the PlayerController to exit Building state
            // This is handled in PlayerController.exitBuildingMode() which calls this hide()
            // or via the close/Esc listeners which also call exitBuildingMode()
        }
    }

    update() {
        if (!this.isVisible || !this.activeVehicle) return;

        // Ensure we are using the latest vehicle instance from entity manager
        const vehicleEntity = this.game.entities.get(this.activeVehicle.id);
        if (!vehicleEntity) {
            this.game.debug.warn(`[BaseBuildingUI] Active vehicle (ID: ${this.activeVehicle.id}) not found in EntityManager during update. Closing UI.`);
            this.hide();
            // Ensure state is exited if vehicle disappears
            if (this.game.playerController && this.game.player?.playerState === 'Building') {
                this.game.playerController.exitBuildingMode();
            }
            return;
        }
        this.activeVehicle = vehicleEntity;

        // --- TODO (Step 9+) ---
        // Re-render the grid editor based on this.activeVehicle.gridTiles/gridObjects
        // Update tool panel state
        // Update any relevant status displays in the footer
        // Example:
        // if (this.gridEditorRenderer) {
        //     this.gridEditorRenderer.render(this.activeVehicle);
        // }
    }

    getResourceConfig(resourceType) {
        // --- KEEP - Might be useful for checking costs of grid tiles/objects ---
        return this.game.config?.RESOURCE_TYPES?.find(r => r.id === resourceType) || null;
    }

    canCraftModule(module) {
        // --- REMOVED/MODIFY - Will need similar logic for placing grid tiles/objects ---
        return false; // Placeholder
    }
}