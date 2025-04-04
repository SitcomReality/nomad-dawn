/**
 * Manages the tool selection panel within the BaseBuildingUI.
 * Handles tool buttons, object/tile selection lists, and costs.
 */
export default class BuildingToolPanel {
    constructor(game, buildingManager, panelContainerElement) {
        this.game = game;
        this.buildingManager = buildingManager;
        this.panelContainer = panelContainerElement; // The #tool-info-area element
        this.activeVehicle = null; // Keep track of the vehicle being edited

        if (!this.panelContainer) {
            console.error("[BuildingToolPanel] Panel container element not provided!");
            return;
        }

        // Inject initial HTML structure into the panel container
        this.injectPanelHTML();

        // Cache elements specific to this panel
        this.cacheElements();
        this.setupEventListeners();
    }

    injectPanelHTML() {
         this.panelContainer.innerHTML = `
             <p id="tool-status-text">Select a tool.</p>
             <div id="object-selection-container" class="hidden">
                 <h4>Placeable Objects:</h4>
                 <div id="object-buttons" class="object-buttons-grid">
                    <!-- Buttons populated by JS -->
                 </div>
             </div>
             <div id="tile-selection-container" class="hidden">
                  <h4>Placeable Tiles:</h4>
                  <p>(Tile selection not implemented yet)</p>
             </div>
         `;
    }

    cacheElements() {
        this.elements = {
            toolStatusText: this.panelContainer.querySelector('#tool-status-text'),
            objectSelectionContainer: this.panelContainer.querySelector('#object-selection-container'),
            objectButtonsContainer: this.panelContainer.querySelector('#object-buttons'),
            tileSelectionContainer: this.panelContainer.querySelector('#tile-selection-container'),
            // Reference the main tool buttons (which are outside this specific panel's container)
            toolSelectButton: document.getElementById('tool-select'),
            toolPlaceTileButton: document.getElementById('tool-place-tile'),
            toolPlaceObjectButton: document.getElementById('tool-place-object'),
            toolRemoveButton: document.getElementById('tool-remove')
        };

        // Basic check
        if (!this.elements.toolStatusText || !this.elements.objectSelectionContainer || !this.elements.objectButtonsContainer || !this.elements.tileSelectionContainer) {
             console.error("[BuildingToolPanel] Failed to cache essential panel elements.");
        }
    }

    setupEventListeners() {
        // Listen to main tool buttons (Select, Place Tile, Place Object, Remove)
        // Note: These listeners could arguably live in BaseBuildingUI, but putting them
        // here keeps tool-related logic together.
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

        // Event delegation for dynamically added object/tile buttons within this panel
        if (this.elements.objectButtonsContainer) {
             this.elements.objectButtonsContainer.addEventListener('click', (event) => {
                 const button = event.target.closest('.object-select-button'); // Find the button element
                 if (button) {
                      const objectTypeId = button.dataset.objectTypeId;
                     if (objectTypeId) {
                         this.selectObjectType(objectTypeId);
                     }
                 }
             });
        }
        // Add similar listener for tile buttons when implemented
    }

    setActiveVehicle(vehicle) {
        this.activeVehicle = vehicle;
        // Refresh panel content if visible when vehicle changes
        if (this.panelContainer && !this.panelContainer.closest('.game-ui.hidden')) {
             this.update();
        }
    }

