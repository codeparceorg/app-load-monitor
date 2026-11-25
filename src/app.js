const express = require("express");
const path = require("node:path");
const config = require("./config");
const routes = require("./routes");
const { startWorkers, stopWorkers } = require("./services/workers");
const { allocateMemory } = require("./services/memory");
const { capacity, MAX_MEMORY } = require("./services/metrics");

// ==========================================
// EXPRESS APP
// ==========================================

const app = express();

// Servir archivos estáticos (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, "..", "public"), {
    setHeaders: (res) => {
        res.set("Cache-Control", "no-store");
    },
}));

// Rutas de la API
app.use(routes);

// ==========================================
// WORKERS & MEMORY LOAD
// ==========================================

const workerCount = Math.max(1, Math.ceil(capacity));
const duty = Math.min(0.95, (config.TARGET_CPU / 100) * capacity / workerCount);

// ==========================================
// START & SHUTDOWN
// ==========================================

let server;

async function start() {
    startWorkers(workerCount, duty);
    setInterval(() => allocateMemory(MAX_MEMORY), 500);

    server = app.listen(config.PORT, "0.0.0.0", () => {
        console.log("--------------------------------");
        console.log("Docker Resource Monitor (Express)");
        console.log("--------------------------------");
        console.log(`Listening on port http://localhost:${config.PORT}`);
        console.log(`CPU quota: ${capacity.toFixed(2)} cores`);
        console.log(`CPU target: ${config.TARGET_CPU}%`);
        console.log(`Memory limit: ${(MAX_MEMORY / 1024 / 1024).toFixed(0)} MB`);
        console.log(`Memory target: ${config.TARGET_MEMORY}%`);
        console.log("--------------------------------");
    });
}

async function shutdown() {
    console.log("Shutting down...");
    await stopWorkers();

    if (server) {
        server.close(() => {
            console.log("Server stopped");
            process.exit(0);
        });
    }

    setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start().catch((error) => {
    console.error("Application startup error:", error);
    process.exit(1);
});
