import express from "express";
import { Request, Response, NextFunction } from 'express';
import { prometheusMetrics, createIncomingMessageCounter, createLostMessageCounter, createBehaviourCounter, createBehaviourTimeCounter } from "#prometheus";
import { Counter } from "prom-client";
import axios from "axios";

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

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl: number = parseInt(process.env.MCL as string, 10);
const outputServices: Map<string, string> = new Map(Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),);
const queue: Task[] = [];

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  incomingMessages.inc();
  if (queue.length >= max_queue_size) {
    console.log("-------req loss---------");
    lostMessage.inc(); 
    res.status(500);
  } else {
    const arrivalTime = Date.now(); 
    const ready = new Promise<Task>((resolve) => {
      const task: Task = {
        req,
        res,
        next,
        arrivalTime,
        resolve: (task) => resolve(task),
      };
      queue.push(task);
    });
    ready.then((task) => {
      if (serviceName === "webUI") {
        webuiTask(task);  
      } else if (serviceName === "auth") {
        axios.post("http://persistence-service/request");
      }
      next();
    });
  }
}

const app = express();
const port = process.env.PORT ?? "9001";
app.get("/metrics", prometheusMetrics);

if(serviceName === "recommender") {
  app.post("/request", async (_req: Request, res: Response) => {
    try {
      // await sleep(1000 / mcl);
      console.log("Req parsed");
      res.sendStatus(200);
    } catch (err) {
      console.error("Error handling /request:", err);
      res.sendStatus(500);
    }
  });
} else {
    app.post("/request", rateLimitMiddleware, async (_req: Request, res: Response) => {
      try {
        // await sleep(1000 / mcl);
        if(serviceName === "auth"){
          await axios.post("http://persistence-service/request");
        }
        console.log("Req parsed");
        res.sendStatus(200);
      } catch (err) {
        console.error("Error handling /request:", err);
        res.sendStatus(500);
      }
    });
}




function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const webuiTask = async (task: Task) => {
  let response = await axios.post("http://auth-service/request");
  let executions = Math.floor(Math.random() * 5) + 1;
  console.log("Browsing " + executions + " times");
  while (executions > 0 && response.status !== 500) {
    for (const [url, numberOfRequests] of outputServices.entries()) {
      const n = parseInt(numberOfRequests, 10);
      console.log(`Sending ${n} requests to ${url}`);
      for (let i = 0; i < n; i++) {
        try {
          response = await axios.post(url);
          if (response.status === 500) break;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown Error";
          console.error(`Error sending request to ${url}: ${errorMessage}`);
          }
        }
      }
    executions--;
  }
  const stop = Date.now();
  const duration = stop - task.arrivalTime;
  behaviourCounter.inc();
  behaviourTimeCounter.inc(duration);
};


if(serviceName !== "recommender") {
  setInterval(() => {
    const task = queue.shift();
    if (task) {
      task.resolve(task);
    }
  }, 1000 / mcl);
}



const server = app.listen(port, () => {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  console.log(`${serviceName} started and listening on port ${port}`);
});