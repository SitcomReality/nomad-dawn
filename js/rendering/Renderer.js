import WorldRenderer from './WorldRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import EffectRenderer from './EffectRenderer.js';
import UIRenderer from './UIRenderer.js';
import SpriteManager from './SpriteManager.js';

export default class Renderer {
    // Pass game instance to constructor
    constructor(canvas, game) { 
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game; // Store game reference
        this.resizeCanvas();
        this.setupResizeListener();
        
        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            targetZoom: 1,
            zoomSpeed: 0.1,
            // Add target reference for following
            target: null 
        };
        
        // Initialize specialized renderers (pass game instance)
        this.spriteManager = new SpriteManager(this, game);
        this.worldRenderer = new WorldRenderer(this, game);
        this.entityRenderer = new EntityRenderer(this, game);
        this.effectRenderer = new EffectRenderer(this, game);
        this.uiRenderer = new UIRenderer(this, game);
        
        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
        
        // Lighting system properties (placeholders for future day/night cycle)
        this.lightingSystem = {
            enabled: true, // Enable the lighting system by default
            timeOfDay: 0.25, // 0 to 1, 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
            ambientLight: 1.0, // Will be calculated
            shadowDirection: { x: 1, y: 1 }, // Will be calculated
            shadowLength: 0, // Will be calculated
            lightColor: { r: 255, g: 255, b: 255 } // Will be calculated
        };
        
        // Initial lighting calculation
        this.updateLightingSystem();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Notify all sub-renderers of resize if needed
        if (this.uiRenderer && this.uiRenderer.onResize) {
            this.uiRenderer.onResize();
        }
    }
    
    setupResizeListener() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Update camera position to follow a target (entity or fixed point)
    updateCamera(target = null) {
        // Update target if provided
        if (target) {
             this.camera.target = target;
        }
        
        // Determine target coordinates
        const targetX = this.camera.target ? this.camera.target.x : 0;
        const targetY = this.camera.target ? this.camera.target.y : 0;
        
        // Smoothly interpolate camera position to target
        // Use a faster interpolation if target is null (e.g., recentering in guest mode)
        const lerpFactor = this.camera.target ? 0.1 : 0.05; 
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;
        
        // Smoothly interpolate zoom
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSpeed;
    }

    // Set target zoom level (can be called externally, e.g., by mouse wheel input)
    setTargetZoom(targetZoom) {
         // Clamp zoom level
         this.camera.targetZoom = Math.max(0.2, Math.min(3, targetZoom));
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2;
        return { x: screenX, y: screenY };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        return { x: worldX, y: worldY };
    }
    
    // Main render function that delegates to specialized renderers
    // Now takes cameraTarget directly instead of player
    renderWorld(world, cameraTarget) { 
        if (!world) return;
        
        // Update camera to follow the target (passed from Game.render)
        this.updateCamera(cameraTarget); 
        
        // Calculate view dimensions in world coordinates
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;
        
        // Use specialized world renderer
        // Pass cameraTarget coordinates for chunk loading/visibility checks
        this.worldRenderer.render(world, cameraTarget, viewWidthWorld, viewHeightWorld); 
    }
    
    // Takes localPlayer (can be null) for highlighting purposes
    renderEntities(entities, localPlayer) { 
        this.entityRenderer.render(entities, localPlayer);
    }
    
    renderEffects() {
        const currentTime = performance.now();
        const delta = currentTime - this.lastFrameTime;
        
        // Only update/render if time has passed
        if (delta <= 0) return; 
        
        this.effectRenderer.render(delta, currentTime);
    }
    
    // Renders canvas UI elements (Minimap)
    renderUI(game) { 
        this.uiRenderer.render(game);
    }

    // Renders debug DOM overlay
    renderDebugInfo(debugData) {
        this.uiRenderer.renderDebugInfo(debugData);
    }
    
    createEffect(type, x, y, options = {}) {
        this.effectRenderer.createEffect(type, x, y, options);
    }
    
    // --- Lighting System Methods ---
    setTimeOfDay(time) {
        // Only update if time actually changed
        if (this.lightingSystem.timeOfDay !== time) {
            this.lightingSystem.timeOfDay = Math.max(0, Math.min(1, time));
            this.updateLightingSystem(); // Recalculate lighting values
        }
    }
    
    updateLightingSystem() {
        if (!this.lightingSystem.enabled) {
            // Set defaults if disabled
            this.lightingSystem.ambientLight = 1.0;
            this.lightingSystem.shadowDirection = { x: 1, y: 1 };
            this.lightingSystem.shadowLength = 0;
            this.lightingSystem.lightColor = { r: 255, g: 255, b: 255 };
            return;
        }
        
        const time = this.lightingSystem.timeOfDay; // 0 to 1

        // Calculate sun position angle (0 at dawn, PI/2 at noon, PI at dusk, 3PI/2 at midnight)
        // We shift the phase so 0.5 (noon) corresponds to angle PI/2 (straight down)
        const sunAngle = (time * Math.PI * 2) - (Math.PI / 2);

        // Calculate shadow direction (opposite to sun direction projected onto ground)
        // Negate x component for typical top-down shadow direction
        this.lightingSystem.shadowDirection = {
            x: -Math.cos(sunAngle),
            y: -Math.sin(sunAngle) // y points downwards in canvas, so sun rising from east (angle 0) casts shadow west (-x)
        };

        // Calculate shadow length based on sun height (max at dawn/dusk, min at noon)
        // Use sin of the angle (0 at dawn/dusk, 1 at noon)
        const sunHeightFactor = Math.sin(time * Math.PI); // Peaks at 1 when time = 0.5 (noon)
         // Inverse relationship: longer shadows when sun is low
        this.lightingSystem.shadowLength = 30 * (1 - sunHeightFactor);

        // Calculate ambient light (darkest at midnight, brightest at noon)
        // Use cosine wave shifted (peaks at 0.5)
        const ambientFactor = Math.cos( (time - 0.5) * Math.PI * 2) * 0.5 + 0.5; // 0 at midnight, 1 at noon
        this.lightingSystem.ambientLight = Math.max(0.1, ambientFactor); // Ensure minimum ambient light

        // Calculate light color (e.g., warmer at sunrise/sunset, whiter at noon)
        const noonR = 255, noonG = 255, noonB = 255;
        const twilightR = 255, twilightG = 180, twilightB = 100; // Warmer color

        // Blend between noon and twilight based on how close to noon we are
        const noonProximity = Math.cos( (time - 0.5) * Math.PI ); // 1 at noon, -1 at midnight, 0 at dawn/dusk
        const blendFactor = Math.max(0, noonProximity); // Use only positive part (0 to 1 for noon half)

        let r = twilightR + (noonR - twilightR) * blendFactor;
        let g = twilightG + (noonG - twilightG) * blendFactor;
        let b = twilightB + (noonB - twilightB) * blendFactor;

        // Reduce intensity further during deep night
        const nightFade = Math.max(0, Math.cos(time * Math.PI * 2)) * 0.5 + 0.5; // 1 near midnight, 0.5 near dawn/dusk
        const nightIntensityFactor = Math.max(0.2, nightFade); // Clamp minimum

        r *= nightIntensityFactor;
        g *= nightIntensityFactor;
        b *= nightIntensityFactor;


        this.lightingSystem.lightColor = {
            r: Math.floor(Math.max(0, Math.min(255, r))),
            g: Math.floor(Math.max(0, Math.min(255, g))),
            b: Math.floor(Math.max(0, Math.min(255, b)))
        };
    }
}