    setActiveTool(toolName) {
         if (!this.buildingManager) return;
         this.buildingManager.setSelectedTool(toolName);

         // Update main tool button active states
         const toolButtonsContainer = document.getElementById('tool-buttons'); // Find the container again
         if (toolButtonsContainer) {
             toolButtonsContainer.querySelectorAll('.tool-button').forEach(btn => {
                 btn.classList.remove('active');
             });
              const buttonElement = toolButtonsContainer.querySelector(`#tool-${toolName}`);
              if(buttonElement) buttonElement.classList.add('active');
         } else {
             console.warn("[BuildingToolPanel] Tool buttons container not found.");
         }


         // Update visibility and content of sections within this panel
         this.elements.toolStatusText?.classList.toggle('hidden', toolName !== 'select' && toolName !== 'remove');
         this.elements.objectSelectionContainer?.classList.toggle('hidden', toolName !== 'place_object');
         this.elements.tileSelectionContainer?.classList.toggle('hidden', toolName !== 'place_tile');

         // Update status text
         if (this.elements.toolStatusText) {
              let status = "Select a tool.";
              if (toolName === 'select') status = "Click grid to inspect cell.";
              if (toolName === 'remove') status = "Click grid to remove object/tile.";
              if (toolName === 'place_object') status = "Select an object below.";
              if (toolName === 'place_tile') status = "Select a tile type (Not Impl).";
              this.elements.toolStatusText.textContent = status;
         }

         // Populate and select default if needed
         if (toolName === 'place_object') {
             this.populateObjectSelection();
             // Select the first object if nothing is selected in the manager yet
              if (!this.buildingManager.selectedObjectType) {
                  const firstObjectButton = this.elements.objectButtonsContainer?.querySelector('.object-select-button');
                  if (firstObjectButton && firstObjectButton.dataset.objectTypeId) {
                      this.selectObjectType(firstObjectButton.dataset.objectTypeId);
                  }
              } else {
                   // Ensure the button for the currently selected object is marked active
                   this.updateObjectButtonSelectionState(this.buildingManager.selectedObjectType);
              }
         } else if (toolName === 'place_tile') {
             // Populate tile selection later
         }
    }

    populateObjectSelection() {
         const container = this.elements.objectButtonsContainer;
         if (!container || !this.game.config?.INTERIOR_OBJECT_TYPES) {
             console.error("[BuildingToolPanel] Cannot populate object selection: container or config missing.");
             container.innerHTML = '<p>Error loading objects.</p>';
             return;
         }

         container.innerHTML = ''; // Clear previous buttons
         const availableObjects = this.game.config.INTERIOR_OBJECT_TYPES;

         availableObjects.forEach(objType => {
             const button = document.createElement('button');
             button.className = 'object-select-button';
             button.dataset.objectTypeId = objType.id;
             // Generate detailed tooltip content first
             const tooltipContent = this.generateDetailedTooltip(objType);
             button.title = tooltipContent; // Set the detailed tooltip

             button.innerHTML = `
                 <span class="object-icon">${objType.icon || '❓'}</span>
                 <span class="object-name">${objType.name}</span>
                 ${this.formatResourceCost(objType.cost)}
             `;
             // Check initial craftability
             this.updateButtonAffordability(button, objType);
             container.appendChild(button);
         });
    }

    // NEW: Generate detailed tooltip content
    generateDetailedTooltip(objConfig) {
        let tooltip = `${objConfig.name}\n${objConfig.description || 'No description.'}`;
        if (objConfig.cost && Object.keys(objConfig.cost).length > 0) {
            tooltip += `\n\nCost:`;
            for (const [resource, amount] of Object.entries(objConfig.cost)) {
                 const playerAmount = this.game.player?.resources[resource] || 0;
                 const resConfig = this.game.config.RESOURCE_TYPES.find(r => r.id === resource);
                 const resName = resConfig?.name || resource;
                 tooltip += `\n- ${amount} ${resName} (Have: ${playerAmount})`;
            }
        } else {
             tooltip += `\n\nCost: Free`;
        }
        return tooltip;
    }

    updateButtonAffordability(button, objConfig) {
         if (!this.game.player || !objConfig || !objConfig.cost) {
             button.disabled = false;
             button.classList.remove('cannot-afford');
             return;
         }

         let canAfford = true;
         for (const [resource, amount] of Object.entries(objConfig.cost)) {
             if ((this.game.player.resources[resource] || 0) < amount) {
                 canAfford = false;
                 break;
             }
         }
         button.disabled = !canAfford;
         button.classList.toggle('cannot-afford', !canAfford);
    }

