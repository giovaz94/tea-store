import express from "express";
import { handleRequest } from "#middleware/middleware.js";
import { prometheusMetrics } from "#middleware/prometheus.js";

const app = express();
const port = process.env.PORT ?? "9001";

app.get("/metrics", prometheusMetrics);
app.post("/request", handleRequest);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
