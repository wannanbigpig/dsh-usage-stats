const root = document.documentElement;
let frame = 0;
let point = { x: 50, y: 16 };

document.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  point = {
    x: Math.round((event.clientX / window.innerWidth) * 100),
    y: Math.round((event.clientY / window.innerHeight) * 100)
  };
  if (frame) return;
  frame = requestAnimationFrame(() => {
    root.style.setProperty("--pointer-x", `${point.x}%`);
    root.style.setProperty("--pointer-y", `${point.y}%`);
    frame = 0;
  });
}, { passive: true });
