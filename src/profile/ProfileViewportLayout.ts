/** Biography and room stay together; optional cabinetry yields on narrow screens. */
export function initializeProfileViewport() {
  const scene = document.querySelector<HTMLElement>('#profile')!;
  const top = scene.querySelector<HTMLElement>('.profile-top')!;
  const frame = document.createElement('div');
  frame.className = 'profile-card-viewport';
  top.before(frame);
  frame.append(top);
  let queued = false;

  const fit = () => {
    queued = false;
    const compact = innerWidth < 1000;
    const panorama = innerWidth >= 2000 && innerWidth / innerHeight > 2.15;
    const changed = scene.classList.contains('profile-compact') !== compact;
    scene.classList.toggle('profile-panorama', panorama);
    scene.classList.toggle('profile-compact', compact);
    if (compact) {
      top.style.removeProperty('transform');
      frame.style.removeProperty('height');
      scene.style.removeProperty('--profile-left');
    } else if (panorama) {
      scene.style.removeProperty('--profile-left');
      const room = scene.querySelector<HTMLElement>('.future-slot')!;
      frame.style.height = `${room.getBoundingClientRect().height}px`;
      top.style.removeProperty('transform');
      scene.style.setProperty('--profile-row-height', frame.style.height);
    } else {
      const style = getComputedStyle(scene);
      const available = innerHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const usable = scene.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 12;
      const natural = top.offsetHeight;
      // Preserve readable scale and let content own height on unusually short screens.
      // Matching both columns' proportions avoids letterboxing inside the cabinet.
      const contentSlope = natural / 640 + .75;
      const balancedWidth = (usable - 20 - 1.1 * 32) / (1 + 1.1 * contentSlope);
      const width = Math.max(balancedWidth * .98, Math.min(balancedWidth, (available - 64) / contentSlope));
      scene.style.setProperty('--profile-left', `${Math.round(width + 20)}px`);
      const scale = frame.clientWidth / 640;
      frame.style.height = `${natural * scale}px`;
      top.style.transform = `scale(${scale})`;
    }
    if (changed) window.dispatchEvent(new CustomEvent('cabin:view-change'));
  };
  const schedule = () => {
    if (!queued) { queued = true; requestAnimationFrame(fit); }
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(frame);
  observer.observe(top);
  observer.observe(scene.querySelector('.future-slot')!);
  window.addEventListener('resize', schedule);
  document.fonts.ready.then(schedule);
  schedule();
}
