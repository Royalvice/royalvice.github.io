(function () {
  const root = document.getElementById("sprite-rail");
  if (!root) return;

  const tracks = ["top", "bottom", "left", "right", "bottom", "top"];
  const hues = ["0deg", "38deg", "94deg", "165deg", "238deg", "304deg"];

  tracks.forEach((track, index) => {
    const sprite = document.createElement("span");
    sprite.className = `sprite-runner ${track}`;
    sprite.style.setProperty("--sprite-url", "url('../sprites/helper-bot.png')");
    sprite.style.setProperty("--duration", `${16 + index * 3}s`);
    sprite.style.setProperty("--hue", hues[index]);
    sprite.style.animationDelay = `${index * -2.7}s`;
    if (track === "left" || track === "right") {
      sprite.style.transform = "rotate(90deg)";
    }
    root.appendChild(sprite);
  });
})();
