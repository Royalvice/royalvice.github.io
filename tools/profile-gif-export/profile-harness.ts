// The production markup and animation, without unrelated 3D scene lifecycles.
import '../../src/styles/arcade.css';
import '../../src/styles/cabin-room.css';
import { siteContent } from '../../src/content/site';
import { renderApplication, initializeSiggraphMachine } from '../../src/components/renderApp';
const root=document.querySelector<HTMLElement>('#app')!;
root.innerHTML=renderApplication(siteContent);
root.querySelectorAll('.scene:not(#profile),.gallery-stage,.future-slot,.chapter-nav,.scene-nav,canvas').forEach(node=>node.remove());
initializeSiggraphMachine(false);
