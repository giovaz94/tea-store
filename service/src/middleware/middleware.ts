import { RequestHandler } from "express";
import { calculateSleepTime, sleep } from "#utils/service.js";
import axios from "axios";
import {
  createIncomingMessageCounter,
  createLostMessageCounter,
} from "#utils/prometheus.js";
import { createBehaviourCounter, createBehaviourTimeCounter } from "../utils/prometheus";
import { Counter } from "prom-client";
import { connect } from "http2";


//////BLOCKING QUEUE///////
class BlockingQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];
  private maxSizeString: string = process.env.MAX_SIZE || "50";
  private maxSize: number = parseInt(this.maxSizeString);

  enqueue(item: T): boolean {
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(item);
    } else if (this.queue.length < this.maxSize) {
      this.queue.push(item);
      return true;
    } else {
      console.log("request rejected");
      return false;
    }
  }

  async dequeue(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    return new Promise<T>(resolve => {
      this.resolvers.push(resolve);
    });
  }
}
/////////

const outputServices: Map<string, string> = new Map(
  Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),
);
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";
const queue = new BlockingQueue<any>();

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl: number = parseInt(process.env.MCL as string, 10);

const lostMessage = createLostMessageCounter(serviceName);
const incomingMessages = createIncomingMessageCounter(serviceName);
let behaviourCounter: Counter<string>;
let behaviourTimeCounter: Counter<string>;
if (serviceName === "webUI") {
  behaviourCounter = createBehaviourCounter();
  behaviourTimeCounter = createBehaviourTimeCounter();
}

export const handleRequest: RequestHandler = async (_, res) => {
  let startTime = Date.now();
  incomingMessages.inc();
  const enqueueSuccessful = queue.enqueue(startTime);
  
  if (enqueueSuccessful) {
    res.status(200).send("OK");
  } else {
    res.status(500).send("Service Unavailable: Queue is full");
  }
};

export async function processQueue() {
  while (true) {
    let lostMessageFlag = false;
    const startTime = await queue.dequeue();
    // console.log("Processed:", item);
    let executions = 1;
    if (serviceName === "webUI") {
      executions = Math.floor(Math.random() * 5) + 1;
    }
    let sleepTime = calculateSleepTime(mcl);
    console.log(outputServices.entries());
    await sleep(sleepTime);
    while (executions > 0) {
      for (const [url, numberOfRequests] of outputServices.entries()) {
        const n = parseInt(numberOfRequests, 10);
        console.log(`Sending ${n} requests to ${url}`);
        for (let i = 0; i < n; i++) {
          try {
            const response = await axios.post(url);
            if (response.status === 500 && serviceName === "webUI") {
              console.error(`Received 500 status from ${url}`);
              lostMessage.inc();
              lostMessageFlag = true;
              break;
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown Error";
            console.error(`Error sending request to ${url}: ${errorMessage}`);
          }
        }
      }
      executions--;
    }
    if (serviceName === "webUI" && !lostMessageFlag) {
      behaviourCounter.inc();
      behaviourTimeCounter.inc(Date.now() - startTime);
    }
  }
}