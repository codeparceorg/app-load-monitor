const express = require("express");
const metricsRoutes = require("./metrics");
const metadataRoutes = require("./metadata");

const router = express.Router();

router.use(metricsRoutes);
router.use(metadataRoutes);

module.exports = router;
