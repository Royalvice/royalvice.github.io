import "./styles/arcade.css";
import { siteContent } from "./content/site";
import { appState, setActiveSection } from "./app/state";
import { renderApplication, initializeApplication } from "./components/renderApp";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Application root was not found.");
}

appRoot.innerHTML = renderApplication(siteContent);

initializeApplication({
  content: siteContent,
  state: appState,
  onSectionChange: setActiveSection
}).catch((error) => {
  console.error("Research Arcade failed to initialize", error);
});
