import { render } from "preact"
import { StrictMode } from "preact/compat"
// import { AppProvider } from "./app/provider";
import "./styles/app.css";
import { App } from "./app";
// Enable helpful runtime warnings only in development
if (import.meta.env.DEV) {
    import("preact/debug");
}

const root = document.getElementById("app");
if (!root)
    throw new Error('#app not found. Add <div id="app"></div> to index.html');

render(
    <StrictMode>
        {/* <AppProvider> */}
        <App />
        {/* </AppProvider> */}
    </StrictMode>,
    root
);
