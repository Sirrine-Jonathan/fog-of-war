// Konami Code Listener & Confetti
// Sound Attribution in comments below

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
  "Enter",
];

const SOUNDS = [
  {
    src: "public/sounds/783009__iceofdoom__hurray-excited-male.wav",
    attribution: `"Hurray!" - Excited Male by Iceofdoom -- https://freesound.org/s/783009/ -- License: Attribution 4.0`,
    html: `<a href="https://freesound.org/people/Iceofdoom/sounds/783009/">"Hurray!" - Excited Male</a> by <a href="https://freesound.org/people/Iceofdoom/">Iceofdoom</a> | License: <a href="https://creativecommons.org/licenses/by/4.0/">Attribution 4.0</a>`,
  },
  {
    src: "public/sounds/802629__jelloapocalypse__dull-hurray.mp3",
    attribution: `Dull Hurray by JelloApocalypse -- https://freesound.org/s/802629/ -- License: Attribution NonCommercial 4.0`,
    html: `<a href="https://freesound.org/people/JelloApocalypse/sounds/802629/">Dull Hurray</a> by <a href="https://freesound.org/people/JelloApocalypse/">JelloApocalypse</a> | License: <a href="https://creativecommons.org/licenses/by-nc/4.0/">Attribution NonCommercial 4.0</a>`,
  },
  // {
  //   src: "public/sounds/323697__reitanna__clear-throat7.wav",
  //   attribution: `clear throat7.wav by Reitanna -- https://freesound.org/s/323697/ -- License: Creative Commons 0`,
  //   html: `<a href="https://freesound.org/people/Reitanna/sounds/323697/">clear throat7.wav</a> by <a href="https://freesound.org/people/Reitanna/">Reitanna</a> | License: <a href="http://creativecommons.org/publicdomain/zero/1.0/">Creative Commons 0</a>`
  // },
];

/* 
  Doing the count tracking, reset number, and reset to number
  makes it easier to switch to letting the last sound play multiple times
  cause I may change it to do that at times, idk.
*/
const KONAMI_SOUND_STORAGE_KEY = "fog_of_war_konami_sounds_played";
const KONAMI_COUNT_STORAGE_KEY = "fog_of_war_konami_count";
const KONAMI_RESET_NUMBER = SOUNDS.length;
const KONAMI_RESET_TO_NUMBER = SOUNDS.length - 1;

// Track played Konami sounds in localStorage
function getPlayedKonamiSounds() {
  try {
    const played = localStorage.getItem(KONAMI_SOUND_STORAGE_KEY);
    return played ? JSON.parse(played) : [];
  } catch {
    return [];
  }
}

function setPlayedKonamiSound(idx) {
  const played = getPlayedKonamiSounds();
  const soundKey = "konami" + (idx + 1);
  if (!played.includes(soundKey)) {
    played.push(soundKey);
    localStorage.setItem(KONAMI_SOUND_STORAGE_KEY, JSON.stringify(played));
  }
}

// Track konami count in localStorage
function getCurrentKonamiCount() {
  const countStr = localStorage.getItem(KONAMI_COUNT_STORAGE_KEY);
  return countStr ? parseInt(countStr) : 0;
}

function setCurrentKonamiCount(count) {
  localStorage.setItem(KONAMI_COUNT_STORAGE_KEY, JSON.stringify(count));
}

function updateKonamiAttributions() {
  const played = getPlayedKonamiSounds(); // e.g. ["konami1", "konami2"]
  const ul = document.getElementById("sound-credit-list");
  if (!ul) return;

  // Remove all existing konami-credit <li>
  Array.from(ul.querySelectorAll("li.konami-credit")).forEach((li) =>
    li.remove(),
  );

  // Find the last regular sound-credit <li>
  const allLis = Array.from(ul.querySelectorAll("li.sound-credit"));
  let lastRegular = null;
  for (let i = allLis.length - 1; i >= 0; i--) {
    if (!allLis[i].classList.contains("konami-credit")) {
      lastRegular = allLis[i];
      break;
    }
  }

  // Insert konami attributions in played order (first played at top)
  let insertAfter = lastRegular;
  played.forEach((soundKey) => {
    const idx = parseInt(soundKey.replace("konami", "")) - 1;
    const sound = SOUNDS[idx];
    if (!sound) return;
    const li = document.createElement("li");
    li.id = "konami-attribution-" + soundKey;
    li.className = "sound-credit konami-credit";
    li.innerHTML = sound.html;
    li.style.display = "list-item";
    if (insertAfter && insertAfter.nextSibling) {
      ul.insertBefore(li, insertAfter.nextSibling);
    } else if (insertAfter) {
      ul.appendChild(li);
    } else {
      ul.appendChild(li);
    }
    insertAfter = li;
  });
}

