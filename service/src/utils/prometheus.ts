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
  const counter = createCounter(
    `http_requests_total_${serviceName}_counter`,
    `Total number of requests sent to ${serviceName} services`,
    ["service", "status"],
  );
  counter.inc();
  return counter;
}

export function createLostMessageCounter(serviceName: string): Counter<string> {
  const counter = createCounter(
    `message_lost`,
    "Total number of messages that failed to be delivered",
    ["service", "reason"],
  );
  counter.inc();
  return counter;
}

export function createBehaviourCounter(): Counter<string> {
  const counter = createCounter(
    "behaviour_execution",
    "Total number of behaviour execution",
    ["service", "reason"],
  );
  counter.inc();
  return counter;
}

export function createBehaviourTimeCounter(): Counter<string> {
   const counter = createCounter(
    "behaviour_time_execution",
    "Time needed to execute the behaviour",
    ["service", "reason"],
  );
  counter.inc();
  return counter;
}