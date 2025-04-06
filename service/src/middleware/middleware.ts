import { RequestHandler } from "express";
import { calculateSleepTime, sleep } from "#utils/service.js";
import axios from "axios";
import {
  createIncomingMessageCounter,
  createLostMessageCounter,
} from "#utils/prometheus.js";

const outputServices: Map<string, string> = new Map(
  Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),
);
const serviceName: string = process.env.SERVICE_NAME || "undefinedService";

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl: number = parseInt(process.env.MCL as string, 10);

const lostMessage = createLostMessageCounter();
const incomingMessages = createIncomingMessageCounter(serviceName);

export const handleRequest: RequestHandler = async (_, res) => {
  incomingMessages.inc();

  for (const [serviceKey, url] of outputServices.entries()) {
    const n = parseInt(serviceKey, 10);
    console.log(`Sending ${n} requests to ${url}`);

    for (let i = 0; i < n; i++) {
      try {
        await axios.post(url);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown Error";
        console.error(`Error sending request to ${url}: ${errorMessage}`);
        lostMessage.inc();
      }
    }
  }

  let sleepTime = calculateSleepTime(mcl);
  await sleep(sleepTime);
  res.status(200).send("OK");
};
