import MinimapRenderer from '../ui/MinimapRenderer.js';

export default class UIRenderer {
    constructor(renderer, game) {
        this.renderer = renderer;
        this.game = game;
        this.ctx = renderer.ctx;
        
        // Instantiate the MinimapRenderer
        if (document.getElementById('minimap')) {
            this.minimapRenderer = new MinimapRenderer('minimap');
        } else {
            console.warn("Minimap container not found during UIRenderer initialization.");
            this.minimapRenderer = null;
        }
    }
    
    onResize() {
        // Re-initialize minimap canvas size if it exists
        if (this.minimapRenderer) {
            this.minimapRenderer.initializeCanvas();
        }
    }
    
    render(game) {
        // Render minimap using the dedicated renderer
        if (this.minimapRenderer && game.world && game.player) {
            this.minimapRenderer.render(
                game.world,
                game.player,
                game.entities.getAll(),
                this.renderer.camera,
                this.renderer.canvas.width,
                this.renderer.canvas.height
            );
        }
    }
    
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
        for (const [key, value] of Object.entries(debugData)) {
            let displayValue = value;
            if (typeof value === 'number' && !Number.isInteger(value)) {
                displayValue = value.toFixed(2);
            }
            debugHTML += `<div><strong>${key}:</strong> ${displayValue}</div>`;
        }

        // Add lighting system debug info if enabled
        if (this.renderer.lightingSystem && this.renderer.lightingSystem.enabled) {
            const light = this.renderer.lightingSystem;
            debugHTML += '<hr><strong>Lighting:</strong>';
            debugHTML += `<div>Time: ${(light.timeOfDay * 24).toFixed(2)} hr</div>`;
            debugHTML += `<div>Ambient: ${light.ambientLight.toFixed(2)}</div>`;
            debugHTML += `<div>Shadow Dir: (${light.shadowDirection.x.toFixed(2)}, ${light.shadowDirection.y.toFixed(2)})</div>`;
        }

        debugOverlay.innerHTML = debugHTML;
    }
}
