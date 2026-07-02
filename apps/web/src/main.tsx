import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { checkAppwriteConnection } from "./lib/appwrite.js";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// One-off connectivity check on startup — see checkAppwriteConnection() for what it logs
// when the endpoint/project pair is (or isn't) configured/reachable.
void checkAppwriteConnection();
