import WorldRenderer from './WorldRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import EffectRenderer from './EffectRenderer.js';
import UIRenderer from './UIRenderer.js';
import SpriteManager from './SpriteManager.js';

export default class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.resizeCanvas();
        this.setupResizeListener();
        
        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            targetZoom: 1,
            zoomSpeed: 0.1
        };
        
        // Initialize specialized renderers
        this.spriteManager = new SpriteManager(this, game);
        this.worldRenderer = new WorldRenderer(this, game);
        this.entityRenderer = new EntityRenderer(this, game);
        this.effectRenderer = new EffectRenderer(this, game);
        this.uiRenderer = new UIRenderer(this, game);
        
        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
        
        // Lighting system properties (placeholders for future day/night cycle)
        this.lightingSystem = {
            enabled: false,
            timeOfDay: 0, // 0 to 1, 0 = midnight, 0.5 = noon
            ambientLight: 1.0, // Full brightness by default
            shadowDirection: { x: 1, y: 1 }, // Direction shadows will cast
            shadowLength: 0, // Length of shadows
            lightColor: { r: 255, g: 255, b: 255 } // Color of light
        };
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
    
    // Update camera position to follow a target (usually the player)
    updateCamera(targetX, targetY, targetZoom = null) {
        // Smoothly interpolate camera position to target
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
        
        // Update zoom if provided
        if (targetZoom !== null) {
            // Clamp zoom level
            this.camera.targetZoom = Math.max(0.2, Math.min(3, targetZoom));
        }
        
        // Smoothly interpolate zoom
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSpeed;
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
    renderWorld(world, player) {
        if (!world || !player) return;
        
        // Update camera to follow player
        this.updateCamera(player.x, player.y);
        
        // Calculate view dimensions in world coordinates
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;
        
        // Use specialized world renderer
        this.worldRenderer.render(world, player, viewWidthWorld, viewHeightWorld);
    }
    
    renderEntities(entities, player) {
        this.entityRenderer.render(entities, player);
    }
    
    renderEffects() {
        const currentTime = performance.now();
        const delta = currentTime - this.lastFrameTime;
        
        if (delta <= 0) return;
        
        this.effectRenderer.render(delta, currentTime);
    }
    
    renderUI(game) {
        this.uiRenderer.render(game);
    }
    
    createEffect(type, x, y, options = {}) {
        this.effectRenderer.createEffect(type, x, y, options);
    }
    
    renderDebugInfo(debugData) {
        this.uiRenderer.renderDebugInfo(debugData);
    }
    
    // Future methods for lighting system
    setTimeOfDay(time) {
        this.lightingSystem.timeOfDay = Math.max(0, Math.min(1, time));
        this.updateLightingSystem();
    }
    
    updateLightingSystem() {
        // Will be implemented when day/night cycle is added
        // Calculate shadow direction, light color, and ambient light based on time of day
        const timeOfDay = this.lightingSystem.timeOfDay;
        
        // Example calculations (placeholder for future implementation)
        // Calculate sun angle (0 = east, 0.25 = south, 0.5 = west, 0.75 = north)
        const sunAngle = (timeOfDay * Math.PI * 2) - Math.PI/2;
        
        // Set shadow direction (opposite to sun direction)
        this.lightingSystem.shadowDirection = {
            x: -Math.cos(sunAngle),
            y: -Math.sin(sunAngle)
        };
        
        // Calculate shadow length (longest at sunrise/sunset, shortest at noon/midnight)
        const dayProgress = Math.abs((timeOfDay % 1) - 0.5) * 2; // 0 at noon/midnight, 1 at sunrise/sunset
        this.lightingSystem.shadowLength = 20 * dayProgress;
        
        // Set ambient light (brightest at noon, darkest at midnight)
        const dayNightCycle = Math.sin(timeOfDay * Math.PI * 2 - Math.PI/2) * 0.5 + 0.5;
        this.lightingSystem.ambientLight = Math.max(0.2, dayNightCycle); // Minimum ambient light of 0.2
        
        // Set light color (warm at sunrise/sunset, neutral at noon, cool at night)
        const r = 255;
        const g = Math.floor(200 + 55 * dayNightCycle);
        const b = Math.floor(150 + 105 * dayNightCycle);
        this.lightingSystem.lightColor = { r, g, b };
    }
}