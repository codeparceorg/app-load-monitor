const express = require("express");
const { getMetrics } = require("../services/metrics");
const config = require("../config");

const router = express.Router();

router.get("/metrics", (req, res) => {
    res.set({
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
    });
    res.json(getMetrics(config.TARGET_CPU, config.TARGET_MEMORY));
});

module.exports = router;
