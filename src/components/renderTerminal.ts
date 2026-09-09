export function renderTerminal(): string {
  return `
    <section class="terminal-shell" hidden data-view="docked" aria-label="Live research news terminal" data-paused="false" data-renderer="loading">
      <header class="terminal-desk-label">
        <span class="terminal-desk-identity"><i aria-hidden="true"></i><b>YZY / RESEARCH STATION</b></span>
        <div class="terminal-desk-controls">
          <button class="terminal-follow-toggle" type="button" data-terminal-toggle aria-pressed="false" aria-label="Pause live research log"><span data-terminal-control-label>HOLD</span></button>
          <button type="button" data-terminal-expand aria-label="Enlarge research terminal"><span data-terminal-expand-label>READ ↗</span></button>
        </div>
      </header>
      <div class="terminal-workstation">
        <canvas class="terminal-canvas" data-terminal-canvas tabindex="0" aria-label="Interactive 3D computer. Click each key or type on your keyboard. Press F1 for the five Linux commands. Drag the desk to turn the computer. F11 opens reading view."></canvas>
        <span class="terminal-loading" role="status">POWERING ON<span>YZY / 01</span></span>
      </div>
      <footer class="terminal-machine-status">
        <span data-terminal-feedback aria-live="polite">CLICK KEYS · F1 GUIDE · DRAG TO TURN</span>
        <span data-terminal-state>FOLLOW</span>
      </footer>
      <details class="terminal-readable">
        <summary>TEXT ARCHIVE <span>RESEARCH LOG ↓</span></summary>
        <div class="terminal-lines" data-terminal-lines role="log" aria-label="Research news, newest first" aria-live="off" tabindex="0"></div>
        <div class="terminal-cycle-boundary"><b>END OF NEWS</b><code>LOOP ↻</code></div>
        <div class="terminal-status"><span data-terminal-footer>follow mode · watching timeline</span><span data-terminal-buffer>BUFFER 07/09</span></div>
      </details>
    </section>`;
}
