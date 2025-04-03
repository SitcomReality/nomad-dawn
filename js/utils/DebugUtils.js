export class DebugUtils {
    constructor() {
        this.enabled = false; // Start with debug disabled by default
        this.debugData = {};
        this.logHistory = [];
        this.maxLogHistory = 100;

        // Initialize with URL parameters (URL params can still override default)
        this.parseUrlParams();

         // Show or hide debug overlay initially based on enabled state
         const debugOverlay = document.getElementById('debug-overlay');
         if (debugOverlay) {
             debugOverlay.classList.toggle('hidden', !this.enabled);
         }

        // Register keyboard shortcut for toggling debug mode
        window.addEventListener('keydown', (e) => {
            // Use backtick (`) key to toggle debug mode
            if (e.code === 'Backquote' && e.ctrlKey) {
                this.toggle();
                e.preventDefault();
            }
        });
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('debug')) {
            // URL param overrides the default setting
            this.enabled = urlParams.get('debug') !== 'false';
        }
    }

    toggle() {
        this.enabled = !this.enabled;

        // Show or hide debug overlay
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) {
            debugOverlay.classList.toggle('hidden', !this.enabled);
        }

        this.log(`Debug mode ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }

    isEnabled() {
        return this.enabled;
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const logEntry = {
            timestamp,
            message,
            data,
            type: 'log'
        };

        this.logHistory.unshift(logEntry);
        if (this.logHistory.length > this.maxLogHistory) {
            this.logHistory.pop();
        }

        if (this.enabled) {
            console.log(`[${timestamp}] ${message}`, data || '');
        }
    }

    warn(message, data = null) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const logEntry = {
            timestamp,
            message,
            data,
            type: 'warn'
        };

        this.logHistory.unshift(logEntry);
        if (this.logHistory.length > this.maxLogHistory) {
            this.logHistory.pop();
        }

        console.warn(`[${timestamp}] ${message}`, data || '');
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const logEntry = {
            timestamp,
            message,
            error,
            type: 'error'
        };

        this.logHistory.unshift(logEntry);
        if (this.logHistory.length > this.maxLogHistory) {
            this.logHistory.pop();
        }

        console.error(`[${timestamp}] ${message}`, error || '');
    }

    updateStats(stats) {
        this.debugData = {
            ...this.debugData,
            ...stats
        };
    }

    getDebugData() {
        return this.debugData;
    }

    getLogHistory() {
        return this.logHistory;
    }

    clearLogHistory() {
        this.logHistory = [];
    }

    // Measure execution time of a function
    measureTime(fn, label = 'Execution time') {
        if (!this.enabled) return fn();

        const start = performance.now();
        const result = fn();
        const end = performance.now();

        this.log(`${label}: ${(end - start).toFixed(2)}ms`);
        return result;
    }

    // Measure execution time of an async function
    async measureTimeAsync(promiseFn, label = 'Async execution time') {
        if (!this.enabled) return promiseFn();

        const start = performance.now();
        const result = await promiseFn();
        const end = performance.now();

        this.log(`${label}: ${(end - start).toFixed(2)}ms`);
        return result;
    }
}