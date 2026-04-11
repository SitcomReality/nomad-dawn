import Vehicle from '../entities/Vehicle.js';

export default class InventoryUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.selectedItem = null;
        this.hoveredItem = null;
        
        // Create UI elements
        this.container = this.createInventoryContainer();
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    createInventoryContainer() {
        // Create container if not exists
        let container = document.getElementById('inventory-ui');
        if (!container) {
            container = document.createElement('div');
            container.id = 'inventory-ui';
            container.className = 'game-ui hidden';
            
            // Create inventory structure
            container.innerHTML = `
                <div class="inventory-header">
                    <h2>Inventory</h2>
                    <button class="close-button" id="inventory-close">×</button>
                </div>
                <div class="inventory-tabs">
                    <button class="tab-button active" data-tab="resources">Resources</button>
                    <button class="tab-button" data-tab="equipment">Equipment</button>
                    <button class="tab-button" data-tab="blueprints">Blueprints</button>
                </div>
                <div class="inventory-content">
                    <div class="tab-content active" id="tab-resources">
                        <div class="resources-list"></div>
                    </div>
                    <div class="tab-content" id="tab-equipment">
                        <div class="equipment-slots">
                            <div class="equipment-slot" data-slot="weapon">
                                <div class="slot-label">Weapon</div>
                                <div class="slot-content empty"></div>
                            </div>
                            <div class="equipment-slot" data-slot="armor">
                                <div class="slot-label">Armor</div>
                                <div class="slot-content empty"></div>
                            </div>
                            <div class="equipment-slot" data-slot="tool">
                                <div class="slot-label">Tool</div>
                                <div class="slot-content empty"></div>
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="tab-blueprints">
                        <div class="blueprints-list"></div>
                    </div>
                </div>
                <div class="inventory-footer">
                    <div class="item-details">
                        <h3>Select an item</h3>
                        <p>Item details will appear here</p>
                    </div>
                    <div class="action-buttons">
                        <button id="btn-use" disabled>Use</button>
                        <button id="btn-drop" disabled>Drop</button>
                        <button id="btn-craft" disabled>Craft</button>
                    </div>
                </div>
            `;
            
            document.getElementById('ui-overlay').appendChild(container);
        }
        
        return container;
    }
    
    setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Close button
        const closeButton = document.getElementById('inventory-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // Action buttons
        const useButton = document.getElementById('btn-use');
        const dropButton = document.getElementById('btn-drop');
        const craftButton = document.getElementById('btn-craft');
        
        if (useButton) {
            useButton.addEventListener('click', () => {
                if (this.selectedItem) {
                    this.useSelectedItem();
                }
            });
        }
        
        if (dropButton) {
            dropButton.addEventListener('click', () => {
                if (this.selectedItem) {
                    this.dropSelectedItem();
                }
            });
        }
        
        if (craftButton) {
            craftButton.addEventListener('click', () => {
                if (this.selectedItem && this.selectedItem.type === 'blueprint') {
                    this.craftSelectedItem();
                }
            });
        }
        
        // Add key listener for inventory toggle (I key)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI') {
                this.toggle();
            }
            
            // Close inventory on escape
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
            this.container.classList.remove('hidden');
            this.isVisible = true;
            this.update();
        }
    }
    
    hide() {
        if (this.isVisible) {
            this.container.classList.add('hidden');
            this.isVisible = false;
        }
    }
    
    switchTab(tabId) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        
        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
        
        // Update content for the selected tab
        this.updateTabContent(tabId);
    }
    
    updateTabContent(tabId) {
        if (!this.game.player) return;
        
        switch (tabId) {
            case 'resources':
                this.updateResourcesList();
                break;
            case 'equipment':
                this.updateEquipmentSlots();
                break;
            case 'blueprints':
                this.updateBlueprintsList();
                break;
        }
    }
    
    updateResourcesList() {
        const resourcesList = document.querySelector('.resources-list');
        if (!resourcesList || !this.game.player) return;
        
        resourcesList.innerHTML = '';
        
        // Get resources from player
        const resources = this.game.player.resources;
        
        // Create resource items
        for (const [type, amount] of Object.entries(resources)) {
            if (amount <= 0) continue; // Skip empty resources
            
            const resourceItem = document.createElement('div');
            resourceItem.className = 'inventory-item resource-item';
            resourceItem.dataset.type = type;
            resourceItem.dataset.itemType = 'resource';
            
            // Get resource config for this type
            const resourceConfig = this.getResourceConfig(type);
            const resourceColor = resourceConfig?.color || '#ccc';
            
            resourceItem.innerHTML = `
                <div class="item-icon" style="background-color: ${resourceColor}"></div>
                <div class="item-details">
                    <div class="item-name">${resourceConfig?.name || type}</div>
                    <div class="item-amount">${amount}</div>
                </div>
            `;
            
            // Add click handler
            resourceItem.addEventListener('click', () => {
                this.selectItem({
                    type: 'resource',
                    resourceType: type,
                    amount: amount,
                    name: resourceConfig?.name || type,
                    description: resourceConfig?.description || '',
                    color: resourceColor
                });
                
                // Highlight selected item
                document.querySelectorAll('.inventory-item').forEach(item => {
                    item.classList.remove('selected');
                });
                resourceItem.classList.add('selected');
            });
            
            resourcesList.appendChild(resourceItem);
        }
        
        // Show empty message if no resources
        if (resourcesList.children.length === 0) {
            resourcesList.innerHTML = '<div class="empty-message">No resources in inventory</div>';
        }
    }
    
    updateEquipmentSlots() {
        // Update equipment slots based on player's equipped items
        const slots = document.querySelectorAll('.equipment-slot');
        
        if (!this.game.player || !slots) return;
        
        // Update each slot with the equipped item
        slots.forEach(slot => {
            const slotType = slot.dataset.slot;
            const slotContent = slot.querySelector('.slot-content');
            
            // Check if player has this equipment type equipped
            const equippedItem = this.game.player.equipment?.[slotType];
            
            if (equippedItem) {
                slotContent.classList.remove('empty');
                slotContent.innerHTML = `
                    <div class="item-icon" style="background-color: ${equippedItem.color || '#aaa'}"></div>
                    <div class="item-name">${equippedItem.name}</div>
                `;
                
                // Add click handler to select the item
                slotContent.addEventListener('click', () => {
                    this.selectItem({
                        ...equippedItem,
                        equipped: true,
                        slot: slotType
                    });
                    
                    // Highlight selected item
                    document.querySelectorAll('.equipment-slot .slot-content').forEach(content => {
                        content.classList.remove('selected');
                    });
                    slotContent.classList.add('selected');
                });
            } else {
                slotContent.classList.add('empty');
                slotContent.innerHTML = '<div class="empty-slot-text">Empty</div>';
            }
        });
    }
    
    updateBlueprintsList() {
        const blueprintsList = document.querySelector('.blueprints-list');
        if (!blueprintsList || !this.game.player) return;
        
        blueprintsList.innerHTML = '';
        
        // Get blueprints - for now using vehicle types from config
        const blueprints = this.game.config?.VEHICLE_TYPES || [];
        
        // Create blueprint items
        blueprints.forEach(blueprint => {
            const blueprintItem = document.createElement('div');
            blueprintItem.className = 'inventory-item blueprint-item';
            blueprintItem.dataset.id = blueprint.id;
            blueprintItem.dataset.itemType = 'blueprint';
            
            // Check if player has enough resources to craft
            const canCraft = this.canCraftBlueprint(blueprint);
            
            blueprintItem.innerHTML = `
                <div class="item-icon vehicle-icon">${blueprint.id.charAt(0).toUpperCase()}</div>
                <div class="item-details">
                    <div class="item-name">${blueprint.name}</div>
                    <div class="item-craft-status ${canCraft ? 'can-craft' : 'cannot-craft'}">
                        ${canCraft ? 'Can Build' : 'Missing Resources'}
                    </div>
                </div>
            `;
            
            // Add click handler
            blueprintItem.addEventListener('click', () => {
                this.selectItem({
                    type: 'blueprint',
                    blueprintType: blueprint.id,
                    name: blueprint.name,
                    description: blueprint.description,
                    cost: blueprint.cost,
                    canCraft: canCraft
                });
                
                // Highlight selected item
                document.querySelectorAll('.inventory-item').forEach(item => {
                    item.classList.remove('selected');
                });
                blueprintItem.classList.add('selected');
            });
            
            blueprintsList.appendChild(blueprintItem);
        });
        
        // Show empty message if no blueprints
        if (blueprintsList.children.length === 0) {
            blueprintsList.innerHTML = '<div class="empty-message">No blueprints available</div>';
        }
    }
    
    selectItem(item) {
        this.selectedItem = item;
        
        // Update item details panel
        const itemDetails = document.querySelector('.item-details');
        if (itemDetails) {
            let detailsHTML = `<h3>${item.name}</h3>`;
            
            if (item.description) {
                detailsHTML += `<p>${item.description}</p>`;
            }
            
            if (item.type === 'resource') {
                detailsHTML += `<p>Amount: ${item.amount}</p>`;
            } else if (item.type === 'blueprint') {
                detailsHTML += `<p>Required Resources:</p><ul>`;
                for (const [resource, amount] of Object.entries(item.cost)) {
                    const resourceConfig = this.getResourceConfig(resource);
                    const playerAmount = this.game.player.resources[resource] || 0;
                    const hasEnough = playerAmount >= amount;
                    
                    detailsHTML += `<li class="${hasEnough ? 'has-enough' : 'not-enough'}">
                        ${resourceConfig?.name || resource}: ${amount} (Have: ${playerAmount})
                    </li>`;
                }
                detailsHTML += `</ul>`;
            }
            
            itemDetails.innerHTML = detailsHTML;
        }
        
        // Update action buttons
        this.updateActionButtons();
    }
    
    updateActionButtons() {
        const useButton = document.getElementById('btn-use');
        const dropButton = document.getElementById('btn-drop');
        const craftButton = document.getElementById('btn-craft');
        
        if (!this.selectedItem) {
            // Disable all buttons if no item selected
            useButton.disabled = true;
            dropButton.disabled = true;
            craftButton.disabled = true;
            return;
        }
        
        // Enable/disable buttons based on item type
        if (this.selectedItem.type === 'resource') {
            useButton.disabled = true; // Most resources can't be "used" directly
            dropButton.disabled = false;
            craftButton.disabled = true;
        } else if (this.selectedItem.type === 'blueprint') {
            useButton.disabled = true;
            dropButton.disabled = true;
            craftButton.disabled = !this.selectedItem.canCraft;
        } else if (this.selectedItem.type === 'equipment') {
            useButton.disabled = false;
            useButton.textContent = this.selectedItem.equipped ? 'Unequip' : 'Equip';
            dropButton.disabled = this.selectedItem.equipped;
            craftButton.disabled = true;
        }
    }
    
    useSelectedItem() {
        if (!this.selectedItem) return;
        
        if (this.selectedItem.type === 'equipment') {
            if (this.selectedItem.equipped) {
                // Unequip item
                if (this.game.player.equipment && this.selectedItem.slot) {
                    this.game.player.unequipItem(this.selectedItem.slot);
                }
            } else {
                // Equip item
                this.game.player.equipItem(this.selectedItem);
            }
            
            // Update UI
            this.updateEquipmentSlots();
        }
    }
    
    dropSelectedItem() {
        if (!this.selectedItem) return;
        
        if (this.selectedItem.type === 'resource') {
            // Drop half the stack by default
            const amountToDrop = Math.ceil(this.selectedItem.amount / 2);
            
            // Update player resources
            this.game.player.resources[this.selectedItem.resourceType] -= amountToDrop;
            this.game.player._stateChanged = true;
            
            // Create resource in world
            // TODO: Add world resource spawning
            
            // Update inventory display
            this.update();
        }
    }
    
    craftSelectedItem() {
        if (!this.selectedItem || this.selectedItem.type !== 'blueprint' || !this.selectedItem.canCraft) return;
        
        // Create the vehicle
        this.createVehicleFromBlueprint(this.selectedItem.blueprintType);
    }
    
    createVehicleFromBlueprint(blueprintType) {
        // Find the vehicle config
        const vehicleConfig = this.game.config?.VEHICLE_TYPES.find(v => v.id === blueprintType);
        if (!vehicleConfig) return false;
        
        // Check again if player has enough resources
        if (!this.canCraftBlueprint(vehicleConfig)) return false;
        
        // Deduct resources
        for (const [resource, amount] of Object.entries(vehicleConfig.cost)) {
            this.game.player.resources[resource] -= amount;
        }
        this.game.player._stateChanged = true;
        
        // Create vehicle entity near player position
        const spawnOffsetDistance = 50;
        const spawnAngle = this.game.player.angle;
        const spawnX = this.game.player.x + Math.cos(spawnAngle) * spawnOffsetDistance;
        const spawnY = this.game.player.y + Math.sin(spawnAngle) * spawnOffsetDistance;
        
        // Create unique ID for vehicle
        const vehicleId = `vehicle-${blueprintType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Create and add vehicle entity locally
        const vehicle = new Vehicle(vehicleId, vehicleConfig, this.game.player.id, this.game);
        vehicle.x = spawnX;
        vehicle.y = spawnY;
        vehicle.angle = spawnAngle;
        this.game.entities.add(vehicle);
        
        // Update UI
        this.update();
        
        // Close inventory
        this.hide();
        
        return true;
    }
    
    canCraftBlueprint(blueprint) {
        if (!blueprint || !blueprint.cost || !this.game.player) return false;
        
        // Check if player has enough resources for each cost item
        for (const [resource, amount] of Object.entries(blueprint.cost)) {
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
        
        // Get active tab
        const activeTab = document.querySelector('.tab-button.active')?.dataset.tab;
        if (activeTab) {
            this.updateTabContent(activeTab);
        }
    }
}