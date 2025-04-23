import express from "express";
import { Request, Response, NextFunction } from 'express';
import { prometheusMetrics, createIncomingMessageCounter, createLostMessageCounter, createBehaviourCounter, createBehaviourTimeCounter } from "#prometheus";
import { Counter } from "prom-client";
// import axios from "axios";
import { request, Agent } from 'undici';

type Task = {
  resolve: (task: Task) => void;
  req: Request;
  res: Response;
  arrivalTime: number;
  next: NextFunction;
};

///PROM METRICS///
const max_queue_size = parseInt(process.env.MAX_SIZE || "50");
const max_connections = parseInt(process.env.MAX_CONNECTIONS || "40");
const pipeline_count = parseInt(process.env.PIPELINE_COUNT || "0");
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";
const lostMessage = createLostMessageCounter(serviceName);
const incomingMessages = createIncomingMessageCounter(serviceName);
const agent = new Agent({
  connections: max_connections,      // Increase connections
  pipelining: pipeline_count,         // Keep pipelining off if server doesn't support it
});
let behaviourCounter: Counter<string>;
let behaviourTimeCounter: Counter<string>;
if (serviceName === "webUI") {
  behaviourCounter = createBehaviourCounter();
  behaviourTimeCounter = createBehaviourTimeCounter();
}
////////////////

if (process.env.MCL === undefined) throw new Error("The MCL for the following service isn't defined");
const mcl: number = parseInt(process.env.MCL as string, 10);
const outputServices: Map<string, string> = new Map(Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),);
const requestQueue: Task[] = [];

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log("Req received");
  incomingMessages.inc();
  if (requestQueue.length >= max_queue_size) {
    console.log("----message loss----");
    lostMessage.inc(); 
    res.sendStatus(500);
    return;
  }
  const arrivalTime = Date.now(); 
  const ready = new Promise<Task>((resolve) => {
    const task: Task = {req, res, next, arrivalTime, resolve: (task) => resolve(task), };
    requestQueue.push(task);
  });
  ready.then(async (task) => {
    next();
    if (serviceName === "webUI") webuiTask(task);
    if (serviceName === "auth") await request('http://persistence-service/request', { method: 'POST', dispatcher: agent }).catch(err => console.log(err.message));
  });
  res.sendStatus(200);
}

const app = express();
const port = process.env.PORT ?? "9001";

app.get("/metrics", prometheusMetrics);
if(serviceName !== "recommender") {  
  app.post("/request", rateLimitMiddleware);
} else {
  app.post("/request", async (_req: Request, res: Response) => { res.sendStatus(200) });
}

const webuiTask = async (task: Task) => {
  let response;
  let executions = Math.floor(Math.random() * 5) + 1;
  try {
    response = await request('http://auth-service/request',{ method: 'POST', dispatcher: agent }); 
    while (executions > 0 && response.statusCode !== 500) {
      for (const [url, numberOfRequests] of outputServices.entries()) {
        const n = parseInt(numberOfRequests, 10);
        for (let i = 0; i < n; i++) {
          response = await request(url, { method: 'POST', dispatcher: agent }); 
          if (response.statusCode === 500) {
            lostMessage.inc(); 
            break;
          }
        }
      }
      executions--;
    }
    if (response.statusCode !== 500) {
      behaviourCounter.inc();
      behaviourTimeCounter.inc(Date.now() - task.arrivalTime);
    }
  } catch(error: unknown) {
    console.error(`${error instanceof Error ? error.message : "Unknown Error"}`);
  }
};

if (serviceName !== "recommender") {
  setInterval(() => {
    const task = requestQueue.shift();
    if (task) task.resolve(task);
  }, 1000 / mcl);
}

const server = app.listen(port, () => {
  server.keepAliveTimeout = 65000; // 65 seconds (AWS ALB default)
  server.headersTimeout = 66000;   // Must be > keepAliveTimeout
  console.log(`${serviceName} started and listening on port ${port}`);
});
