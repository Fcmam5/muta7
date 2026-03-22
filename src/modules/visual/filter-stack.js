(() => {
  const root = document.documentElement;
  const initialFilter = root.style.filter || "";
  const filters = new Map();

  function recompute() {
    const stack = [initialFilter, ...filters.values()]
      .filter(Boolean)
      .join(" ")
      .trim();
    root.style.filter = stack;
  }

  const api = {
    set(key, value) {
      if (!key) return;
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized) {
        filters.delete(key);
      } else {
        filters.set(key, normalized);
      }
      recompute();
    },
    delete(key) {
      if (!key) return;
      if (!filters.has(key)) return;
      filters.delete(key);
      recompute();
    },
    clear() {
      filters.clear();
      recompute();
    },
    getCurrent() {
      return root.style.filter;
    },
  };

  Object.defineProperty(globalThis, "Muta7FilterStack", {
    value: api,
    configurable: false,
    writable: false,
  });
})();
