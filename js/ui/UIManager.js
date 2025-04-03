import InventoryUI from './InventoryUI.js';
import BaseBuildingUI from './BaseBuildingUI.js';

export default class UIManager {
    constructor(game) {
        this.game = game;
        
        // Initialize UI components
        this.inventory = new InventoryUI(game);
        this.baseBuilding = new BaseBuildingUI(game);
        
        // Set up notifications system
        this.notifications = {
            container: null,
            queue: [],
            maxNotifications: 3,
            
            init: () => {
                // Create notifications container if it doesn't exist
                let container = document.getElementById('notifications-container');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'notifications-container';
                    document.getElementById('ui-overlay').appendChild(container);
                }
                this.notifications.container = container;
            },
            
            show: (message, type = 'info', duration = 3000) => {
                const notification = document.createElement('div');
                notification.className = `notification notification-${type}`;
                notification.innerHTML = `<div class="notification-content">${message}</div>`;
                
                // Add to queue
                this.notifications.queue.push(notification);
                
                // Manage notifications display
                this.notifications.update();
                
                // Auto-remove after duration
                setTimeout(() => {
                    notification.classList.add('fade-out');
                    setTimeout(() => {
                        this.notifications.remove(notification);
                    }, 300); // Fade out transition time
                }, duration);
            },
            
            remove: (notification) => {
                const index = this.notifications.queue.indexOf(notification);
                if (index !== -1) {
                    this.notifications.queue.splice(index, 1);
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    this.notifications.update();
                }
            },
            
            update: () => {
                // Clear container
                if (!this.notifications.container) return;
                this.notifications.container.innerHTML = '';
                
                // Show only the most recent notifications up to maxNotifications
                const visibleNotifications = this.notifications.queue.slice(-this.notifications.maxNotifications);
                
                // Add to DOM
                for (const notification of visibleNotifications) {
                    this.notifications.container.appendChild(notification);
                }
            }
        };
        
        // Initialize notifications system
        this.notifications.init();
        
        // Set up key bindings and event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Global key handlers for UI
        document.addEventListener('keydown', (e) => {
            // Only handle keys if not in text input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Prevent default for game control keys
            if (['KeyI', 'KeyB', 'Escape'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }
    
    update() {
        // Update all UI components if needed
        if (this.inventory.isVisible) {
            this.inventory.update();
        }
        
        if (this.baseBuilding.isVisible) {
            this.baseBuilding.update();
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        this.notifications.show(message, type, duration);
    }
}