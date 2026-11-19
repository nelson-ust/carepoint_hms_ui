import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/app/providers/AppProviders";
import "@/styles/globals.css";
import "@/styles/dx.css";

import { reloadOnceForStaleChunk } from "@/lib/lazyWithReload";

// Self-heal stale lazy-chunk references after a deploy. Vite fires
// "vite:preloadError" when it cannot preload a dynamically imported chunk
// (its hashed file was replaced by a newer build); reload once to pull the
// fresh index.html + current chunks instead of surfacing an error screen.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
);
