import { pathWithinApp } from "../shared/paths.js";

export const APP_BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");
export const appUrl = (path = "/") => APP_BASE_PATH + path;
export const currentRoute = () =>
  pathWithinApp(window.location.pathname, APP_BASE_PATH);
