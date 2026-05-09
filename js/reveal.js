/**
 * reveal.js
 * ─────────────────────────────────────────────────────
 * Scroll-triggered fade-in for any element with
 * class="reveal".
 *
 * How it works:
 *   IntersectionObserver watches every .reveal element.
 *   When one enters the viewport, .visible is added,
 *   triggering the CSS transition in base.css.
 *
 *   Siblings inside the same parent get a staggered
 *   delay so cards animate in sequence rather than
 *   all at once.
 *
 * To adjust:
 *   threshold → how much of the element must be visible
 *               before it triggers (0 = any pixel, 1 = fully visible)
 *   staggerMs → delay between sibling reveals (ms)
 * ─────────────────────────────────────────────────────
 */

(function () {

  const THRESHOLD  = 0.12;  // 12% visible → trigger
  const STAGGER_MS = 80;    // ms delay between siblings

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: THRESHOLD });

  document.querySelectorAll('.reveal').forEach(el => {
    observer.observe(el);

    // Stagger siblings inside the same parent container
    const siblings = [...el.parentElement.querySelectorAll('.reveal')];
    const index    = siblings.indexOf(el);
    el.style.transitionDelay = (index * STAGGER_MS) + 'ms';
  });

})();
