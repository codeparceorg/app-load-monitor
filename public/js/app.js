
const elements = {
    cpuValue: document.getElementById("cpu-value"),
    cpuBar: document.getElementById("cpu-bar"),
    cpuCapacity: document.getElementById("cpu-capacity"),
    cpuTarget: document.getElementById("cpu-target"),
    cpuState: document.getElementById("cpu-state"),

    memoryValue: document.getElementById("memory-value"),
    memoryBar: document.getElementById("memory-bar"),
    memoryLimit: document.getElementById("memory-limit"),
    memoryUsed: document.getElementById("memory-used"),
    memoryState: document.getElementById("memory-state")
};

function updateMetric(valueElement, barElement, value) {
    const percentage = Math.max(0, Math.min(100, value));

    valueElement.textContent = percentage.toFixed(1);
    barElement.style.width = `${percentage}%`;
}

async function fetchMetrics() {
    try {
        const response = await fetch("/metrics", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        updateMetric(
            elements.cpuValue,
            elements.cpuBar,
            data.cpu.percent
        );

        elements.cpuCapacity.textContent =
            data.capacity.cpus.toFixed(2);

        elements.cpuTarget.textContent =
            `${data.targets.cpu}%`;

        elements.cpuState.textContent =
            data.cpu.percent >= data.targets.cpu * 0.9
                ? "Target reached"
                : "Generating load";

        updateMetric(
            elements.memoryValue,
            elements.memoryBar,
            data.memory.percent
        );

        elements.memoryLimit.textContent =
            `${data.memory.limitMB.toFixed(0)} MB`;

        elements.memoryUsed.textContent =
            `${data.memory.usedMB.toFixed(1)} / ${data.memory.limitMB.toFixed(1)} MB`;

        elements.memoryState.textContent =
            "Container memory";

    } catch (error) {
        console.error("Error fetching metrics:", error);
        elements.cpuState.textContent = "Connection error";
        elements.memoryState.textContent = "Connection error";
    }
}

fetchMetrics();
setInterval(fetchMetrics, 1000);
