// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { routerConfig } from "./router";
import { AuthProvider } from "./auth/AuthContext";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={routerConfig} />
      <ToastContainer
        position="top-right"
        autoClose={2500}
        theme="dark"
        style={{ marginTop: "140px" }}   // 👈 empurra pra baixo
      />

    </AuthProvider>
  </React.StrictMode>
);
