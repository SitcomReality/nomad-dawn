// New file: js/ui/HUD.js

export default class HUD {
    constructor(game, containerId) {
        this.game = game;
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.error(`HUD container #${containerId} not found!`);
            return;
        }

        // Cache references to HUD elements
        this.healthElement = this.container.querySelector('#hud-health');
        this.positionElement = this.container.querySelector('#hud-position');
        this.resourcesElement = this.container.querySelector('#hud-resources');
        // Add other elements as needed

        this.resourceCache = {}; // Cache resource values to avoid unnecessary DOM updates
    }

    update() {
        if (!this.game.player) return; // No player data to show yet

        const player = this.game.player;

        // Update Health
        if (this.healthElement) {
            const healthText = `Health: ${Math.round(player.health)}/${player.maxHealth}`;
            if (this.healthElement.textContent !== healthText) {
                this.healthElement.textContent = healthText;
            }
            // Optional: Add visual feedback for low health
            this.healthElement.style.color = player.health / player.maxHealth < 0.3 ? 'var(--ui-accent)' : 'var(--ui-text)';
        }

        // Update Position
        if (this.positionElement) {
            const posText = `Position: (${Math.floor(player.x)}, ${Math.floor(player.y)})`;
             if (this.positionElement.textContent !== posText) {
                this.positionElement.textContent = posText;
            }
        }

        // Update Resources
        if (this.resourcesElement) {
            let resourcesChanged = false;
            let resourcesHTML = '';
            const playerResources = player.resources;

            // Use game config to get proper names and potentially order
            const resourceTypes = this.game.config?.RESOURCE_TYPES || [];

            for (const resType of resourceTypes) {
                const amount = playerResources[resType.id] || 0;
                if (this.resourceCache[resType.id] !== amount) {
                    this.resourceCache[resType.id] = amount;
                    resourcesChanged = true;
                }
                 // Only display resources the player has or common ones even if zero
                 if (amount > 0 || ['metal', 'energy', 'food'].includes(resType.id)) {
                     resourcesHTML += `<div class="resource-item" style="color: ${resType.color || 'var(--ui-text-dim)'}">${resType.name}: ${amount}</div>`;
                 }
            }

            // Check for any resources player has that are NOT in config (shouldn't happen ideally)
             for (const resId in playerResources) {
                 if (!resourceTypes.some(rt => rt.id === resId)) {
                     const amount = playerResources[resId];
                     if (this.resourceCache[resId] !== amount) {
                         this.resourceCache[resId] = amount;
                         resourcesChanged = true;
                     }
                     if (amount > 0) {
                          resourcesHTML += `<div class="resource-item">${resId}: ${amount}</div>`; // Fallback display
                     }
                 }
             }


            if (resourcesChanged) {
                this.resourcesElement.innerHTML = resourcesHTML || '<div class="resource-item">None</div>';
            }
        }

        // Update other HUD elements (e.g., equipped item, vehicle status) later
    }
}
