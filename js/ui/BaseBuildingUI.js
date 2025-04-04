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
        if (!this.activeVehicle) return;
        
        const vehicleTypeElement = document.getElementById('vehicle-type');
        if (vehicleTypeElement) {
            vehicleTypeElement.textContent = this.activeVehicle.name || this.activeVehicle.vehicleType || 'Unknown';
        }
        
        const healthElement = document.getElementById('vehicle-health');
        if (healthElement) {
            healthElement.textContent = `${Math.floor(this.activeVehicle.health)}/${this.activeVehicle.maxHealth}`;
        }
        
        const speedElement = document.getElementById('vehicle-speed');
        if (speedElement) {
            speedElement.textContent = `${this.activeVehicle.maxSpeed}`;
        }
        
        const storageElement = document.getElementById('vehicle-storage');
        if (storageElement) {
            storageElement.textContent = `${this.activeVehicle.storage}`;
        }
    }
    
    updateModulesList() {
        const modulesList = document.getElementById('modules-list');
        if (!modulesList) return;
        
        modulesList.innerHTML = '';
        
        const moduleTypes = this.game.config?.MODULE_TYPES || []; 
        
        moduleTypes.forEach(module => {
            const moduleItem = document.createElement('div');
            moduleItem.className = 'module-item';
            moduleItem.dataset.id = module.id;
            
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
            
            moduleItem.addEventListener('click', () => {
                this.selectModule(module);
                
                document.querySelectorAll('.module-item').forEach(item => {
                    item.classList.remove('selected');
                });
                moduleItem.classList.add('selected');
            });
            
            modulesList.appendChild(moduleItem);
        });
        
        if (modulesList.children.length === 0) {
            modulesList.innerHTML = '<div class="empty-message">No modules available</div>';
        }
    }
    
    selectModule(module) {
        this.selectedModule = module;
        
        const moduleDetails = document.getElementById('module-details');
        if (moduleDetails) {
            let detailsHTML = `<h3>${module.name}</h3>`;
            
            if (module.description) {
                detailsHTML += `<p>${module.description}</p>`;
            }
            
            if (module.effect) {
                detailsHTML += `<p>Effects:</p><ul>`;
                for (const [stat, value] of Object.entries(module.effect)) {
                    detailsHTML += `<li>+${value} ${stat}</li>`;
                }
                detailsHTML += `</ul>`;
            }
            
            if (module.cost) { 
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
                 detailsHTML += `<p>No resources required.</p>`; 
            }
            
            moduleDetails.innerHTML = detailsHTML;
        }
        
        this.updateActionButtons();
    }
    
    updateActionButtons() {
        const installButton = document.getElementById('btn-install-module');
        const removeButton = document.getElementById('btn-remove-module');
        const enterButton = document.getElementById('btn-enter-vehicle');
        
        if (installButton) {
            installButton.disabled = !(this.selectedModule && this.canCraftModule(this.selectedModule));
        }
        
        if (removeButton) {
            const hasModule = this.activeVehicle && this.activeVehicle.modules && 
                this.selectedModule && this.activeVehicle.modules.some(m => m.id === this.selectedModule.id);
                
            removeButton.disabled = !hasModule;
        }
        
        if (enterButton) {
            enterButton.disabled = !this.activeVehicle;
        }
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
    
    update() {
        if (!this.isVisible) return;
        
        if (!this.activeVehicle || !this.game.entities.get(this.activeVehicle.id)) {
             this.game.debug.log("Active vehicle removed, closing Building UI.");
             this.hide();
             return;
        }

        this.initVehiclePreview();
        
        this.updateVehicleStats();
        
        this.updateModulesList();
        
        if (this.selectedModule) {
            this.selectModule(this.selectedModule); 
        } else {
             const moduleDetails = document.getElementById('module-details');
             if (moduleDetails) {
                moduleDetails.innerHTML = `<h3>Select a module</h3><p>Module details will appear here</p>`;
             }
        }

        this.updateActionButtons();
    }
}