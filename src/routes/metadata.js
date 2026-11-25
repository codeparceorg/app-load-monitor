const express = require("express");
const { fetchTaskMetadata } = require("../services/metadata");

const router = express.Router();

router.get("/metadata", async (req, res) => {
    try {
        const data = await fetchTaskMetadata();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
