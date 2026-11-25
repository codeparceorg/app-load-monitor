const memoryBuffers = [];
const MEMORY_CHUNK = 8 * 1024 * 1024;
const MAX_ALLOC_PERCENT = 0.5; // No reservar más del 50 % de la memoria del task

function allocateMemory(maxMemory) {
    const allocated = memoryBuffers.reduce((total, buffer) => total + buffer.length, 0);
    const maxAllocBytes = maxMemory * MAX_ALLOC_PERCENT;

    if (allocated >= maxAllocBytes) return;

    const remaining = maxAllocBytes - allocated;
    const chunkSize = Math.min(MEMORY_CHUNK, remaining);
    memoryBuffers.push(Buffer.alloc(chunkSize, 1));
}

module.exports = { allocateMemory };
