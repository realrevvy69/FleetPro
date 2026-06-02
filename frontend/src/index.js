import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/i18n";
import { initTheme } from "@/lib/theme";
import App from "@/App";

initTheme();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
