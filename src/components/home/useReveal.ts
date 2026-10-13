import { useEffect, useRef, useState } from 'react';

/**
 * Entrance state for a piece of the homepage.
 *  - static:  no entrance; the resting layout (prerendered HTML, reduced motion,
 *             or anything already on screen when the page loads)
 *  - armed:   waiting below the viewport in its starting pose
 *  - visible: scrolled in; the entrance animation runs once
 */
export type Reveal = 'static' | 'armed' | 'visible';

/** Class suffix for a reveal state; empty while static so nothing is hidden. */
export const revealClass = (reveal: Reveal): string => (reveal === 'static' ? '' : ` is-${reveal}`);

/** True once the visitor has asked for reduced motion; false while prerendering. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Tracks whether an element is on screen and gives it a one-time entrance.
 *
 * Elements render fully visible until this runs, so prerendered HTML and
 * visitors without scripting never see hidden content. The entrance is only
 * armed for elements that start below the viewport, and never for
 * reduced-motion visitors.
 */
export function useReveal<T extends HTMLElement>(threshold: number, rootMargin = '0px') {
  const ref = useRef<T>(null);
  const [reveal, setReveal] = useState<Reveal>('static');
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startsBelowViewport = element.getBoundingClientRect().top >= window.innerHeight;
    if (!reducedMotion && startsBelowViewport) setReveal('armed');

    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setReveal(current => (current === 'armed' ? 'visible' : current));
    }, { threshold, rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, reveal, inView };
}
