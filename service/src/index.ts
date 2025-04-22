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
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";
const lostMessage = createLostMessageCounter(serviceName);
const incomingMessages = createIncomingMessageCounter(serviceName);
let behaviourCounter: Counter<string>;
let behaviourTimeCounter: Counter<string>;
if (serviceName === "webUI") {
  behaviourCounter = createBehaviourCounter();
  behaviourTimeCounter = createBehaviourTimeCounter();
}
////////////////

if (process.env.MCL === undefined) throw new Error("The MCL for the following service isn't defined");
const mcl: number = parseInt(process.env.MCL as string, 10);
const maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENCY || "10000");
const outputServices: Map<string, string> = new Map(Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),);
const requestQueue: Task[] = [];
let runningTasks = 0;

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
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
    console.log("Req parsed");
    res.sendStatus(200);
    next();
    if (serviceName === "webUI") await webuiTask(task);
    if (serviceName === "auth") await request(
      'http://persistence-service/request', {
        method: 'POST',
        dispatcher: new Agent({
          // connections: 1,  // Force new connection each time
          pipelining: 0    // Disable pipelining
        })
      }
    ).catch(err => console.log(err.message));
    // await request(
    //   'http://persistence-service/request', 
    //   { 
    //     method: 'POST',
    //     dispatcher: new Agent({pipelining: 0})
    //   }
    // ).catch(err => console.log(err.message));
    // await axios.post("http://persistence-service/request").catch(err => console.log(err.message));
    runningTasks--;
  });
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
    response = await request('http://auth-service/request',{
      method: 'POST',
      dispatcher: new Agent({
        // connections: 1,  // Force new connection each time
        pipelining: 0    // Disable pipelining
      })
    }); 
    //response = await axios.post("http://auth-service/request");
    console.log("Browsing " + executions + " times");
    while (executions > 0 && response.statusCode !== 500) {
      for (const [url, numberOfRequests] of outputServices.entries()) {
        const n = parseInt(numberOfRequests, 10);
        console.log(`Sending ${n} requests to ${url}`);
        for (let i = 0; i < n; i++) {
          response = await request(url, {
            method: 'POST',
            dispatcher: new Agent({
              // connections: 1,  // Force new connection each time
              pipelining: 0    // Disable pipelining
            })
          }); 
          //response = await axios.post(url);
          if (response.statusCode === 500 && serviceName === "webUI") {
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
    if (runningTasks >= maxConcurrentTasks) return;
    const task = requestQueue.shift();
    if (task) {
      runningTasks++;
      task.resolve(task);
    }
  }, 1000 / mcl);
}

const server = app.listen(port, () => {
  server.keepAliveTimeout = 10000;
  console.log(`${serviceName} started and listening on port ${port}`);
});
