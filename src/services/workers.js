const path = require("node:path");
const { Worker } = require("node:worker_threads");

const WORKER_FILE = path.join(__dirname, "..", "..", "worker.js");

const workers = [];

function startWorkers(workerCount, duty) {
    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(WORKER_FILE, { workerData: { duty } });

        worker.on("error", (error) => {
            console.error("Worker error:", error);
        });

        worker.on("exit", (code) => {
            if (code !== 0) console.error(`Worker exited with code ${code}`);
        });

        workers.push(worker);
    }
}

async function stopWorkers() {
    for (const worker of workers) {
        await worker.terminate();
    }
}

module.exports = { startWorkers, stopWorkers };
