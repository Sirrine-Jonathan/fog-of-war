class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.enabled = true;
        this.volume = 0.5;
        this.audioUnlocked = false;
        this.loadSounds();
        this.setupAudioUnlock();
    }

    setupAudioUnlock() {
        // Unlock audio on first user interaction
        const unlockAudio = () => {
            if (!this.audioUnlocked) {
                // Play a silent sound to unlock audio context
                this.sounds.forEach(sound => {
                    sound.play().then(() => {
                        sound.pause();
                        sound.currentTime = 0;
                    }).catch(() => {});
                });
                this.audioUnlocked = true;
                console.log('Audio unlocked');
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
            }
        };
        
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
    }

    loadSounds() {
        // Load the unowned territory capture sound
        this.loadSound('captureUnowned', '/sounds/167338__willy_ineedthatapp_com__pup_fat.mp3');
        // Load the error sound for insufficient armies
        this.loadSound('insufficientArmies', '/sounds/201767__waveplaysfx__short-burst-of-noise.wav');
        // Load mountain adjacent move sound
        this.loadSound('mountainAdjacent', '/sounds/652499__krokulator__error2.wav');
        // Load move to owned territory sound
        this.loadSound('moveToOwned', '/sounds/41633__datasoundsample__littleclick.wav');
        // Load attack city/tower sound
        this.loadSound('attackSpecial', '/sounds/54408__korgms2000b__phone-beep-1.wav');
        // Load capture enemy territory sound
        this.loadSound('attackEnemy', '/sounds/101271__wouterhisschemoller__noisy_sound_1.wav');
        // Load attack enemy general sound
        this.loadSound('attackGeneral', '/sounds/610280__brickdeveloper171__retro-hit-sound.wav');
        // Load successful city/tower capture sound
        this.loadSound('captureSpecial', '/sounds/318968__djm62__successarpeggio.flac');
        // Load successful general capture sound
        this.loadSound('captureGeneral', '/sounds/253177__suntemple__retro-accomplished-sfx.wav');
        // Load player's general captured sound (failure)
        this.loadSound('generalLost', '/sounds/333785__aceofspadesproduc100__8-bit-failure-sound.wav');
        // Load player's territory captured sound
        this.loadSound('territoryLost', '/sounds/686365__faircashew__au.mp3');
        // Load army bonus sound (turn 25 multiples)
        this.loadSound('armyBonus', '/sounds/791034__janalvent__1-i-5-808.mp3');
    }

    loadSound(name, path) {
        const audio = new Audio(path);
        audio.volume = this.volume;
        audio.preload = 'auto';
        this.sounds.set(name, audio);
    }

    play(soundName) {
        if (!optionsManager.get('sound') || !optionsManager.get('sounds')[soundName]) return;
        
        const sound = this.sounds.get(soundName);
        if (sound) {
            console.log('🔊', soundName);
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Sound failed:', soundName));
        }
    }

    showAttribution() {
        const attribution = document.getElementById('soundAttribution');
        if (attribution) {
            attribution.style.display = 'block';
            setTimeout(() => {
                attribution.style.display = 'none';
            }, 3000);
        }
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.sounds.forEach(sound => {
            sound.volume = this.volume;
        });
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();
