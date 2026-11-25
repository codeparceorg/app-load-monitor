
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { Worker } = require("node:worker_threads");

// ==========================================
// CONFIGURATION
// ==========================================

const PORT = Number(process.env.PORT || 3000);

const TARGET_CPU = Number(process.env.TARGET_CPU || 61);
const TARGET_MEMORY = Number(process.env.TARGET_MEMORY || 61);

const PUBLIC_DIR = path.join(__dirname, "public");

const WORKER_FILE = path.join(__dirname, "worker.js");

// ==========================================
// CGROUP HELPERS
// ==========================================

function readCgroupFile(file) {
    try {
        return fs.readFileSync(file, "utf8").trim();
    } catch {
        return null;
    }
}

// ==========================================
// CPU CAPACITY
// ==========================================

function cpuCapacity() {
    // Cgroups v2
    const cpuMax = readCgroupFile("/sys/fs/cgroup/cpu.max");

    if (cpuMax) {
        const [quota, period] = cpuMax.split(/\s+/).map(Number);

        if (quota > 0 && period > 0) {
            return quota / period;
        }
    }

    // Cgroups v1
    const quota = Number(
        readCgroupFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us")
    );

    const period = Number(
        readCgroupFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us")
    );

    if (quota > 0 && period > 0) {
        return quota / period;
    }

    return os.availableParallelism
        ? os.availableParallelism()
        : os.cpus().length;
}

// ==========================================
// MEMORY CAPACITY
// ==========================================

function memoryLimit() {
    // Cgroups v2
    const v2 = readCgroupFile("/sys/fs/cgroup/memory.max");

    if (v2 && v2 !== "max") {
        const value = Number(v2);

        if (Number.isFinite(value) && value > 0) {
            return value;
        }
    }

    // Cgroups v1
    const v1 = Number(
        readCgroupFile(
            "/sys/fs/cgroup/memory/memory.limit_in_bytes"
        )
    );

    if (v1 > 0 && v1 < Number.MAX_SAFE_INTEGER) {
        return v1;
    }

    return os.totalmem();
}

function memoryUsed() {
    // Cgroups v2
    const v2 = Number(
        readCgroupFile("/sys/fs/cgroup/memory.current")
    );

    if (Number.isFinite(v2) && v2 > 0) {
        return v2;
    }

    // Cgroups v1
    const v1 = Number(
        readCgroupFile(
            "/sys/fs/cgroup/memory/memory.usage_in_bytes"
        )
    );

    if (Number.isFinite(v1) && v1 > 0) {
        return v1;
    }

    return process.memoryUsage().rss;
}

// ==========================================
// CPU USAGE
// ==========================================

function cpuUsedMicros() {
    // Cgroups v2
    const cpuStat = readCgroupFile("/sys/fs/cgroup/cpu.stat");

    if (cpuStat) {
        const match = cpuStat.match(/usage_usec\s+(\d+)/);

        if (match) {
            return Number(match[1]);
        }
    }

    // Cgroups v1
    const cpuAccounting = Number(
        readCgroupFile("/sys/fs/cgroup/cpuacct/cpuacct.usage")
    );

    if (Number.isFinite(cpuAccounting) && cpuAccounting > 0) {
        return cpuAccounting / 1000;
    }

    // Fallback
    const usage = process.cpuUsage();

    return (usage.user + usage.system) / 1000;
}

// ==========================================
// WORKERS
// ==========================================

const capacity = Math.max(0.01, cpuCapacity());

const workerCount = Math.max(1, Math.ceil(capacity));

const duty = Math.min(
    0.95,
    (TARGET_CPU / 100) * capacity / workerCount
);

const workers = [];

function startWorkers() {
    for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(WORKER_FILE, {
            workerData: {
                duty
            }
        });

        worker.on("error", error => {
            console.error("Worker error:", error);
        });

        worker.on("exit", code => {
            if (code !== 0) {
                console.error(`Worker exited with code ${code}`);
            }
        });

        workers.push(worker);
    }
}

// ==========================================
// MEMORY LOAD
// ==========================================

const memoryBuffers = [];

const MAX_MEMORY = memoryLimit();

const MEMORY_TARGET_BYTES =
    MAX_MEMORY * (TARGET_MEMORY / 100);

