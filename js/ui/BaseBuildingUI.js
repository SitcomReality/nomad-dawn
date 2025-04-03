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
                this.game.ui.notifications.show("No vehicle nearby", "error");
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
        
        // Find the closest vehicle within interaction distance
        let closestVehicle = null;
        let closestDistance = interactionDistance;
        
        for (const vehicle of vehicles) {
            const dx = vehicle.x - this.game.player.x;
            const dy = vehicle.y - this.game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
            }
        }
        
        return closestVehicle;
    }
    
    initVehiclePreview() {
        if (!this.activeVehicle) return;
        
        const canvas = document.getElementById('vehicle-preview-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scale to fit vehicle in canvas
        const scale = Math.min(canvas.width, canvas.height) / (this.activeVehicle.size * 4);
        
        // Draw vehicle in center of canvas
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
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.activeVehicle.size / 2, 0);
        ctx.stroke();
        
        // Draw installed modules
        if (this.activeVehicle.modules && this.activeVehicle.modules.length > 0) {
            this.activeVehicle.modules.forEach((module, index) => {
                // Position modules around the vehicle
                const angle = (index / this.activeVehicle.modules.length) * Math.PI * 2;
                const distance = this.activeVehicle.size * 0.7;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                // Draw module
                ctx.fillStyle = module.color || '#5af';
                ctx.beginPath();
                ctx.arc(x, y, module.size / 2 || 5, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw module name
                ctx.fillStyle = 'white';
                ctx.font = '3px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(module.name, x, y + 8);
            });
        }
        
        ctx.restore();
    }
    
    updateVehicleStats() {
        if (!this.activeVehicle) return;
        
        // Update vehicle type
        const vehicleTypeElement = document.getElementById('vehicle-type');
        if (vehicleTypeElement) {
            vehicleTypeElement.textContent = this.activeVehicle.name || this.activeVehicle.vehicleType || 'Unknown';
        }
        
        // Update health
        const healthElement = document.getElementById('vehicle-health');
        if (healthElement) {
            healthElement.textContent = `${Math.floor(this.activeVehicle.health)}/${this.activeVehicle.maxHealth}`;
        }
        
        // Update speed
        const speedElement = document.getElementById('vehicle-speed');
        if (speedElement) {
            speedElement.textContent = `${this.activeVehicle.maxSpeed}`;
        }
        
        // Update storage
        const storageElement = document.getElementById('vehicle-storage');
        if (storageElement) {
            storageElement.textContent = `${this.activeVehicle.storage}`;
        }
    }
    
    updateModulesList() {
        const modulesList = document.getElementById('modules-list');
        if (!modulesList) return;
        
        // Clear current list
        modulesList.innerHTML = '';
        
        // Get available modules from config
        const moduleTypes = this.game.config?.MODULE_TYPES || [
            {
                id: 'storage',
                name: 'Storage Module',
                description: 'Increases vehicle storage capacity',
                effect: { storage: 100 },
                cost: { metal: 25, energy: 10 },
                color: '#5af',
                size: 10
            },
            {
                id: 'armor',
                name: 'Armor Plating',
                description: 'Increases vehicle durability',
                effect: { maxHealth: 100 },
                cost: { metal: 50 },
                color: '#888',
                size: 12
            },
            {
                id: 'engine',
                name: 'Engine Upgrade',
                description: 'Increases vehicle speed',
                effect: { maxSpeed: 50 },
                cost: { metal: 30, energy: 30 },
                color: '#f55',
                size: 8
            }
        ];
        
        // Create module items
        moduleTypes.forEach(module => {
            const moduleItem = document.createElement('div');
            moduleItem.className = 'module-item';
            moduleItem.dataset.id = module.id;
            
            // Check if player has enough resources to craft
            const canCraft = this.canCraftModule(module);
            
            moduleItem.innerHTML = `
                <div class="module-icon" style="background-color: ${module.color || '#5af'}"></div>
                <div class="module-details">
                    <div class="module-name">${module.name}</div>
                    <div class="module-craft-status ${canCraft ? 'can-craft' : 'cannot-craft'}">
                        ${canCraft ? 'Can Install' : 'Missing Resources'}
                    </div>
                </div>
            `;
            
            // Add click handler
            moduleItem.addEventListener('click', () => {
                this.selectModule(module);
                
                // Highlight selected item
                document.querySelectorAll('.module-item').forEach(item => {
                    item.classList.remove('selected');
                });
                moduleItem.classList.add('selected');
            });
            
            modulesList.appendChild(moduleItem);
        });
        
        // Show empty message if no modules
        if (modulesList.children.length === 0) {
            modulesList.innerHTML = '<div class="empty-message">No modules available</div>';
        }
    }
    
    selectModule(module) {
        this.selectedModule = module;
        
        // Update module details
        const moduleDetails = document.getElementById('module-details');
        if (moduleDetails) {
            let detailsHTML = `<h3>${module.name}</h3>`;
            
            if (module.description) {
                detailsHTML += `<p>${module.description}</p>`;
            }
            
            // Show module effects
            if (module.effect) {
                detailsHTML += `<p>Effects:</p><ul>`;
                for (const [stat, value] of Object.entries(module.effect)) {
                    detailsHTML += `<li>+${value} ${stat}</li>`;
                }
                detailsHTML += `</ul>`;
            }
            
            // Show required resources
            detailsHTML += `<p>Required Resources:</p><ul>`;
            for (const [resource, amount] of Object.entries(module.cost)) {
                const resourceConfig = this.getResourceConfig(resource);
                const playerAmount = this.game.player.resources[resource] || 0;
                const hasEnough = playerAmount >= amount;
                
                detailsHTML += `<li class="${hasEnough ? 'has-enough' : 'not-enough'}">
                    ${resourceConfig?.name || resource}: ${amount} (Have: ${playerAmount})
                </li>`;
            }
            detailsHTML += `</ul>`;
            
            moduleDetails.innerHTML = detailsHTML;
        }
        
        // Update action buttons
        this.updateActionButtons();
    }
    
    updateActionButtons() {
        const installButton = document.getElementById('btn-install-module');
        const removeButton = document.getElementById('btn-remove-module');
        const enterButton = document.getElementById('btn-enter-vehicle');
        
        if (installButton) {
            // Enable install button if a module is selected and player has resources
            installButton.disabled = !(this.selectedModule && this.canCraftModule(this.selectedModule));
        }
        
        if (removeButton) {
            // Enable remove button if active vehicle has this module installed
            const hasModule = this.activeVehicle && this.activeVehicle.modules && 
                this.selectedModule && this.activeVehicle.modules.some(m => m.id === this.selectedModule.id);
                
            removeButton.disabled = !hasModule;
        }
        
        if (enterButton) {
            // Enable enter button if vehicle is available
            enterButton.disabled = !this.activeVehicle;
        }
    }
    
    installModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.canCraftModule(this.selectedModule)) return;
        
        // Deduct resources
        for (const [resource, amount] of Object.entries(this.selectedModule.cost)) {
            this.game.player.resources[resource] -= amount;
        }
        
        // Sync resources with network
        this.game.network.updatePresence({
            resources: this.game.player.resources
        });
        
        // Add module to vehicle
        const moduleInstance = {
            id: this.selectedModule.id,
            name: this.selectedModule.name,
            effect: { ...this.selectedModule.effect },
            color: this.selectedModule.color,
            size: this.selectedModule.size
        };
        
        // Add module to vehicle locally if it's our own vehicle
        if (this.activeVehicle.owner === this.game.player.id) {
            // Add module to vehicle's modules array
            if (!this.activeVehicle.modules) {
                this.activeVehicle.modules = [];
            }
            this.activeVehicle.modules.push(moduleInstance);
            
            // Apply module effects
            this.applyModuleEffects(this.activeVehicle, moduleInstance);
        }
        
        // Update vehicle on the network
        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: this.activeVehicle.modules
                    }
                }
            });
        }
        
        // Update UI
        this.update();
    }
    
    removeModule() {
        if (!this.selectedModule || !this.activeVehicle || !this.activeVehicle.modules) return;
        
        // Find module in vehicle
        const moduleIndex = this.activeVehicle.modules.findIndex(m => m.id === this.selectedModule.id);
        if (moduleIndex === -1) return;
        
        const module = this.activeVehicle.modules[moduleIndex];
        
        // Remove module from vehicle locally if it's our own vehicle
        if (this.activeVehicle.owner === this.game.player.id) {
            // Remove module effects
            this.removeModuleEffects(this.activeVehicle, module);
            
            // Remove module from array
            this.activeVehicle.modules.splice(moduleIndex, 1);
        }
        
        // Update vehicle on the network
        if (this.activeVehicle.id) {
            this.game.network.updateRoomState({
                vehicles: {
                    [this.activeVehicle.id]: {
                        modules: this.activeVehicle.modules
                    }
                }
            });
        }
        
        // Update UI
        this.update();
    }
    
    enterVehicle() {
        if (!this.activeVehicle || !this.game.player) return;
        
        // Enter the vehicle
        if (this.game.player.enterVehicle(this.activeVehicle)) {
            // Close the UI
            this.hide();
        }
    }
    
    applyModuleEffects(vehicle, module) {
        if (!vehicle || !module || !module.effect) return;
        
        // Apply each effect
        for (const [stat, value] of Object.entries(module.effect)) {
            if (stat === 'maxHealth') {
                vehicle.maxHealth += value;
                vehicle.health += value; // Also increase current health
            } else if (stat === 'maxSpeed') {
                vehicle.maxSpeed += value;
            } else if (stat === 'storage') {
                vehicle.storage += value;
            }
            // Add other stat effects as needed
        }
    }
    
    removeModuleEffects(vehicle, module) {
        if (!vehicle || !module || !module.effect) return;
        
        // Remove each effect
        for (const [stat, value] of Object.entries(module.effect)) {
            if (stat === 'maxHealth') {
                vehicle.maxHealth -= value;
                vehicle.health = Math.min(vehicle.health, vehicle.maxHealth); // Cap health
            } else if (stat === 'maxSpeed') {
                vehicle.maxSpeed -= value;
            } else if (stat === 'storage') {
                vehicle.storage -= value;
            }
            // Remove other stat effects as needed
        }
    }
    
    canCraftModule(module) {
        if (!module || !module.cost || !this.game.player) return false;
        
        // Check if player has enough resources for each cost item
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
    
    update() {
        if (!this.isVisible || !this.activeVehicle) return;
        
        // Update vehicle preview
        this.initVehiclePreview();
        
        // Update vehicle stats
        this.updateVehicleStats();
        
        // Update modules list
        this.updateModulesList();
        
        // Update action buttons
        this.updateActionButtons();
    }
}