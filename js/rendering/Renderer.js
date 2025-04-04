import WorldRenderer from './WorldRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import EffectRenderer from './EffectRenderer.js';
import UIRenderer from './UIRenderer.js';
import SpriteManager from './SpriteManager.js';
import InteriorRenderer from './InteriorRenderer.js';
// Assuming VehicleBuildingRenderer is handled within BaseBuildingUI or Game.render
// import VehicleBuildingRenderer from './VehicleBuildingRenderer.js';

export default class Renderer {
    // Pass game instance to constructor
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game; // Store game reference

        // --- NEW: Shadow Mask Canvas ---
        this.shadowMaskCanvas = null;
        this.shadowMaskCtx = null;
        this.initShadowMask();
        // --- END NEW ---

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
        this.interiorRenderer = new InteriorRenderer(this, game);
        // VehicleBuildingRenderer instance is managed by BaseBuildingUI

        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
    }

    // --- NEW: Initialize Shadow Mask ---
    initShadowMask() {
        // Use OffscreenCanvas if available for potential performance benefits
        try {
             this.shadowMaskCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        } catch (e) {
             console.log("OffscreenCanvas not supported, falling back to regular canvas for shadow mask.");
             this.shadowMaskCanvas = document.createElement('canvas');
        }
        this.shadowMaskCanvas.width = this.canvas.width;
        this.shadowMaskCanvas.height = this.canvas.height;
        this.shadowMaskCtx = this.shadowMaskCanvas.getContext('2d');
    }
    // --- END NEW ---

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // --- NEW: Resize Shadow Mask ---
        if (this.shadowMaskCanvas) {
            this.shadowMaskCanvas.width = this.canvas.width;
            this.shadowMaskCanvas.height = this.canvas.height;
             // Re-get context if it's a regular canvas, as resizing might clear it
             if (!(this.shadowMaskCanvas instanceof OffscreenCanvas)) {
                 this.shadowMaskCtx = this.shadowMaskCanvas.getContext('2d');
             }
        } else {
             this.initShadowMask(); // Initialize if it wasn't created before
        }
        // --- END NEW ---

        // Notify all sub-renderers of resize if needed
        if (this.uiRenderer && this.uiRenderer.onResize) {
            this.uiRenderer.onResize();
        }
        // VehicleBuildingRenderer needs resize notification if its canvas isn't fixed size
        // Assuming its canvas size is determined internally for now
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

    renderShadows() {
        // --- UPDATED: Render shadows with gradient based on distance ---
        if (!this.game.shadowManager || !this.shadowMaskCtx || !this.shadowMaskCanvas) return;

        const shadowData = this.game.shadowManager.getShadowData(); // Get structured data
        const smCtx = this.shadowMaskCtx;
        const cameraZoom = this.camera.zoom;

        // 1. Clear the mask (fill with white for multiply blend mode)
        smCtx.fillStyle = 'white'; // Fully lit
        smCtx.fillRect(0, 0, this.shadowMaskCanvas.width, this.shadowMaskCanvas.height);

        // 2. Draw shadow polygons onto the mask
        if (shadowData.length > 0) {
            for (const data of shadowData) {
                const { polygon, caster, light } = data;
                if (!polygon || polygon.length < 3 || !caster || !light) continue;

                const screenPolygon = polygon.map(p => this.worldToScreen(p.x, p.y));
                const screenCasterPos = this.worldToScreen(caster.x, caster.y);
                const screenCasterRadius = (caster.size / 2 || 10) * cameraZoom;

                // Calculate max shadow distance from caster center in screen space
                let maxShadowScreenDistSq = 0;
                for (const p of screenPolygon) {
                    const dx = p.x - screenCasterPos.x;
                    const dy = p.y - screenCasterPos.y;
                    maxShadowScreenDistSq = Math.max(maxShadowScreenDistSq, dx * dx + dy * dy);
                }
                const maxShadowScreenDist = Math.max(screenCasterRadius + 1, Math.sqrt(maxShadowScreenDistSq)); // Ensure radius is at least caster radius

                // Calculate light-caster distance in world space
                const lightCasterDist = Math.sqrt((light.x - caster.x)**2 + (light.y - caster.y)**2);

                // Determine shadow base opacity based on distance
                const minOpacity = 0.05; // Minimum opacity for distant lights
                const maxOpacity = 0.75; // Maximum opacity for close lights (less than 1 for softer look)
                let baseOpacity = maxOpacity;
                if (light.range > 0) {
                    baseOpacity = Math.max(minOpacity, maxOpacity * (1.0 - (lightCasterDist / (light.range * 1.5)))); // Fade faster
                }
                baseOpacity = Math.min(maxOpacity, Math.max(minOpacity, baseOpacity));

                // Determine the shade value (0=black, 255=white)
                // Use a slightly lighter shade than pure black for softer effect
                 const baseShade = 60; // Base dark color (instead of 0)
                 const shadeValue = Math.floor(baseShade + (255 - baseShade) * (1 - baseOpacity));

                // Create radial gradient (centered on caster)
                // Starts slightly inside the caster radius, extends to max shadow extent
                const gradientRadiusStart = screenCasterRadius * 0.8;
                const gradientRadiusEnd = maxShadowScreenDist;

                // Avoid creating gradient if start/end radii are too close or invalid
                if (gradientRadiusEnd <= gradientRadiusStart) {
                    continue;
                }

                let gradient = null;
                try {
                     gradient = smCtx.createRadialGradient(
                        screenCasterPos.x, screenCasterPos.y, gradientRadiusStart,
                        screenCasterPos.x, screenCasterPos.y, gradientRadiusEnd
                    );

                    // Add color stops (for multiply blend mode)
                    // Darker near caster (lower shadeValue), white at the edge
                    gradient.addColorStop(0, `rgb(${shadeValue}, ${shadeValue}, ${shadeValue})`);
                    gradient.addColorStop(1, 'rgb(255, 255, 255)'); // White means no effect at the edge

                } catch (e) {
                     // Catch potential errors like invalid radius in createRadialGradient
                     console.error("Error creating shadow gradient:", e, {
                         x: screenCasterPos.x, y: screenCasterPos.y, r0: gradientRadiusStart, r1: gradientRadiusEnd
                     });
                     continue; // Skip rendering this shadow if gradient fails
                }

                // Draw the polygon using the gradient
                smCtx.fillStyle = gradient;
                smCtx.beginPath();
                smCtx.moveTo(screenPolygon[0].x, screenPolygon[0].y);
                for (let i = 1; i < screenPolygon.length; i++) {
                    smCtx.lineTo(screenPolygon[i].x, screenPolygon[i].y);
                }
                smCtx.closePath();
                smCtx.fill();

                 // Debug rendering on the mask (optional)
                 if (this.game.shadowManager.debug) {
                     smCtx.strokeStyle = `rgba(255, 0, 255, ${baseOpacity})`; // Magenta border, opacity indicates calculated base
                     smCtx.lineWidth = 1;
                     smCtx.stroke();
                     smCtx.fillStyle = 'magenta';
                     smCtx.font = '8px monospace';
                     smCtx.fillText(baseOpacity.toFixed(2), screenCasterPos.x, screenCasterPos.y);
                 }
            }
        }

        // 3. Apply the shadow mask to the main canvas
        // This happens *after* world and entities are drawn, before effects/UI
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply'; // Use multiply to darken areas
        this.ctx.drawImage(this.shadowMaskCanvas, 0, 0);
        this.ctx.restore(); // Restore default composite operation ('source-over')
        // --- END UPDATED ---
    }

    renderEffects() {
        const currentTime = performance.now();
        // Calculate delta based on the game's rawDeltaTime for accuracy
        const delta = this.game.rawDeltaTime * 1000; // Convert seconds to ms

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
}