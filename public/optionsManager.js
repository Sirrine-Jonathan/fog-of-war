class OptionsManager {
    constructor() {
        this.options = this.loadOptions();
    }

    loadOptions() {
        const saved = localStorage.getItem('gameOptions');
        const defaults = {
            sound: false
        };
        
        if (saved) {
            try {
                return { ...defaults, ...JSON.parse(saved) };
            } catch (e) {
                console.log('Failed to parse saved options, using defaults');
                return defaults;
            }
        }
        return defaults;
    }

    saveOptions() {
        localStorage.setItem('gameOptions', JSON.stringify(this.options));
    }

    get(key) {
        return this.options[key];
    }

    set(key, value) {
        this.options[key] = value;
        this.saveOptions();
    }

    toggle(key) {
        this.set(key, !this.get(key));
        return this.get(key);
    }
}

// Create global options manager instance
const optionsManager = new OptionsManager();
