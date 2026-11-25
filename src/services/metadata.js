const http = require("node:http");

const METADATA_URI =
    process.env.ECS_CONTAINER_METADATA_URI_V4 ||
    process.env.ECS_CONTAINER_METADATA_URI;

function fetchTaskMetadata() {
    return new Promise((resolve, reject) => {
        if (!METADATA_URI) {
            return reject(new Error("Metadata endpoint not available"));
        }

        const taskUrl = new URL("/task", METADATA_URI);

        http.get(taskUrl, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error("Failed to parse metadata"));
                }
            });
        }).on("error", reject);
    });
}

module.exports = { fetchTaskMetadata };
