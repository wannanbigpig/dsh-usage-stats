const root = document.documentElement;
let frame = 0;

/* Pointer-follow grid highlight in the hero. */
let point = { x: 50, y: 20 };
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

/* Scroll-in reveal, counting stats, command copy buttons. */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(node) {
  const target = Number(node.dataset.count);
  if (!Number.isSafeInteger(target) || target <= 0) { node.textContent = String(target); return; }
  const duration = 1100;
  const startedAt = performance.now();
  const format = (value) => value.toLocaleString("en-US");
  if (reduceMotion) { node.textContent = format(target); return; }
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("in");
    for (const counter of entry.target.querySelectorAll("[data-count]")) {
      if (counter.dataset.counted !== "true") {
        counter.dataset.counted = "true";
        countUp(counter);
      }
    }
    observer.unobserve(entry.target);
  }
}, { threshold: 0.18 });
for (const node of document.querySelectorAll(".reveal")) observer.observe(node);

for (const button of document.querySelectorAll(".copy[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.classList.add("done");
      const previous = button.textContent;
      button.textContent = "已复制";
      setTimeout(() => {
        button.classList.remove("done");
        button.textContent = previous;
      }, 1400);
    } catch {
      button.textContent = "复制失败";
      setTimeout(() => { button.textContent = "复制"; }, 1400);
    }
  });
}

/* Featured-swap gallery: clicking (or pressing Enter on) a thumbnail trades
   it with the large featured shot, so the pointed-at image expands while the
   previous hero recedes. View Transitions smooth the trade when supported. */
const featured = document.querySelector(".gallery figure.featured");
if (featured) {
  const featuredImg = featured.querySelector("img");
  const featuredCaption = featured.querySelector("figcaption");
  for (const thumb of document.querySelectorAll(".gallery figure.thumb")) {
    const trade = () => {
      const thumbImg = thumb.querySelector("img");
      const thumbCaption = thumb.querySelector("figcaption");
      if (thumbImg.src === featuredImg.src) return;
      const swap = () => {
        [featuredImg.src, thumbImg.src] = [thumbImg.src, featuredImg.src];
        [featuredImg.alt, thumbImg.alt] = [thumbImg.alt, featuredImg.alt];
        [featuredCaption.textContent, thumbCaption.textContent] = [thumbCaption.textContent, featuredCaption.textContent];
      };
      if (document.startViewTransition) document.startViewTransition(swap);
      else swap();
    };
    thumb.addEventListener("click", trade);
    thumb.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        trade();
      }
    });
  }
}
