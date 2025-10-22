import { render } from "preact"
import { StrictMode } from "preact/compat"
import "./styles/app.css";
// import { App } from "./app";
import { AppRouter } from "./app/router";
// Enable helpful runtime warnings only in development
if (import.meta.env.DEV) {
    import("preact/debug");
}

const root = document.getElementById("app");
if (!root)
    throw new Error('#app not found. Add <div id="app"></div> to index.html');

render(
    <StrictMode>
        <AppRouter />
    </StrictMode>,
    root
);
