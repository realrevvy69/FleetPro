// Theme controller: toggles `light` class on <html>, persists to localStorage.
const STORAGE_KEY = "fleetpro_theme";

export const THEMES = ["dark", "light"];

export const getStoredTheme = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "dark"; // default
};

export const applyTheme = (theme) => {
  const html = document.documentElement;
  if (theme === "light") html.classList.add("light");
  else html.classList.remove("light");
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  // Update PWA theme color so the address bar matches
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#FFFFFF" : "#0A0A0A");
};

export const initTheme = () => {
  applyTheme(getStoredTheme());
};
