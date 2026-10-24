import { normalizeBasePath } from "../shared/paths.js";

export function normalizeReviewBaseUrl(value = "", appBasePath = "") {
  const input = value.trim();
  if (!input) return "";
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error(
      "REVIEW_BASE_URL must be an HTTP(S) URL, for example https://review.example.com/questions",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "REVIEW_BASE_URL must be HTTP(S) and cannot include credentials, queries or fragments",
    );
  }
  return (
    url.origin +
    (normalizeBasePath(url.pathname) || normalizeBasePath(appBasePath))
  );
}

export function withReviewUrl(survey, baseUrl, appBasePath = "") {
  return {
    ...survey,
    review_url: survey.review_token
      ? `${baseUrl || appBasePath}/review/${survey.review_token}`
      : null,
  };
}
