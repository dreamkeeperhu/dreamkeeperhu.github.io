const patternContainers = document.querySelectorAll(".hero-pattern");
const flipShell = document.querySelector(".flip-shell");
const heroTitle = document.querySelector(".hero-title");
const altLayer = document.querySelector(".alt-layer");
const aboutTrigger = document.querySelector(".about-trigger");
const backClose = document.querySelector(".back-close");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;

function buildPattern(container) {
  const rows = 11;
  const copies = 18;
  const word = "H J H";

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "pattern-row";

    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      const span = document.createElement("span");
      span.textContent = word;
      row.appendChild(span);
    }

    container.appendChild(row);
  }
}

patternContainers.forEach(buildPattern);

function setReveal(event) {
  const rect = heroTitle.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  altLayer.style.clipPath = `circle(150px at ${x}px ${y}px)`;
}

function hideReveal(event) {
  const rect = heroTitle.getBoundingClientRect();
  const x = event ? event.clientX - rect.left : rect.width / 2;
  const y = event ? event.clientY - rect.top : rect.height / 2;
  altLayer.style.clipPath = `circle(0 at ${x}px ${y}px)`;
}

if (prefersHover) {
  heroTitle.addEventListener("pointermove", setReveal);
  heroTitle.addEventListener("pointerleave", hideReveal);
}

aboutTrigger.addEventListener("click", () => {
  flipShell.classList.add("is-flipped");
});

backClose.addEventListener("click", () => {
  flipShell.classList.remove("is-flipped");
});

navToggle.addEventListener("click", () => {
  document.body.classList.toggle("nav-open");
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

if (coarsePointer) {
  document
    .querySelectorAll("a, button, .hero-title, .showcase, .split-section, .contact-section")
    .forEach((element) => {
      element.addEventListener("contextmenu", (event) => event.preventDefault());
      element.addEventListener("selectstart", (event) => event.preventDefault());
      element.addEventListener("dragstart", (event) => event.preventDefault());
    });
}

hideReveal();
