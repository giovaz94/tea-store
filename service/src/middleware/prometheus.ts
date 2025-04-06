import { RequestHandler } from "express";
import { register } from "#utils/prometheus.js";

export const prometheusMetrics: RequestHandler = async (req: any, res: any) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};
