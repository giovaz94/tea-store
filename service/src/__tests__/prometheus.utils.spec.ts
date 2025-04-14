import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  register,
  createCounter,
  createSimpleCounter,
  createIncomingMessageCounter,
  createLostMessageCounter,
} from "#utils/prometheus.js";

vi.mock("prom-client", () => {
  const MockCounter = vi.fn().mockImplementation(() => ({
    inc: vi.fn(),
    labels: vi.fn().mockReturnValue({
      inc: vi.fn(),
    }),
  }));

  const MockRegistry = vi.fn().mockImplementation(() => ({
    contentType: "text/plain",
    metrics: vi.fn().mockResolvedValue("mock metrics data"),
    registerMetric: vi.fn(),
  }));

  return {
    Counter: MockCounter,
    Registry: MockRegistry,
  };
});

describe("Prometheus Utils", async () => {
  const { Counter } = await import("prom-client");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCounter", () => {
    it("should create a counter with the specified parameters", () => {
      const counter = createCounter("test_counter", "Test counter help", [
        "label1",
        "label2",
      ]);

      expect(Counter).toHaveBeenCalledWith({
        name: "test_counter",
        help: "Test counter help",
        labelNames: ["label1", "label2"],
        registers: [register],
      });
    });

    it("should create a counter with empty labelNames if not provided", () => {
      const counter = createCounter("simple_counter", "Simple counter help");

      expect(Counter).toHaveBeenCalledWith({
        name: "simple_counter",
        help: "Simple counter help",
        labelNames: [],
        registers: [register],
      });
    });
  });

  describe("createSimpleCounter", () => {
    it("should create a counter without labels", () => {
      const counter = createSimpleCounter(
        "simple_counter",
        "Counter without labels",
      );

      expect(Counter).toHaveBeenCalledWith({
        name: "simple_counter",
        help: "Counter without labels",
        labelNames: [],
        registers: [register],
      });
    });
  });

  describe("createIncomingMessageCounter", () => {
    it("should create a counter for incoming messages with correct service name", () => {
      const counter = createIncomingMessageCounter("api-service");

      expect(Counter).toHaveBeenCalledWith({
        name: "http_requests_total_api-service_counter",
        help: "Total number of requests sent to api-service services",
        labelNames: ["service", "status"],
        registers: [register],
      });
    });
  });

  describe("createLostMessageCounter", () => {
    it("should create a counter for lost messages", () => {
      const counter = createLostMessageCounter("api-service");

      expect(Counter).toHaveBeenCalledWith({
        name: "message_lost",
        help: "Total number of messages that failed to be delivered",
        labelNames: ["service", "reason"],
        registers: [register],
      });
    });
  });
});
