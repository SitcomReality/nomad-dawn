export default class BaseBuildingUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.activeVehicle = null;
        this.selectedModule = null;
        
        // Create UI elements
        this.container = this.createBuildingContainer();
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    createBuildingContainer() {
        // Create container if not exists
        let container = document.getElementById('building-ui');
        if (!container) {
            container = document.createElement('div');
            container.id = 'building-ui';
            container.className = 'game-ui hidden';
            
            // Create base building interface structure
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
            
            document.getElementById('ui-overlay').appendChild(container);
        }
        
        return container;
    }
    
    setupEventListeners() {
        // Close button
        const closeButton = document.getElementById('building-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // Action buttons
        const installButton = document.getElementById('btn-install-module');
        const removeButton = document.getElementById('btn-remove-module');
        const enterButton = document.getElementById('btn-enter-vehicle');
        
        if (installButton) {
            installButton.addEventListener('click', () => {
                if (this.selectedModule && this.activeVehicle) {
                    this.installModule();
                }
            });
        }
        
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                if (this.selectedModule && this.activeVehicle) {
                    this.removeModule();
                }
            });
        }
        
        if (enterButton) {
            enterButton.addEventListener('click', () => {
                if (this.activeVehicle) {
                    this.enterVehicle();
                }
            });
        }
        
        // Add key listener for building UI toggle (B key)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyB') {
                this.toggle();
            }
            
            // Close UI on escape
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
            // Check if near a vehicle
            const nearbyVehicle = this.findNearbyVehicle();
            if (!nearbyVehicle) {
                // Show notification that no vehicle is nearby
                this.game.ui.showNotification("No vehicle nearby", "warn"); 
                return;
            }
            
            this.activeVehicle = nearbyVehicle;
            this.container.classList.remove('hidden');
            this.isVisible = true;
            this.update();
            
            // Initialize vehicle preview
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
        const interactionDistance = 100; // Maximum distance to interact with a vehicle
        
        this.game.debug.log(`Finding nearby vehicles. Total vehicles in EntityManager: ${vehicles.length}`);
        vehicles.forEach(v => {
             const dx_debug = v.x - this.game.player.x;
             const dy_debug = v.y - this.game.player.y;
             const dist_debug = Math.sqrt(dx_debug*dx_debug + dy_debug*dy_debug);
             this.game.debug.log(`  Vehicle ${v.id} at (${v.x.toFixed(0)}, ${v.y.toFixed(0)}), distance: ${dist_debug.toFixed(1)}`);
        });

        let closestVehicle = null;
        let closestDistance = interactionDistance * interactionDistance; // Use squared distance
        
        for (const vehicle of vehicles) {
            const dx = vehicle.x - this.game.player.x;
            const dy = vehicle.y - this.game.player.y;
            const distanceSq = dx * dx + dy * dy; // Squared distance
            
            if (distanceSq < closestDistance) {
                closestDistance = distanceSq;
                closestVehicle = vehicle;
            }
        }
        
        if (closestVehicle) {
             this.game.debug.log(`Closest vehicle found: ${closestVehicle.id} at distance ${Math.sqrt(closestDistance).toFixed(1)}`);
         } else {
             this.game.debug.log(`No vehicle found within interaction distance (${interactionDistance}).`);
         }
        
        return closestVehicle;
    }
    
    initVehiclePreview() {
        if (!this.activeVehicle) return;
        
        const canvas = document.getElementById('vehicle-preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const scale = Math.min(canvas.width, canvas.height) / (this.activeVehicle.size * 4);
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        
        ctx.fillStyle = this.activeVehicle.color || '#fa5';
        ctx.beginPath();
        ctx.arc(0, 0, this.activeVehicle.size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale; 
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.activeVehicle.size / 2, 0);
        ctx.stroke();
        
        if (this.activeVehicle.modules && this.activeVehicle.modules.length > 0) {
            this.activeVehicle.modules.forEach((module, index) => {
                const angle = (index / this.activeVehicle.modules.length) * Math.PI * 2;
                const distance = this.activeVehicle.size * 0.7;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                const moduleSize = module.size || 5; 
                ctx.fillStyle = module.color || '#5af';
                ctx.beginPath();
                ctx.arc(x, y, moduleSize / 2, 0, Math.PI * 2); 
                ctx.fill();
                
                ctx.fillStyle = 'white';
                ctx.font = `${Math.max(3, 10 / scale)}px sans-serif`; 
                ctx.textAlign = 'center';
                ctx.fillText(module.name, x, y + moduleSize * 0.8); 
            });
        }
        
        ctx.restore();
    }
    
    updateVehicleStats() {
        // --- DEBUG START ---
        if (!this.activeVehicle) {
             this.game.debug.warn("[BaseBuildingUI] updateVehicleStats called but activeVehicle is null.");
             return; // Exit if no active vehicle
        }
        // this.game.debug.log("[BaseBuildingUI] Updating vehicle stats display for:", this.activeVehicle.id);
        // --- DEBUG END ---

        const vehicleTypeElement = document.getElementById('vehicle-type');
        if (vehicleTypeElement) {
            vehicleTypeElement.textContent = this.activeVehicle.name || this.activeVehicle.vehicleType || 'Unknown';
        } else {
             this.game.debug.warn("[BaseBuildingUI] Element #vehicle-type not found.");
        }
        
        const healthElement = document.getElementById('vehicle-health');
        if (healthElement) {
            // Ensure health/maxHealth are numbers before using them
            const currentHealth = typeof this.activeVehicle.health === 'number' ? Math.floor(this.activeVehicle.health) : '?';
            const maxHealth = typeof this.activeVehicle.maxHealth === 'number' ? this.activeVehicle.maxHealth : '?';
            healthElement.textContent = `${currentHealth}/${maxHealth}`;
        } else {
             this.game.debug.warn("[BaseBuildingUI] Element #vehicle-health not found.");
        }
        
        const speedElement = document.getElementById('vehicle-speed');
        if (speedElement) {
             const maxSpeed = typeof this.activeVehicle.maxSpeed === 'number' ? this.activeVehicle.maxSpeed : '?';
            speedElement.textContent = `${maxSpeed}`;
        } else {
             this.game.debug.warn("[BaseBuildingUI] Element #vehicle-speed not found.");
        }
        
        const storageElement = document.getElementById('vehicle-storage');
        if (storageElement) {
             const storage = typeof this.activeVehicle.storage === 'number' ? this.activeVehicle.storage : '?';
            storageElement.textContent = `${storage}`;
        } else {
             this.game.debug.warn("[BaseBuildingUI] Element #vehicle-storage not found.");
        }
    }
    
    updateModulesList() {
        // --- DEBUG START ---
        // this.game.debug.log("[BaseBuildingUI] Updating modules list.");
        // --- DEBUG END ---
        const modulesList = document.getElementById('modules-list');
        if (!modulesList) {
             this.game.debug.warn("[BaseBuildingUI] Element #modules-list not found.");
             return;
        }
        
        modulesList.innerHTML = ''; // Clear previous list
        
        const moduleTypes = this.game.config?.MODULE_TYPES || []; 
        if (moduleTypes.length === 0) {
             this.game.debug.warn("[BaseBuildingUI] No MODULE_TYPES found in game config.");
        }
        
        // Keep track if any modules were added to show empty message if needed
        let modulesAdded = false; 
        moduleTypes.forEach(module => {
            // Check if module is already installed on the vehicle
            const isInstalled = this.activeVehicle?.modules?.some(m => m.id === module.id);

            // Create the module item element
            const moduleItem = document.createElement('div');
            moduleItem.className = 'module-item';
            moduleItem.dataset.id = module.id;
            // Add installed class if needed
            if (isInstalled) {
                moduleItem.classList.add('installed'); // Add a class for styling installed modules
            }
            
            const canCraft = this.canCraftModule(module);
            
            let statusText = '';
            if (isInstalled) {
                 statusText = 'Installed';
            } else if (canCraft) {
                 statusText = 'Can Install';
            } else {
                 statusText = 'Missing Resources';
            }

            let statusClass = '';
             if (isInstalled) {
                 statusClass = 'installed-status'; // Specific class for styling
             } else if (canCraft) {
                 statusClass = 'can-craft';
             } else {
                 statusClass = 'cannot-craft';
             }

            moduleItem.innerHTML = `
                <div class="module-icon" style="background-color: ${module.color || '#5af'}"></div>
                <div class="module-details">
                    <div class="module-name">${module.name}</div>
                    <div class="module-craft-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            `;
            
            // Add click handler to select the module
            moduleItem.addEventListener('click', () => {
                 // Find the latest module config data when selecting
                 const latestModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === module.id);
                 if (latestModuleConfig) {
                    this.selectModule(latestModuleConfig); 
                    
                    // Visually indicate selection
                    document.querySelectorAll('.module-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    moduleItem.classList.add('selected');
                 } else {
                     this.game.debug.warn(`[BaseBuildingUI] Could not find config for selected module ID: ${module.id}`);
                     this.selectModule(null); // Clear selection if config missing
                 }
            });
            
            modulesList.appendChild(moduleItem);
            modulesAdded = true; // Mark that we added at least one module
        });
        
        // Show empty message if no modules were defined in config
        if (!modulesAdded) {
            modulesList.innerHTML = '<div class="empty-message">No modules available</div>';
        }
    }
    
    selectModule(module) {
        this.selectedModule = module; // module can be null
        
        const moduleDetails = document.getElementById('module-details');
        if (!moduleDetails) {
             this.game.debug.warn("[BaseBuildingUI] Element #module-details not found.");
             return;
        }

        // If module is null (e.g., selection cleared), reset the details panel
        if (!module) {
             moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
             this.updateActionButtons(); // Update buttons for no selection
             return;
        }
        
        // --- DEBUG START ---
        // this.game.debug.log(`[BaseBuildingUI] Selecting module: ${module.id}`, module);
        // --- DEBUG END ---
        
        // Build details HTML
        let detailsHTML = `<h3>${module.name}</h3>`;
        
        if (module.description) {
            detailsHTML += `<p>${module.description}</p>`;
        }
        
        // Show effects
        if (module.effect && Object.keys(module.effect).length > 0) {
            detailsHTML += `<p>Effects:</p><ul>`;
            for (const [stat, value] of Object.entries(module.effect)) {
                detailsHTML += `<li>+${value} ${stat}</li>`; // Simple display, could be more descriptive
            }
            detailsHTML += `</ul>`;
        }
        
        // Show resource costs
        if (module.cost && Object.keys(module.cost).length > 0) { 
            detailsHTML += `<p>Required Resources:</p><ul>`;
            for (const [resource, amount] of Object.entries(module.cost)) {
                const resourceConfig = this.getResourceConfig(resource);
                // Ensure player exists before accessing resources
                const playerAmount = this.game.player?.resources[resource] || 0; 
                const hasEnough = playerAmount >= amount;
                
                detailsHTML += `<li class="${hasEnough ? 'has-enough' : 'not-enough'}">
                    ${resourceConfig?.name || resource}: ${amount} (Have: ${playerAmount})
                </li>`;
            }
            detailsHTML += `</ul>`;
        } else {
             detailsHTML += `<p>Installation Cost: None</p>`; // Indicate if no cost
        }
        
        // Update the details panel content
        moduleDetails.innerHTML = detailsHTML;
        
        // Update action buttons based on the new selection
        this.updateActionButtons();
    }
    
    updateActionButtons() {
        // --- DEBUG START ---
        // this.game.debug.log(`[BaseBuildingUI] Updating action buttons. Selected module: ${this.selectedModule?.id}, Active vehicle: ${this.activeVehicle?.id}`);
        // --- DEBUG END ---

        const installButton = document.getElementById('btn-install-module');
        const removeButton = document.getElementById('btn-remove-module');
        const enterButton = document.getElementById('btn-enter-vehicle');

        // Safety checks for button elements
        if (!installButton || !removeButton || !enterButton) {
             this.game.debug.warn("[BaseBuildingUI] One or more action buttons not found.");
             return;
        }
        
        // --- Enter Vehicle Button ---
        // Enable only if there's an active vehicle and the player isn't already driving it
        enterButton.disabled = !(this.activeVehicle && this.activeVehicle.driver !== this.game.player?.id);
        
        // --- Install/Remove Buttons ---
        // Both require a module to be selected and an active vehicle
        if (!this.selectedModule || !this.activeVehicle) {
            installButton.disabled = true;
            removeButton.disabled = true;
            // this.game.debug.log("[BaseBuildingUI] Buttons disabled: No module selected or no active vehicle.");
            return;
        }

        // Check if the selected module type is already installed
        const isInstalled = this.activeVehicle.modules?.some(m => m.id === this.selectedModule.id);
        // Check if the player can afford to install it (if not already installed)
        const canAfford = this.canCraftModule(this.selectedModule);

        // Enable Install button if: module selected, vehicle active, NOT installed, AND can afford
        installButton.disabled = !(!isInstalled && canAfford);

        // Enable Remove button if: module selected, vehicle active, AND IS installed
        removeButton.disabled = !isInstalled;

        // --- DEBUG LOGGING ---
        // this.game.debug.log(`[BaseBuildingUI] Button states: Install disabled=${installButton.disabled}, Remove disabled=${removeButton.disabled}, Enter disabled=${enterButton.disabled}`);
        // this.game.debug.log(`  (isInstalled=${isInstalled}, canAfford=${canAfford})`);
        // --- DEBUG LOGGING END ---
    }
    
    update() {
        if (!this.isVisible) return;
        
        // --- DEBUG START ---
        if (!this.activeVehicle) {
            this.game.debug.warn("[BaseBuildingUI] Update called but activeVehicle is null.");
            this.hide(); // Hide if vehicle becomes invalid
            return;
        } else {
            const vehicleEntity = this.game.entities.get(this.activeVehicle.id);
             if (!vehicleEntity) {
                 this.game.debug.warn(`[BaseBuildingUI] Active vehicle (ID: ${this.activeVehicle.id}) not found in EntityManager during update. Closing UI.`);
                 this.hide();
                 return;
             }
             // Ensure we're working with the latest instance from the entity manager
             this.activeVehicle = vehicleEntity; 
            // Log vehicle state being used for UI update
            // this.game.debug.log(`[BaseBuildingUI] Updating UI for vehicle: ${this.activeVehicle.id}`, JSON.parse(JSON.stringify(this.activeVehicle))); 
        }
        // --- DEBUG END ---

        // Re-render preview (might be slightly redundant if stats haven't changed visual much, but fine for now)
        this.initVehiclePreview();
        
        // Update stats display
        this.updateVehicleStats();
        
        // Update available modules list
        this.updateModulesList();
        
        // Update details panel based on selected module (or clear if none)
        if (this.selectedModule) {
            // Reselect to ensure details (like resource cost checks) are current
            // Find the module config again in case it changed (unlikely but safer)
            const currentModuleConfig = this.game.config?.MODULE_TYPES.find(m => m.id === this.selectedModule.id);
            if (currentModuleConfig) {
                this.selectModule(currentModuleConfig); 
            } else {
                 // Selected module type no longer exists? Clear selection.
                 this.selectedModule = null; 
                 const moduleDetails = document.getElementById('module-details');
                 if (moduleDetails) {
                    moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
                 }
            }
        } else {
             // Clear details panel if no module is selected
             const moduleDetails = document.getElementById('module-details');
             if (moduleDetails) {
                moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
             }
        }

        // Update action button states
        this.updateActionButtons();
    }
    
    installModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.canCraftModule(this.selectedModule)) return;
        
        if (this.selectedModule.cost) {
             for (const [resource, amount] of Object.entries(this.selectedModule.cost)) {
                 this.game.player.resources[resource] -= amount;
             }
            this.game.network.updatePresence({
                 resources: this.game.player.resources
             });
        }
        
        const moduleInstance = {
            id: this.selectedModule.id,
            name: this.selectedModule.name,
            effect: { ...this.selectedModule.effect },
            color: this.selectedModule.color,
            size: this.selectedModule.size
        };
        
        if (!this.activeVehicle.modules) {
            this.activeVehicle.modules = [];
        }
        
        const newModules = [...this.activeVehicle.modules, moduleInstance];
        
        this.applyModuleEffects(this.activeVehicle, moduleInstance);
        
        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: newModules 
                    }
                }
            });
        }
        
        this.update();
    }
    
    removeModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.activeVehicle.modules) return;
        
        const moduleIndex = this.activeVehicle.modules.findIndex(m => m.id === this.selectedModule.id);
        if (moduleIndex === -1) return;
        
        const moduleToRemove = this.activeVehicle.modules[moduleIndex];
        
        const newModules = this.activeVehicle.modules.filter((m, index) => index !== moduleIndex);

        this.removeModuleEffects(this.activeVehicle, moduleToRemove);
        
        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: newModules 
                    }
                }
            });
        }
        
        this.update();
    }
    
    enterVehicle() {
        if (!this.activeVehicle || !this.game.player) return;
        
        if (this.game.player.enterVehicle(this.activeVehicle)) {
            this.hide();
        }
    }
    
    applyModuleEffects(vehicle, module) {
        if (!vehicle || !module || !module.effect) return;
        
        for (const [stat, value] of Object.entries(module.effect)) {
            if (stat === 'maxHealth') {
                vehicle.maxHealth += value;
                vehicle.health += value; 
            } else if (stat === 'maxSpeed') {
                vehicle.maxSpeed += value;
            } else if (stat === 'storage') {
                vehicle.storage += value;
            } else if (stat === 'scanRadius') {
                 vehicle.scanRadius = (vehicle.scanRadius || 0) + value;
            }
        }
    }
    
    removeModuleEffects(vehicle, module) {
        if (!vehicle || !module || !module.effect) return;
        
        for (const [stat, value] of Object.entries(module.effect)) {
            if (stat === 'maxHealth') {
                vehicle.maxHealth -= value;
                vehicle.health = Math.min(vehicle.health, vehicle.maxHealth); 
            } else if (stat === 'maxSpeed') {
                vehicle.maxSpeed -= value;
            } else if (stat === 'storage') {
                vehicle.storage -= value;
            } else if (stat === 'scanRadius') {
                 vehicle.scanRadius = Math.max(0, (vehicle.scanRadius || 0) - value);
            }
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
        if (!this.game.config?.RESOURCE_TYPES) return null;
        
        return this.game.config.RESOURCE_TYPES.find(r => r.id === resourceType);
    }
}