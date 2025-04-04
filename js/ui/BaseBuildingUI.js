/**
 * Manages the Base Building UI panel.
 */
export default class BaseBuildingUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.activeVehicle = null;
        this.selectedModule = null;

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
            vehicleType: this.container.querySelector('#vehicle-type'),
            vehicleHealth: this.container.querySelector('#vehicle-health'),
            vehicleSpeed: this.container.querySelector('#vehicle-speed'),
            vehicleStorage: this.container.querySelector('#vehicle-storage'),
            modulesList: this.container.querySelector('#modules-list'),
            moduleDetails: this.container.querySelector('#module-details'),
            installButton: this.container.querySelector('#btn-install-module'),
            removeButton: this.container.querySelector('#btn-remove-module'),
            enterButton: this.container.querySelector('#btn-enter-vehicle'),
            previewCanvas: this.container.querySelector('#vehicle-preview-canvas')
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
            <div class="building-content">
                <div class="vehicle-preview">
                    <canvas id="vehicle-preview-canvas" width="300" height="200"></canvas>
                    <div class="vehicle-stats">
                        <div class="stat-item">
                            <span class="stat-label">Vehicle Type:</span>
                            <span class="stat-value" id="vehicle-type">None</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Health:</span>
                            <span class="stat-value" id="vehicle-health">0/0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Speed:</span>
                            <span class="stat-value" id="vehicle-speed">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Storage:</span>
                            <span class="stat-value" id="vehicle-storage">0</span>
                        </div>
                    </div>
                </div>
                <div class="module-selection">
                    <h3>Add Modules</h3>
                    <div class="modules-list" id="modules-list">
                        <div class="empty-message">No modules available</div>
                    </div>
                </div>
            </div>
            <div class="building-footer">
                <div class="module-details" id="module-details">
                    <h3>Select a module</h3>
                    <p>Module details will appear here</p>
                </div>
                <div class="action-buttons">
                    <button id="btn-install-module" disabled>Install</button>
                    <button id="btn-remove-module" disabled>Remove</button>
                    <button id="btn-enter-vehicle">Enter Vehicle</button>
                </div>
            </div>
        `;
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
            });
        }

        if (this.elements.installButton) {
            this.elements.installButton.addEventListener('click', () => {
                if (this.selectedModule && this.activeVehicle) {
                    this.installModule();
                }
            });
        }

        if (this.elements.removeButton) {
            this.elements.removeButton.addEventListener('click', () => {
                if (this.selectedModule && this.activeVehicle) {
                    this.removeModule();
                }
            });
        }

        if (this.elements.enterButton) {
            this.elements.enterButton.addEventListener('click', () => {
                if (this.activeVehicle) {
                    this.enterVehicle();
                }
            });
        }

        // Key listener remains global
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyB') {
                this.toggle();
            }
            if (e.code === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (!this.isVisible) {
            const nearbyVehicle = this.findNearbyVehicle();
            if (!nearbyVehicle) {
                this.game.ui.showNotification("No vehicle nearby", "warn");
                return;
            }

            this.activeVehicle = nearbyVehicle;
            this.container.classList.remove('hidden');
            this.isVisible = true;
            // Ensure elements are cached before updating
            if (!this.elements) this.cacheElements();
            this.update();
            this.initVehiclePreview();
        }
    }

    hide() {
        if (this.isVisible) {
            this.container.classList.add('hidden');
            this.isVisible = false;
            this.activeVehicle = null;
        }
    }

    findNearbyVehicle() {
        if (!this.game.player) return null;

        const vehicles = this.game.entities.getByType('vehicle');
        const interactionDistance = 100;
        this.game.debug.log(`Finding nearby vehicles. Total vehicles in EntityManager: ${vehicles.length}`);

        let closestVehicle = null;
        let closestDistanceSq = interactionDistance * interactionDistance;

        for (const vehicle of vehicles) {
            const dx = vehicle.x - this.game.player.x;
            const dy = vehicle.y - this.game.player.y;
            const distanceSq = dx * dx + dy * dy;

            this.game.debug.log(`  Vehicle ${vehicle.id} at (${vehicle.x.toFixed(0)}, ${vehicle.y.toFixed(0)}), distance: ${Math.sqrt(distanceSq).toFixed(1)}`);

            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestVehicle = vehicle;
            }
        }

        if (closestVehicle) {
            this.game.debug.log(`Closest vehicle found: ${closestVehicle.id} at distance ${Math.sqrt(closestDistanceSq).toFixed(1)}`);
        } else {
            this.game.debug.log(`No vehicle found within interaction distance (${interactionDistance}).`);
        }

        return closestVehicle;
    }

    initVehiclePreview() {
        if (!this.activeVehicle || !this.elements.previewCanvas) return;

        const canvas = this.elements.previewCanvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width, canvas.height) / (this.activeVehicle.size * 4);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);

        // Draw vehicle body
        ctx.fillStyle = this.activeVehicle.color || '#fa5';
        ctx.beginPath();
        ctx.arc(0, 0, this.activeVehicle.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw direction indicator
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.activeVehicle.size / 2, 0);
        ctx.stroke();

        // Draw modules
        if (this.activeVehicle.modules && this.activeVehicle.modules.length > 0) {
            const numModules = this.activeVehicle.modules.length;
            this.activeVehicle.modules.forEach((module, index) => {
                const angle = (index / numModules) * Math.PI * 2;
                const distance = this.activeVehicle.size * 0.7;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const moduleSize = module.size || 5;

                ctx.fillStyle = module.color || '#5af';
                ctx.beginPath();
                ctx.arc(x, y, moduleSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // Draw module name label
                ctx.fillStyle = 'white';
                ctx.font = `${Math.max(3, 10 / scale)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(module.name, x, y + moduleSize * 0.8);
            });
        }
        ctx.restore();
    }

    updateVehicleStats() {
        if (!this.activeVehicle) {
            this.game.debug.warn("[BaseBuildingUI] updateVehicleStats called but activeVehicle is null.");
            return;
        }

        // Use cached elements
        if (this.elements.vehicleType) {
            this.elements.vehicleType.textContent = this.activeVehicle.name || this.activeVehicle.vehicleType || 'Unknown';
        } else {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.vehicleType not found.");
        }

        if (this.elements.vehicleHealth) {
            const currentHealth = typeof this.activeVehicle.health === 'number' ? Math.floor(this.activeVehicle.health) : '?';
            const maxHealth = typeof this.activeVehicle.maxHealth === 'number' ? this.activeVehicle.maxHealth : '?';
            this.elements.vehicleHealth.textContent = `${currentHealth}/${maxHealth}`;
        } else {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.vehicleHealth not found.");
        }

        if (this.elements.vehicleSpeed) {
            const maxSpeed = typeof this.activeVehicle.maxSpeed === 'number' ? this.activeVehicle.maxSpeed : '?';
            this.elements.vehicleSpeed.textContent = `${maxSpeed}`;
        } else {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.vehicleSpeed not found.");
        }

        if (this.elements.vehicleStorage) {
            const storage = typeof this.activeVehicle.storage === 'number' ? this.activeVehicle.storage : '?';
            this.elements.vehicleStorage.textContent = `${storage}`;
        } else {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.vehicleStorage not found.");
        }
    }

    updateModulesList() {
        if (!this.elements.modulesList) {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.modulesList not found.");
            return;
        }
        const modulesList = this.elements.modulesList;
        modulesList.innerHTML = ''; // Clear previous list

        const moduleTypes = this.game.config?.MODULE_TYPES || [];
        if (moduleTypes.length === 0) {
            this.game.debug.warn("[BaseBuildingUI] No MODULE_TYPES found in game config.");
        }

        let modulesAdded = false;
        moduleTypes.forEach(module => {
            const isInstalled = this.activeVehicle?.modules?.some(m => m.id === module.id);
            const canCraft = this.canCraftModule(module);

            const moduleItem = document.createElement('div');
            moduleItem.className = 'module-item';
            moduleItem.dataset.id = module.id;
            if (isInstalled) moduleItem.classList.add('installed');

            let statusText = isInstalled ? 'Installed' : (canCraft ? 'Can Install' : 'Missing Resources');
            let statusClass = isInstalled ? 'installed-status' : (canCraft ? 'can-craft' : 'cannot-craft');

            moduleItem.innerHTML = `
                <div class="module-icon" style="background-color: ${module.color || '#5af'}"></div>
                <div class="module-details">
                    <div class="module-name">${module.name}</div>
                    <div class="module-craft-status ${statusClass}">${statusText}</div>
                </div>
            `;

            moduleItem.addEventListener('click', () => {
                const latestModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === module.id);
                if (latestModuleConfig) {
                    this.selectModule(latestModuleConfig);
                    modulesList.querySelectorAll('.module-item').forEach(item => item.classList.remove('selected'));
                    moduleItem.classList.add('selected');
                } else {
                    this.game.debug.warn(`[BaseBuildingUI] Could not find config for selected module ID: ${module.id}`);
                    this.selectModule(null);
                }
            });

            modulesList.appendChild(moduleItem);
            modulesAdded = true;
        });

        if (!modulesAdded) {
            modulesList.innerHTML = '<div class="empty-message">No modules available</div>';
        }
    }

    selectModule(module) {
        this.selectedModule = module; // module can be null

        if (!this.elements.moduleDetails) {
            this.game.debug.warn("[BaseBuildingUI] Cached Element elements.moduleDetails not found.");
            return;
        }
        const moduleDetails = this.elements.moduleDetails;

        if (!module) {
            moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
            this.updateActionButtons();
            return;
        }

        let detailsHTML = `<h3>${module.name}</h3>`;
        if (module.description) detailsHTML += `<p>${module.description}</p>`;

        if (module.effect && Object.keys(module.effect).length > 0) {
            detailsHTML += `<p>Effects:</p><ul>`;
            for (const [stat, value] of Object.entries(module.effect)) {
                detailsHTML += `<li>+${value} ${stat}</li>`;
            }
            detailsHTML += `</ul>`;
        }

        if (module.cost && Object.keys(module.cost).length > 0) {
            detailsHTML += `<p>Required Resources:</p><ul>`;
            for (const [resource, amount] of Object.entries(module.cost)) {
                const resourceConfig = this.getResourceConfig(resource);
                const playerAmount = this.game.player?.resources[resource] || 0;
                const hasEnough = playerAmount >= amount;
                detailsHTML += `<li class="${hasEnough ? 'has-enough' : 'not-enough'}">
                    ${resourceConfig?.name || resource}: ${amount} (Have: ${playerAmount})
                </li>`;
            }
            detailsHTML += `</ul>`;
        } else {
            detailsHTML += `<p>Installation Cost: None</p>`;
        }

        moduleDetails.innerHTML = detailsHTML;
        this.updateActionButtons();
    }

    updateActionButtons() {
        const { installButton, removeButton, enterButton } = this.elements;

        if (!installButton || !removeButton || !enterButton) {
            this.game.debug.warn("[BaseBuildingUI] One or more cached action buttons not found.");
            return;
        }

        enterButton.disabled = !(this.activeVehicle && this.activeVehicle.driver !== this.game.player?.id);

        if (!this.selectedModule || !this.activeVehicle) {
            installButton.disabled = true;
            removeButton.disabled = true;
            return;
        }

        const isInstalled = this.activeVehicle.modules?.some(m => m.id === this.selectedModule.id);
        const canAfford = this.canCraftModule(this.selectedModule);

        installButton.disabled = !(!isInstalled && canAfford);
        removeButton.disabled = !isInstalled;
    }

    update() {
        if (!this.isVisible) return;

        if (!this.activeVehicle) {
            this.game.debug.warn("[BaseBuildingUI] Update called but activeVehicle is null.");
            this.hide();
            return;
        }

        // Ensure we are using the latest vehicle instance from entity manager
        const vehicleEntity = this.game.entities.get(this.activeVehicle.id);
        if (!vehicleEntity) {
            this.game.debug.warn(`[BaseBuildingUI] Active vehicle (ID: ${this.activeVehicle.id}) not found in EntityManager during update. Closing UI.`);
            this.hide();
            return;
        }
        this.activeVehicle = vehicleEntity;

        // Re-render preview, update stats, modules, details, buttons
        this.initVehiclePreview();
        this.updateVehicleStats();
        this.updateModulesList();

        // Re-select module to update resource cost display
        if (this.selectedModule) {
            const currentModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === this.selectedModule.id);
            this.selectModule(currentModuleConfig); // Handles null if config disappears
        } else {
            // Ensure details panel is cleared if no module selected
            if (this.elements.moduleDetails) {
                this.elements.moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
            }
        }

        this.updateActionButtons();
    }

    installModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.canCraftModule(this.selectedModule)) return;

        // Deduct resources
        if (this.selectedModule.cost) {
            for (const [resource, amount] of Object.entries(this.selectedModule.cost)) {
                this.game.player.resources[resource] -= amount;
            }
            this.game.network.updatePresence({ resources: this.game.player.resources });
        }

        // Create module instance
        const moduleInstance = {
            id: this.selectedModule.id,
            name: this.selectedModule.name,
            effect: { ...this.selectedModule.effect },
            color: this.selectedModule.color,
            size: this.selectedModule.size
        };

        // Update vehicle modules in network state
        const newModules = [...(this.activeVehicle.modules || []), moduleInstance];

        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: newModules,
                        // Send updated stats based on the new module set
                        // Note: Vehicle class recalculates stats based on modules upon network sync
                        // We don't need to explicitly send recalculated stats here,
                        // but ensure the module list is sent.
                    }
                }
            });
        }

        // Refresh UI based on anticipated state change
        // Find the updated module config again to display latest info
        const currentModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === this.selectedModule.id);
        this.selectModule(currentModuleConfig); // Reselect to update details/buttons
        this.update(); // Full UI refresh
    }

    removeModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.activeVehicle.modules) return;

        const moduleIndex = this.activeVehicle.modules.findIndex(m => m.id === this.selectedModule.id);
        if (moduleIndex === -1) return;

        const moduleToRemove = this.activeVehicle.modules[moduleIndex];
        const newModules = this.activeVehicle.modules.filter((_, index) => index !== moduleIndex);

        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: newModules,
                        // Send updated stats based on the new module set
                        // Similar to install, rely on Vehicle class recalculating on sync
                    }
                }
            });
        }

        // Refresh UI
        const currentModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === this.selectedModule.id);
        this.selectModule(currentModuleConfig); // Reselect to update details/buttons
        this.update(); // Full UI refresh
    }

    enterVehicle() {
        if (!this.activeVehicle || !this.game.player) return;
        if (this.game.player.enterVehicle(this.activeVehicle)) {
            this.hide();
        }
    }

    canCraftModule(module) {
        if (!module || !this.game.player) return false;
        if (!module.cost) return true;

        for (const [resource, amount] of Object.entries(module.cost)) {
            const playerAmount = this.game.player.resources[resource] || 0;
            if (playerAmount < amount) {
                return false;
            }
        }
        return true;
    }

    getResourceConfig(resourceType) {
        return this.game.config?.RESOURCE_TYPES?.find(r => r.id === resourceType) || null;
    }
}