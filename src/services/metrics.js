const { cpuCapacity, memoryLimit, memoryUsed, cpuUsedMicros } = require("./cgroup");

const capacity = Math.max(0.01, cpuCapacity());
const MAX_MEMORY = memoryLimit();

let previousCpuUsage = cpuUsedMicros();
let previousTimestamp = process.hrtime.bigint();

function getMetrics(targetCpu, targetMemory) {
    const currentCpuUsage = cpuUsedMicros();
    const currentTimestamp = process.hrtime.bigint();

    const cpuDelta = currentCpuUsage - previousCpuUsage;
    const timeDeltaMicros = Number(currentTimestamp - previousTimestamp) / 1000;

    previousCpuUsage = currentCpuUsage;
    previousTimestamp = currentTimestamp;

    const cpuPercent = timeDeltaMicros > 0
        ? (cpuDelta / timeDeltaMicros / capacity) * 100
        : 0;

    const currentMemory = memoryUsed();
    const memoryPercent = (currentMemory / MAX_MEMORY) * 100;

    return {
        cpu: { percent: Math.max(0, cpuPercent) },
        memory: {
            usedMB: currentMemory / 1024 / 1024,
            limitMB: MAX_MEMORY / 1024 / 1024,
            percent: Math.max(0, memoryPercent),
        },
        capacity: { cpus: capacity },
        targets: { cpu: targetCpu, memory: targetMemory },
    };
}

module.exports = { getMetrics, capacity, MAX_MEMORY };
