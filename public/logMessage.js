// Game Title
(function () {
  const title = "%cFog of War";
  const titleStyle =
    "color: #bada55; font-weight: bold; font-size: 2em; background: #000; border-radius: 3px; padding: 6px 12px";
  const subtitle = "%cBy Jonathan Sirrine";
  const subtitleStyle =
    "color: #bada55; font-weight: bold; font-size: 1.1em; background: #000; border-radius: 3px; padding: 6px 12px";
  function logMsg() {
    console.log(title, titleStyle);
    console.log(subtitle, subtitleStyle);
  }
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(logMsg, 0);
  } else {
    window.addEventListener("DOMContentLoaded", logMsg);
  }
})();

// Konami Whisper
(function () {
  const msg = "%cPsst 👉 https://en.wikipedia.org/wiki/Konami_Code";
  const style =
    "color: #bada55; font-weight: bold; font-size: 1.1em; background: #000; border-radius: 3px; padding: 6px 12px";
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(() => console.log(msg, style), 0);
  } else {
    window.addEventListener("DOMContentLoaded", () => console.log(msg, style));
  }
})();
