import { Counter, Registry } from "prom-client";

export const register = new Registry();

export function createCounter(
  name: string,
  help: string,
  labelNames: string[] = [],
): Counter<string> {
  const counter = new Counter({
    name,
    help,
    labelNames,
    registers: [register],
  });

  return counter;
}

export function createSimpleCounter(
  name: string,
  help: string,
): Counter<string> {
  return createCounter(name, help);
}

export function createIncomingMessageCounter(
  serviceName: string,
): Counter<string> {
  return createCounter(
    `http_requests_total_${serviceName}_counter`,
    `Total number of requests sent to ${serviceName} services`,
    ["service", "status"],
  );
}

export function createLostMessageCounter(): Counter<string> {
  return createCounter(
    "message_lost",
    "Total number of messages that failed to be delivered",
    ["service", "reason"],
  );
}
