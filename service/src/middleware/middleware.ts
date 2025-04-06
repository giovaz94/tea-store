import { RequestHandler } from "express";

const outputServices: Map<string, string> = new Map(
  Object.entries(JSON.parse(process.env.OUTPUT_SERVICES || "{}")),
);

export const handleRequest: RequestHandler = (_, res) => {
  outputServices.forEach((url, n) => {
    console.log(`Sending ${n} requests to ${url}`);
  });

  res.status(200).send("OK");
};
