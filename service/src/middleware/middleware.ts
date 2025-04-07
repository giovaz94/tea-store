import { RequestHandler } from "express";
import { calculateSleepTime, sleep } from "#utils/service.js";
import axios from "axios";
import {
  createIncomingMessageCounter,
  createLostMessageCounter,
} from "#utils/prometheus.js";
import { createBehaviourCounter, createBehaviourTimeCounter } from "../utils/prometheus";
import { start } from "repl";

const outputServices: Map<string, string> = new Map(
  Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),
);
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";

// const serviceExec: number = parseInt(process.env.SERVICE_EXECUTION, 10) || Math.floor(Math.random() * 5) + 1; //you must specify for all services 1, for webUI do not specify anything

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl: number = parseInt(process.env.MCL as string, 10);

const lostMessage = createLostMessageCounter();
const incomingMessages = createIncomingMessageCounter(serviceName);
let behaviourCounter;
let behaviourTimeCounter;
if (serviceName === "webUI") {
  behaviourCounter = createBehaviourCounter();
  behaviourTimeCounter = createBehaviourTimeCounter();
}

export const handleRequest: RequestHandler = async (_, res) => {
  let executions = 1;
  let startTime = 0;
  if (serviceName === "webUI") {
    executions = Math.floor(Math.random() * 5) + 1;
    startTime = Date.now();
  }
  incomingMessages.inc();
  let sleepTime = calculateSleepTime(mcl);
  console.log(outputServices.entries());
  await sleep(sleepTime);
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
          lostMessage.inc();
        }
      }
    }
    executions--;
  }
  if (serviceName === "webUI") {
    behaviourCounter.inc();
    behaviourTimeCounter.inc(Date.now() - startTime);
  }
  res.status(200).send("OK");
};
