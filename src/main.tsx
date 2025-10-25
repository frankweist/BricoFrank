import React from "react"
import { createRoot } from "react-dom/client"
import "./styles.css"
// 🔑 CORRECCIÓN CRÍTICA: Cambiamos 'import App' por 'import { App }'
import { App } from "./App.tsx" 
import './sync/autosync'

createRoot(document.getElementById("root")!)
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
