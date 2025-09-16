const STORAGE_KEY = 'fog_of_war_options';

class OptionsManager {
    constructor() {
        this.options = this.loadOptions();
    }

    loadOptions() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const defaults = {
            sound: false,
            sounds: {
                captureUnowned: true,
                moveToOwned: true,
                mountainAdjacent: true,
                insufficientArmies: true,
                attackSpecial: true,
                captureSpecial: true,
                attackEnemy: true,
                attackGeneral: true,
                captureGeneral: true,
                generalLost: true,
                territoryLost: true,
                armyBonus: true,
                gameStart: true
            }
        };
        
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { 
                    ...defaults, 
                    ...parsed,
                    sounds: { ...defaults.sounds, ...parsed.sounds }
                };
            } catch (e) {
                console.log('Failed to parse saved options, using defaults');
                return defaults;
            }
        }
        return defaults;
    }

    saveOptions() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.options));
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
