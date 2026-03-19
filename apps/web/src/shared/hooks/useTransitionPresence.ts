import {useEffect, useState} from 'react';

/**
 * Lightweight AnimatePresence replacement.
 * Keeps the element mounted during its CSS exit transition, then unmounts it.
 *
 * @param isOpen - Whether the element should be visible
 * @returns { mounted, visible, onTransitionEnd }
 *   - mounted: whether to render the element in the DOM
 *   - visible: whether to apply the "visible" CSS state
 *   - onTransitionEnd: attach to the animated element to unmount after exit
 */
export function useTransitionPresence(isOpen: boolean) {
  // Track whether the element should remain in the DOM
  const [mounted, setMounted] = useState(isOpen);

  // When isOpen becomes true, we need to mount. When it becomes false,
  // we keep mounted=true until the transition completes (onTransitionEnd).
  if (isOpen && !mounted) {
    setMounted(true);
  }

  // visible drives the CSS class. On first mount frame, visible=false because
  // mounted just became true but isOpen was already true — the browser needs
  // one paint with the "enter" state before we apply "visible".
  // We use a second state to delay visibility by one render.
  const [visibleDeferred, setVisibleDeferred] = useState(false);

  useEffect(() => {
    if (isOpen && mounted && !visibleDeferred) {
      const id = requestAnimationFrame(() => setVisibleDeferred(true));
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, mounted, visibleDeferred]);

  if (!isOpen && visibleDeferred) {
    setVisibleDeferred(false);
  }

  const onTransitionEnd = () => {
    if (!isOpen) {
      setMounted(false);
    }
  };

  return {mounted, visible: visibleDeferred && isOpen, onTransitionEnd};
}
