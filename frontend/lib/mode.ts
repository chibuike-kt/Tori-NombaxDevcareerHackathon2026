export type NombaMode = "live" | "test";

const MODE_KEY = "tori_mode";
const MODE_EVENT = "tori-mode-change";

export function getMode(): NombaMode {
  if (typeof window === "undefined") return "live";
  return localStorage.getItem(MODE_KEY) === "test" ? "test" : "live";
}

export function setMode(mode: NombaMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent<NombaMode>(MODE_EVENT, { detail: mode }));
}

export function onModeChange(handler: (mode: NombaMode) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<NombaMode>).detail);
  window.addEventListener(MODE_EVENT, listener);
  return () => window.removeEventListener(MODE_EVENT, listener);
}
