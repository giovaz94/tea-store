import { RequestHandler } from "express";
import { calculateSleepTime, sleep } from "#utils/service.js";

const outputServices: Map<string, string> = new Map(
  Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),
);

if (process.env.MCL === undefined) {
  throw new Error("The MCL for the following service isn't defined");
}
const mcl = parseInt(process.env.MCL as string, 10);

export const handleRequest: RequestHandler = async (_, res) => {
  outputServices.forEach((url, n) => {
    console.log(`Sending ${n} requests to ${url}`);
    // TODO: perform post request to target url for n times
  });

  let sleep_time = calculateSleepTime(mcl);
  await sleep(sleep_time);

  // TODO: update prometheus metrics
  res.status(200).send("OK");
};
