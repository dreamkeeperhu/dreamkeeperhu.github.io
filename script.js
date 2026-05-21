const patternContainers = document.querySelectorAll(".hero-pattern");
const flipShell = document.querySelector(".flip-shell");
const heroTitle = document.querySelector(".hero-title");
const altLayer = document.querySelector(".alt-layer");
const aboutTrigger = document.querySelector(".about-trigger");
const backClose = document.querySelector(".back-close");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const themeToggle = document.querySelector(".theme-toggle");
const scrollProgress = document.querySelector(".scroll-progress");
const root = document.documentElement;
const prefersHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

function currentTheme() {
  return root.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist = true) {
  root.dataset.theme = theme;
  themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "切换浅色模式" : "切换深色模式"
  );
  if (persist) {
    persistTheme(theme);
  }
}

applyTheme(currentTheme(), false);

themeToggle?.addEventListener("click", () => {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
});

function handleSystemThemeChange(event) {
  if (!savedTheme()) {
    applyTheme(event.matches ? "dark" : "light", false);
  }
}

if (systemTheme.addEventListener) {
  systemTheme.addEventListener("change", handleSystemThemeChange);
} else if (systemTheme.addListener) {
  systemTheme.addListener(handleSystemThemeChange);
}

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
  if (!heroTitle || !altLayer) {
    return;
  }

  const rect = heroTitle.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  altLayer.style.clipPath = `circle(150px at ${x}px ${y}px)`;
}

function hideReveal(event) {
  if (!heroTitle || !altLayer) {
    return;
  }

  const rect = heroTitle.getBoundingClientRect();
  const x = event ? event.clientX - rect.left : rect.width / 2;
  const y = event ? event.clientY - rect.top : rect.height / 2;
  altLayer.style.clipPath = `circle(0 at ${x}px ${y}px)`;
}

if (prefersHover && heroTitle) {
  heroTitle.addEventListener("pointermove", setReveal);
  heroTitle.addEventListener("pointerleave", hideReveal);
}

if (aboutTrigger && flipShell) {
  aboutTrigger.addEventListener("click", () => {
    flipShell.classList.add("is-flipped");
    aboutTrigger.setAttribute("aria-expanded", "true");
    backClose?.setAttribute("aria-expanded", "true");
  });
  aboutTrigger.setAttribute("aria-expanded", "false");
}

if (backClose && flipShell) {
  backClose.addEventListener("click", () => {
    flipShell.classList.remove("is-flipped");
    aboutTrigger?.setAttribute("aria-expanded", "false");
    backClose.setAttribute("aria-expanded", "false");
  });
  backClose.setAttribute("aria-expanded", "false");
}

if (navToggle) {
  navToggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

const siteNav = document.querySelector(".site-nav");
function updateScrollState() {
  const y = window.scrollY;
  if (y > 40 && !siteNav.classList.contains("is-scrolled")) {
    siteNav.classList.add("is-scrolled");
  } else if (y <= 40 && siteNav.classList.contains("is-scrolled")) {
    siteNav.classList.remove("is-scrolled");
  }

  if (scrollProgress) {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollProgress.style.setProperty("--progress", `${Math.min(1, y / max)}`);
  }
}

window.addEventListener("scroll", updateScrollState, { passive: true });
window.addEventListener("resize", updateScrollState, { passive: true });
updateScrollState();

const spyLinks = [...navLinks].filter((link) => {
  const href = link.getAttribute("href") || "";
  return href.startsWith("#") && document.querySelector(href);
});

if (spyLinks.length) {
  const spyObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      spyLinks.forEach((link) => {
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${visible.target.id}`
        );
      });
    },
    {
      rootMargin: "-25% 0px -58% 0px",
      threshold: [0.08, 0.2, 0.45],
    }
  );

  spyLinks.forEach((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    if (section) spyObserver.observe(section);
  });
}

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

document.querySelectorAll(".row-list").forEach((list) => {
  const rows = list.querySelectorAll(".list-row");
  rows.forEach((row, i) => {
    row.style.setProperty("--stagger", `${i * 80}ms`);
  });
});

const rowObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        rowObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

document.querySelectorAll(".list-row").forEach((row) => {
  rowObserver.observe(row);
});

document.querySelectorAll("[data-copy-email]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    const email = link.dataset.copyEmail;
    if (!email || !navigator.clipboard) return;
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(email);
      link.classList.add("is-copied");
      window.setTimeout(() => link.classList.remove("is-copied"), 1600);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  });
});

if (coarsePointer) {
  document
    .querySelectorAll("a, button, .site-main, .site-footer")
    .forEach((element) => {
      element.addEventListener("contextmenu", (event) => event.preventDefault());
      element.addEventListener("selectstart", (event) => event.preventDefault());
      element.addEventListener("dragstart", (event) => event.preventDefault());
    });
}

hideReveal();
