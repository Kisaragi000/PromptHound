/**
 * Marks the page with `is-scrolling` while anything scrolls. Cards that lift on hover check it,
 * so they don't bob up and down as they pass under a still mouse during fast scrolling.
 */
export function trackScrolling(idleMs = 150): () => void {
  const root = document.documentElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onScroll = () => {
    root.classList.add('is-scrolling');
    clearTimeout(timer);
    timer = setTimeout(() => root.classList.remove('is-scrolling'), idleMs);
  };
  // Scroll events don't bubble; capturing sees every scrolling panel
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true });
    clearTimeout(timer);
    root.classList.remove('is-scrolling');
  };
}
