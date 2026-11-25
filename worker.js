const { parentPort, workerData } = require("node:worker_threads");

const duty = workerData.duty;
const period = 100;
const busy = period * duty;

let active = true;

parentPort.on("message", message => {
    if (message === "stop") active = false;
});

function run() {
    if (!active) return;

    const until = performance.now() + busy;
    let x = 0.123;

    while (active && performance.now() < until) {
        x = Math.sqrt(x + Math.random());
    }

    if (active) {
        setTimeout(run, period - busy);
    }
}

run();