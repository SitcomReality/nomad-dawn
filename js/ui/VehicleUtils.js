// New file to handle vehicle detection and utility functions
export default class VehicleUtils {
    constructor(game) {
        this.game = game;
    }

    /**
     * Finds the closest vehicle to a given position within a maximum distance
     * @param {number} x - X coordinate to search from
     * @param {number} y - Y coordinate to search from
     * @param {number} maxDistance - Maximum distance to consider
     * @returns {Object|null} The closest vehicle or null if none found
     */
    findNearestVehicle(x, y, maxDistance = 100) {
        if (!this.game.entities) {
            console.error("Entities manager not available");
            return null;
        }

        const vehicles = this.game.entities.getByType('vehicle');
        
        console.log(`[VehicleUtils] Searching for vehicles near (${x}, ${y}). Found ${vehicles.length} vehicles:`);
        vehicles.forEach(v => {
            const dx = v.x - x;
            const dy = v.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            console.log(`  Vehicle ${v.id} at (${v.x.toFixed(0)}, ${v.y.toFixed(0)}), distance: ${dist.toFixed(1)}`);
        });

        if (vehicles.length === 0) {
            return null;
        }

        let closestVehicle = null;
        let closestDistanceSq = maxDistance * maxDistance; // Use squared distance for efficiency
        
        for (const vehicle of vehicles) {
            const dx = vehicle.x - x;
            const dy = vehicle.y - y;
            const distanceSq = dx * dx + dy * dy;
            
            if (distanceSq < closestDistanceSq) {
                closestDistanceSq = distanceSq;
                closestVehicle = vehicle;
            }
        }
        
        if (closestVehicle) {
            console.log(`[VehicleUtils] Found closest vehicle: ${closestVehicle.id} at distance ${Math.sqrt(closestDistanceSq).toFixed(1)}`);
        } else {
            console.log(`[VehicleUtils] No vehicle found within distance ${maxDistance}`);
        }
        
        return closestVehicle;
    }

    /**
     * Checks if a vehicle has the minimum properties needed for interaction
     * @param {Object} vehicle - The vehicle to validate
     * @returns {boolean} Whether the vehicle is valid
     */
    isValidVehicle(vehicle) {
        return vehicle && 
               vehicle.id && 
               typeof vehicle.x === 'number' && 
               typeof vehicle.y === 'number' &&
               typeof vehicle.size === 'number';
    }
}