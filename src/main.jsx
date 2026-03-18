import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { EventTypeProvider } from "./context/EventTypeContext";
import { initSessionDiagnostics, recordDiagnosticError } from "./lib/sessionDiagnostics";
import "./styles.css";

initSessionDiagnostics({
  appVersion: String(import.meta.env.VITE_APP_VERSION || "0.1.0")
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      recordDiagnosticError(err, {
        surface: "service-worker",
        action: "register"
      });
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <EventTypeProvider>
      <App />
    </EventTypeProvider>
  </React.StrictMode>
);
