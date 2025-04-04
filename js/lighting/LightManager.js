// New file: js/lighting/LightManager.js
import LightSource from './LightSource.js';

/**
 * Manages light sources and calculates lighting effects at specific points.
 */
export default class LightManager {
    constructor(game) {
        this.game = game;
        this.globalAmbientLight = { r: 50, g: 50, b: 70 }; // Default dark ambient light
        this.maxLightRange = 1000; // Maximum range to check for lights
    }

    /**
     * Calculates the combined effect of nearby lights at a given world position.
     * @param {number} x - World X coordinate.
     * @param {number} y - World Y coordinate.
     * @returns {{color: {r: number, g: number, b: number}, intensity: number}} The resulting light color and intensity (0-1).
     */
    calculateLightAt(x, y) {
        if (!this.game?.entities) {
            return { color: this.globalAmbientLight, intensity: 1.0 }; // Fallback
        }

        const nearbyLights = this.game.entities.getLightsInRadius(x, y, this.maxLightRange);

        // Start with global ambient light
        let finalR = this.globalAmbientLight.r;
        let finalG = this.globalAmbientLight.g;
        let finalB = this.globalAmbientLight.b;

        // Add contributions from nearby point lights
        for (const light of nearbyLights) {
            if (light.lightType !== 'point') continue; // Skip non-point lights for now

            const dx = light.x - x;
            const dy = light.y - y;
            const distanceSq = dx * dx + dy * dy;
            const rangeSq = light.range * light.range;

            if (distanceSq < rangeSq) {
                // Calculate light attenuation (e.g., inverse square falloff, clamped)
                const distance = Math.sqrt(distanceSq);
                // Using linear falloff for simplicity for now: 1 at center, 0 at edge
                const falloff = Math.max(0, 1.0 - (distance / light.range));
                const intensity = light.intensity * falloff;

                // Add light color contribution (simple additive blending for now)
                finalR += light.color.r * intensity;
                finalG += light.color.g * intensity;
                finalB += light.color.b * intensity;
            }
        }

        // Clamp final color values
        finalR = Math.min(255, Math.max(0, finalR));
        finalG = Math.min(255, Math.max(0, finalG));
        finalB = Math.min(255, Math.max(0, finalB));

        // Intensity calculation is tricky with multiple lights.
        // For tinting, we mainly need the final color.
        // We can derive an approximate "intensity" from the brightness.
        const averageBrightness = (finalR + finalG + finalB) / 3;
        const maxBrightness = Math.max(finalR, finalG, finalB);
        // Normalize intensity based on max component? Or average? Let's use max for now.
        const finalIntensity = Math.min(1.0, maxBrightness / 255); // Rough intensity estimate

        return {
            color: { r: Math.floor(finalR), g: Math.floor(finalG), b: Math.floor(finalB) },
            intensity: finalIntensity
        };
    }

    // Method to update global ambient light (e.g., for day/night cycle)
    setGlobalAmbientLight(color) {
        this.globalAmbientLight = color;
    }

    // Future: Could add methods to handle different light types (spotlights, directional)
    // Future: Could incorporate shadow casting calculation
}