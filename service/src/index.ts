import express from "express";
import cluster from "cluster";
import { cpus } from "os";
import { handleRequest, processQueue } from "#middleware/middleware.js";
import { prometheusMetrics } from "#middleware/prometheus.js";

const numCPUs = cpus().length;
const port = process.env.PORT ?? "9001";

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Starting ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const app = express();

  app.get("/metrics", prometheusMetrics);
  app.post("/request", handleRequest);
  processQueue();

  const server = app.listen(port, () => {
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    
    console.log(`Worker ${process.pid} started and listening on port ${port}`);
  });

  console.log(`Worker ${process.pid} started`);
}