// On page load, update attributions if present
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(updateKonamiAttributions, 0);
} else {
  window.addEventListener("DOMContentLoaded", updateKonamiAttributions);
}

let konamiIndex = 0;

function playKonamiSound() {
  let konamiCount = getCurrentKonamiCount();
  if (konamiCount >= KONAMI_RESET_NUMBER) {
    konamiCount = KONAMI_RESET_TO_NUMBER;
    setCurrentKonamiCount(konamiCount);
  }
  let soundIdx = konamiCount < 3 ? konamiCount : 2;
  const soundNames = ["konami1", "konami2", "konami3"];
  if (window.soundManager && typeof window.soundManager.play === "function") {
    window.soundManager.play(soundNames[soundIdx]);
    setCurrentKonamiCount(konamiCount + 1);
    setPlayedKonamiSound(soundIdx);
    updateKonamiAttributions();
  } else {
    console.error(
      "SoundManager is not available or play method is not defined.",
    );
  }
}

// Confetti: More density, staggered spawn, longer fall
function triggerConfetti() {
  const confettiColors = [
    "#ff0",
    "#f0f",
    "#0ff",
    "#0f0",
    "#f00",
    "#00f",
    "#fff",
  ];
  const confettiCount = 120; // increased density
  const spawnDuration = 1800; // ms, spread spawn over 1.8s
  const fallDurationMin = 3200; // ms
  const fallDurationMax = 4200; // ms

  const confettiContainer = document.createElement("div");
  confettiContainer.style.position = "fixed";
  confettiContainer.style.left = "0";
  confettiContainer.style.top = "0";
  confettiContainer.style.width = "100vw";
  confettiContainer.style.height = "100vh";
  confettiContainer.style.pointerEvents = "none";
  confettiContainer.style.zIndex = "9999";
  confettiContainer.className = "konami-confetti-container";
  document.body.appendChild(confettiContainer);

  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confetti = document.createElement("div");
      const size = Math.random() * 12 + 8;
      confetti.style.position = "absolute";
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size * 0.6}px`;
      confetti.style.background =
        confettiColors[Math.floor(Math.random() * confettiColors.length)];
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.top = `-${size}px`;
      confetti.style.opacity = "1";
      confetti.style.borderRadius = `${Math.random() * 50}%`;
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiContainer.appendChild(confetti);

      // Animate
      const duration =
        Math.random() * (fallDurationMax - fallDurationMin) + fallDurationMin;
      const xDrift = (Math.random() - 0.5) * 120;
      const fadeStart = window.innerHeight * 0.5;
      confetti.animate(
        [
          { top: `-${size}px`, left: confetti.style.left, opacity: 1 },
          {
            top: `${fadeStart}px`,
            left: `calc(${confetti.style.left} + ${xDrift / 2}px)`,
            opacity: 1,
          },
          {
            top: `${window.innerHeight + 40}px`,
            left: `calc(${confetti.style.left} + ${xDrift}px)`,
            opacity: 0,
          },
        ],
        {
          duration: duration,
          easing: "ease-in",
        },
      );
      setTimeout(() => {
        confetti.style.opacity = "0";
      }, duration);
    }, Math.random() * spawnDuration);
  }

  // Remove confetti after all have fallen
  setTimeout(
    () => {
      if (confettiContainer.parentNode)
        confettiContainer.parentNode.removeChild(confettiContainer);
    },
    spawnDuration + fallDurationMax + 500,
  );
}

window.addEventListener("keydown", function (e) {
  const key = e.code;
  if (key === KONAMI_CODE[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === KONAMI_CODE.length) {
      playKonamiSound();
      triggerConfetti();
      konamiIndex = 0;
    }
  } else {
    // If Enter is pressed as Start, allow both "Enter" and "NumpadEnter"
    if (
      konamiIndex === KONAMI_CODE.length - 1 &&
      (key === "NumpadEnter" || key === "Enter")
    ) {
      playKonamiSound();
      triggerConfetti();
      konamiIndex = 0;
    } else {
      // Reset if wrong key
      konamiIndex = key === KONAMI_CODE[0] ? 1 : 0;
    }
  }
});

window.konamiAttribution = SOUNDS.map((s) => s.attribution);