const MEMORY_CHUNK = 8 * 1024 * 1024;

const MAX_ALLOC_PERCENT = 0.5; // No reservar más del 50 % de la memoria del task

function allocateMemory() {
    const allocated = memoryBuffers.reduce((total, buffer) => total + buffer.length, 0);
    // Límite máximo en bytes basado en el porcentaje
    const maxAllocBytes = MAX_MEMORY * MAX_ALLOC_PERCENT;
    if (allocated >= maxAllocBytes) {
        return; // ya hemos alcanzado el límite deseado
    }

    const remaining = maxAllocBytes - allocated;
    const chunkSize = Math.min(MEMORY_CHUNK, remaining);
    // Touch memory pages to make allocation resident.
    memoryBuffers.push(Buffer.alloc(chunkSize, 1));
}


// ==========================================
// METRICS
// ==========================================

let previousCpuUsage = cpuUsedMicros();
let previousTimestamp = process.hrtime.bigint();

function getMetrics() {
    const currentCpuUsage = cpuUsedMicros();
    const currentTimestamp = process.hrtime.bigint();

    const cpuDelta = currentCpuUsage - previousCpuUsage;

    const timeDeltaMicros =
        Number(currentTimestamp - previousTimestamp) / 1000;

    previousCpuUsage = currentCpuUsage;
    previousTimestamp = currentTimestamp;

    // CPU percentage relative to the container CPU quota.
    const cpuPercent = timeDeltaMicros > 0
        ? (cpuDelta / timeDeltaMicros / capacity) * 100
        : 0;

    const currentMemory = memoryUsed();

    const memoryPercent =
        (currentMemory / MAX_MEMORY) * 100;

    return {
        cpu: {
            percent: Math.max(0, cpuPercent)
        },

        memory: {
            usedMB: currentMemory / 1024 / 1024,
            limitMB: MAX_MEMORY / 1024 / 1024,
            percent: Math.max(0, memoryPercent)
        },

        capacity: {
            cpus: capacity
        },

        targets: {
            cpu: TARGET_CPU,
            memory: TARGET_MEMORY
        }
    };
}

// ==========================================
// STATIC FILE SERVER
// ==========================================

const routes = {
    "/": "index.html",
    "/css/styles.css": "css/styles.css",
    "/css/codeparce.png": "css/codeparce.png",
    "/js/app.js": "js/app.js"
};

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png"
};

function serveStatic(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    const file = routes[pathname];

    if (!file) {
        return false;
    }

    const filePath = path.join(PUBLIC_DIR, file);

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end("File not found");
            return;
        }

        res.writeHead(200, {
            "Content-Type": contentTypes[path.extname(filePath)],
            "Cache-Control": "no-store"
        });

        res.end(content);
    });

    return true;
}

// ==========================================
// HTTP SERVER
// ==========================================

const server = http.createServer((req, res) => {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (req.method !== "GET") {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
    }

    // Metrics endpoint
    if (pathname === "/metrics") {
        res.writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*"
        });

        res.end(JSON.stringify(getMetrics()));
        return;
    }

    // Static frontend
    if (serveStatic(req, res)) {
        return;
    }

    res.writeHead(404, {
        "Content-Type": "text/plain"
    });

    res.end("Not found");
});

// ==========================================
// START APPLICATION
// ==========================================

async function start() {
    startWorkers();

    setInterval(allocateMemory, 500);

    server.listen(PORT, "0.0.0.0", () => {
        console.log("--------------------------------");
        console.log("Docker Resource Monitor");
        console.log("--------------------------------");
        console.log(`Listening on port ${PORT}`);
        console.log(`CPU quota: ${capacity.toFixed(2)} cores`);
        console.log(`CPU target: ${TARGET_CPU}%`);
        console.log(`Memory limit: ${(MAX_MEMORY / 1024 / 1024).toFixed(0)} MB`);
        console.log(`Memory target: ${TARGET_MEMORY}%`);
        console.log("--------------------------------");
    });
}

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

async function shutdown() {
    console.log("Shutting down...");

    for (const worker of workers) {
        await worker.terminate();
    }

    server.close(() => {
        console.log("Server stopped");
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start().catch(error => {
    console.error("Application startup error:", error);
    process.exit(1);
});
