import React from "react"
import { createRoot } from "react-dom/client"
import "./styles.css"
<<<<<<< Updated upstream
import App from "./App"
import './sync/autosync'
=======
import Layout from "./src/modules/app/Layout"
>>>>>>> Stashed changes

createRoot(document.getElementById("root")!)
  .render(
    <React.StrictMode>
<<<<<<< Updated upstream
      <App />
=======
      <Layout />
>>>>>>> Stashed changes
    </React.StrictMode>
  )
