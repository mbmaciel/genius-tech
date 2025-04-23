import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Importar i18n para internacionalização
import "./i18n";

// Montando a aplicação no elemento raiz
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);