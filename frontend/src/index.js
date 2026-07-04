import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// NOTE: Service Worker registration lives in public/index.html (/sw.js).
// The old duplicate registration of /service-worker.js was removed because:
// 1) Two SWs fighting over the same scope caused re-install churn on every load.
// 2) /service-worker.js used a cache-FIRST strategy for index.html with a fixed
//    cache name, which could serve a stale app shell forever.
