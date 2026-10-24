// One deployment prefix is shared by the Vite build, Node server and URL builders.
export function normalizeBasePath(value = "") {
  const path = value.trim();
  if (!path || path === "/") return "";
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/.test(path)) {
    throw new Error(
      "APP_BASE_PATH must be / or a path like /questions (without a domain, query, encoded characters or dot segments)",
    );
  }
  return path.replace(/\/$/, "");
}

export function pathWithinApp(pathname, basePath) {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  return pathname.startsWith(basePath + "/")
    ? pathname.slice(basePath.length)
    : null;
}
