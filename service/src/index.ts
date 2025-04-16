import express from "express";
import { Request, Response, NextFunction } from 'express';
import { prometheusMetrics, createIncomingMessageCounter, createLostMessageCounter, createBehaviourCounter, createBehaviourTimeCounter } from "#prometheus";
import { Counter } from "prom-client";
import axios from "axios";

type Task = {
  resolve: () => void;
  req: Request;
  res: Response;
  next: NextFunction;
};

///PROM METRICS///
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";
// const lostMessage = createLostMessageCounter(serviceName);
const incomingMessages = createIncomingMessageCounter(serviceName);
let behaviourCounter: Counter<string>;
let behaviourTimeCounter: Counter<string>;
if (serviceName === "webUI") {
  behaviourCounter = createBehaviourCounter();
  behaviourTimeCounter = createBehaviourTimeCounter();
}
////////////////

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl: number = parseInt(process.env.MCL as string, 10);
const outputServices: Map<string, string> = new Map(Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),);
const queue: Task[] = [];

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ready = new Promise<void>((resolve) => {
    queue.push({ resolve, req, res, next });
  });
  ready.then(() => {
    next();
  });
}

const app = express();
const port = process.env.PORT ?? "9001";
app.use(rateLimitMiddleware);
app.get("/metrics", prometheusMetrics);
app.post("/request", async (req: Request, res: Response) => {
  const start = Date.now();
  await sleep(1000/mcl);
  if (serviceName == "webUI") {
    await webuiTask();
    const duration = Date.now() - start;
    behaviourTimeCounter.inc(duration);
  }
  else if (serviceName == "auth") await axios.post("http://persistence-service/request");
  console.log("Req parsed");
  res.sendStatus(200);
});

const server = app.listen(port, () => {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  console.log(`${serviceName} started and listening on port ${port}`);
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const webuiTask = async () => {
  incomingMessages.inc();
  await axios.post("http://auth-service/request");
  let executions = Math.floor(Math.random() * 5) + 1;
  console.log("Browsing" + executions + " times");
  while (executions > 0) {
    for (const [url, numberOfRequests] of outputServices.entries()) {
      const n = parseInt(numberOfRequests, 10);
      console.log(`Sending ${n} requests to ${url}`);
      for (let i = 0; i < n; i++) {
        try {
          await axios.post(url);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown Error";
          console.error(`Error sending request to ${url}: ${errorMessage}`);
          }
        }
      }
    executions--;
  }
  behaviourCounter.inc();
};

setInterval(() => {
  const task = queue.shift();
  if (task) {
    task.resolve();
  }
}, 1000 / mcl);