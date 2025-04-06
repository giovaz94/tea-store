import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

const originalEnv = { ...process.env };

vi.mock("axios");
vi.mock("#utils/service.js", () => ({
  calculateSleepTime: vi.fn().mockReturnValue(100),
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe("handleRequest middleware", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    if (axios.post && typeof vi.mocked === "function") {
      vi.mocked(axios.post).mockReset();
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should send POST requests to each service the correct number of times", async () => {
    process.env.MCL = "1000";
    process.env.OUTPUT_SERVICES = JSON.stringify({
      "3": "http://service1.example.com",
      "2": "http://service2.example.com",
    });

    const { handleRequest } = await import("#middleware/middleware.js");
    const serviceUtils = await import("#utils/service.js");

    vi.mocked(axios.post).mockResolvedValue({});

    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await handleRequest({} as any, res as any, {} as any);

    expect(axios.post).toHaveBeenCalledTimes(5);
    expect(axios.post).toHaveBeenCalledWith("http://service1.example.com");
    expect(axios.post).toHaveBeenCalledWith("http://service2.example.com");
    expect(serviceUtils.calculateSleepTime).toHaveBeenCalledWith(1000);
    expect(serviceUtils.sleep).toHaveBeenCalledWith(100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");
  });

  it("should handle failed HTTP requests gracefully", async () => {
    process.env.MCL = "1000";
    process.env.OUTPUT_SERVICES = JSON.stringify({
      "3": "http://service1.example.com",
      "2": "http://service2.example.com",
    });

    const { handleRequest } = await import("#middleware/middleware.js");

    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const consoleErrorSpy = vi.spyOn(console, "error");
    consoleErrorSpy.mockImplementation(() => {});

    vi.mocked(axios.post).mockRejectedValue(new Error("Connection error"));

    await handleRequest({} as any, res as any, {} as any);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");

    consoleErrorSpy.mockRestore();
  });

  it("should work with empty OUTPUT_SERVICES", async () => {
    process.env.MCL = "1000";
    process.env.OUTPUT_SERVICES = "{}";

    const { handleRequest } = await import("#middleware/middleware.js");
    const serviceUtils = await import("#utils/service.js");

    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    vi.mocked(axios.post).mockClear();

    await handleRequest({} as any, res as any, {} as any);

    expect(axios.post).not.toHaveBeenCalled();
    expect(serviceUtils.calculateSleepTime).toHaveBeenCalledWith(1000);
    expect(serviceUtils.sleep).toHaveBeenCalledWith(100);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");
  });

  it("should handle errors and continue with remaining requests", async () => {
    process.env.MCL = "1000";
    process.env.OUTPUT_SERVICES = JSON.stringify({
      "3": "http://service1.example.com",
      "2": "http://service2.example.com",
    });

    const { handleRequest } = await import("#middleware/middleware.js");
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const consoleErrorSpy = vi.spyOn(console, "error");
    consoleErrorSpy.mockImplementation(() => {});

    vi.mocked(axios.post)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Connection error"))
      .mockResolvedValueOnce({})
      .mockRejectedValue(new Error("Timeout"));

    await handleRequest({} as any, res as any, {} as any);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");

    consoleErrorSpy.mockRestore();
  });
});
