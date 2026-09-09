import { createRoot } from "react-dom/client";
import { StandaloneRoot } from "../../desktop/src/standalone/StandaloneRoot";
import "../../desktop/src/styles.css";

createRoot(document.getElementById("root")!).render(<StandaloneRoot appId="blackwhale" />);
