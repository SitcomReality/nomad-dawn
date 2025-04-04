import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class UIRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx; // Main canvas context, likely unused here now
        
        // Instantiate the MinimapRenderer
        this.minimapRenderer = null; // Initialize as null
        const minimapElement = document.getElementById('minimap');
        if (minimapElement) {
            // Pass the element ID to the MinimapRenderer
            this.minimapRenderer = new MinimapRenderer('minimap'); 
        } else {
            console.warn("Minimap container element #minimap not found during UIRenderer initialization.");
        }
    }
    
    onResize() {
        // Re-initialize minimap canvas size if it exists
        if (this.minimapRenderer) {
            // MinimapRenderer now handles its own canvas resizing internally
            // We might need to trigger its internal resize logic if necessary,
            // but constructor and DOM structure handle initial size.
            // Let's assume CSS handles the container size and MinimapRenderer reads it.
            this.minimapRenderer.initializeCanvas(); // Re-run init to adjust canvas buffer size
        }
    }
    
    // Render canvas-based UI elements
    render(game) { 
        // Render minimap using the dedicated renderer
        // Pass the whole game object now
        if (this.minimapRenderer) { 
            this.minimapRenderer.render(game); 
        }
    }
    
    // Render debug info to the DOM overlay
    renderDebugInfo(debugData) { 
        const debugOverlay = document.getElementById('debug-overlay');
        if (!debugOverlay || !window.debug || !window.debug.isEnabled()) {
            if (debugOverlay && !debugOverlay.classList.contains('hidden')) {
                debugOverlay.classList.add('hidden');
            }
            return;
        }

        debugOverlay.classList.remove('hidden');

        let debugHTML = '';
        // Sort keys alphabetically for consistency
        const sortedKeys = Object.keys(debugData).sort();

        for (const key of sortedKeys) {
             const value = debugData[key];
             let displayValue = value;
             if (typeof value === 'number' && !Number.isInteger(value)) {
                 displayValue = value.toFixed(2);
             } else if (value === null) {
                 displayValue = 'null';
             } else if (value === undefined) {
                 displayValue = 'undefined';
             }
             // Simple HTML escaping for value display
             const escapedValue = String(displayValue).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            debugHTML += `<div><strong>${key}:</strong> ${escapedValue}</div>`;
        }

        // Add lighting system debug info if enabled
        if (this.renderer.lightingSystem && this.renderer.lightingSystem.enabled) {
            const light = this.renderer.lightingSystem;
            debugHTML += '<hr><strong>Lighting:</strong>';
            debugHTML += `<div>Time: ${(light.timeOfDay * 24).toFixed(2)} hr</div>`;
            debugHTML += `<div>Ambient: ${light.ambientLight.toFixed(2)}</div>`;
            debugHTML += `<div>Shadow H Offset: ${light.shadowHorizontalOffsetFactor.toFixed(2)}</div>`;
            debugHTML += `<div>Shadow V Offset: ${light.shadowVerticalOffsetFactor.toFixed(2)}</div>`;
            debugHTML += `<div>Shadow Visibility: ${light.shadowVisibility.toFixed(2)}</div>`; 
            debugHTML += `<div>Light RGB: (${light.lightColor.r},${light.lightColor.g},${light.lightColor.b})</div>`;
        }

        // Update innerHTML only if content has changed (basic optimization)
        if (debugOverlay.innerHTML !== debugHTML) {
             debugOverlay.innerHTML = debugHTML;
        }
    }
}