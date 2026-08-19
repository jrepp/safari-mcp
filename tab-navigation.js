export function shouldWaitForNewTabNavigation(url) {
  return Boolean(url && url !== "about:blank");
}
