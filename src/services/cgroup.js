const os = require("node:os");
const fs = require("node:fs");

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
    const cpuMax = readCgroupFile("/sys/fs/cgroup/cpu.max");
    if (cpuMax) {
        const [quota, period] = cpuMax.split(/\s+/).map(Number);
        if (quota > 0 && period > 0) return quota / period;
    }

    const quota = Number(readCgroupFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
    const period = Number(readCgroupFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
    if (quota > 0 && period > 0) return quota / period;

    return os.availableParallelism ? os.availableParallelism() : os.cpus().length;
}

// ==========================================
// MEMORY
// ==========================================

function memoryLimit() {
    const v2 = readCgroupFile("/sys/fs/cgroup/memory.max");
    if (v2 && v2 !== "max") {
        const value = Number(v2);
        if (Number.isFinite(value) && value > 0) return value;
    }

    const v1 = Number(readCgroupFile("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
    if (v1 > 0 && v1 < Number.MAX_SAFE_INTEGER) return v1;

    return os.totalmem();
}

function memoryUsed() {
    const v2 = Number(readCgroupFile("/sys/fs/cgroup/memory.current"));
    if (Number.isFinite(v2) && v2 > 0) return v2;

    const v1 = Number(readCgroupFile("/sys/fs/cgroup/memory/memory.usage_in_bytes"));
    if (Number.isFinite(v1) && v1 > 0) return v1;

    return process.memoryUsage().rss;
}

// ==========================================
// CPU USAGE
// ==========================================

function cpuUsedMicros() {
    const cpuStat = readCgroupFile("/sys/fs/cgroup/cpu.stat");
    if (cpuStat) {
        const match = cpuStat.match(/usage_usec\s+(\d+)/);
        if (match) return Number(match[1]);
    }

    const cpuAccounting = Number(readCgroupFile("/sys/fs/cgroup/cpuacct/cpuacct.usage"));
    if (Number.isFinite(cpuAccounting) && cpuAccounting > 0) return cpuAccounting / 1000;

    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000;
}

module.exports = { cpuCapacity, memoryLimit, memoryUsed, cpuUsedMicros };