    formatResourceCost(cost) {
        if (!cost || Object.keys(cost).length === 0) {
            // Return a non-breaking space or similar if you want it to take up minimal space but still exist
            return '<div class="object-cost cost-free" title="Free"></div>';
        }
        let costHtml = '<div class="object-cost">';
        let tooltipParts = []; // Build tooltip parts for the cost section specifically
        for (const [resource, amount] of Object.entries(cost)) {
            const playerAmount = this.game.player?.resources[resource] || 0;
            const hasEnough = playerAmount >= amount;
            const resConfig = this.game.config.RESOURCE_TYPES.find(r => r.id === resource);
            const resName = resConfig?.name || resource;
            const resColor = resConfig?.color || '#ccc';
            // Keep the concise colored amount display
            costHtml += `<span class="${hasEnough ? 'cost-ok' : 'cost-missing'}" style="color:${resColor}; font-size: 0.8em; margin-left: 3px;">${amount}</span>`;
            // Add detailed part to the cost-specific tooltip
            tooltipParts.push(`${amount} ${resName} (Have: ${playerAmount})`);
        }
        // Add the tooltip to the wrapper div
        costHtml += '</div>';
        // Combine the parts into a title attribute for the wrapper div
        const costTooltip = tooltipParts.length > 0 ? `Cost: ${tooltipParts.join(', ')}` : 'Free';
        costHtml = costHtml.replace('<div class="object-cost">', `<div class="object-cost" title="${costTooltip}">`);
        return costHtml;
    }

    selectObjectType(objectTypeId) {
        if (!this.buildingManager) return;
        this.buildingManager.setSelectedObjectType(objectTypeId);
        this.updateObjectButtonSelectionState(objectTypeId);

        // Update tool status text
        if (this.elements.toolStatusText && this.buildingManager.selectedTool === 'place_object') {
            const selectedObj = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectTypeId);
            this.elements.toolStatusText.textContent = `Placing: ${selectedObj?.name || objectTypeId}. Click grid.`;
        }
    }

     updateObjectButtonSelectionState(selectedObjectTypeId) {
          // Update visual selection state for object buttons
          const objectButtons = this.elements.objectButtonsContainer?.querySelectorAll('.object-select-button');
          objectButtons?.forEach(btn => {
              btn.classList.toggle('active', btn.dataset.objectTypeId === selectedObjectTypeId);
          });
     }

    // Update function called by BaseBuildingUI
    update() {
         // Update craftability status of object buttons if the place_object tool is active
         if (this.buildingManager?.selectedTool === 'place_object' && this.elements.objectButtonsContainer) {
             const objectButtons = this.elements.objectButtonsContainer.querySelectorAll('.object-select-button');
             objectButtons.forEach(button => {
                 const objectTypeId = button.dataset.objectTypeId;
                 const objConfig = this.game.config.INTERIOR_OBJECT_TYPES.find(o => o.id === objectTypeId);
                 if (objConfig) {
                     this.updateButtonAffordability(button, objConfig);
                     // Also update the cost display itself in case resource amounts changed
                     const costElement = button.querySelector('.object-cost');
                     if (costElement) {
                          // Re-generate cost HTML and tooltip content
                          const newCostHtmlContent = this.formatResourceCost(objConfig.cost)
                             .replace(/<div class="object-cost"[^>]*>/, '') // Remove opening tag with title
                             .replace('</div>','');
                          const newCostTooltip = `Cost: ${this.generateDetailedTooltip(objConfig).split('\n\nCost:')[1] || 'Free'}`;

                          // Update only if changed
                          if (costElement.innerHTML !== newCostHtmlContent) {
                             costElement.innerHTML = newCostHtmlContent;
                          }
                          if (costElement.title !== newCostTooltip) {
                              costElement.title = newCostTooltip;
                          }
                     }
                     // Update main button tooltip as well if needed (though it might be static content + cost)
                     const newButtonTooltip = this.generateDetailedTooltip(objConfig);
                     if (button.title !== newButtonTooltip) {
                          button.title = newButtonTooltip;
                     }
                 }
             });
         }
         // Update tile button states later
    }
}