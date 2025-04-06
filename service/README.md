# TeaStore general service implementation

This repository contains the implementation a the general service for the TeaStore application. It is based on Express.js and TypeScript and provides a RESTful API for managing incoming requests and forwarding them to the appropriate microservices.

## How it works

The service maintain a map of microservices url and the number of times that should be called each time a request is received. Each forwarded request is done using the `axios` library with POST method. When each request is processed the service simulates a sleep delay (based on the configured MCL) and then returns the response to the client.

Service also records the following metrics that are exposed through the `/metrics` endpoint:

- `http_requests_total_<SERVICE_NAME>_counter`: Total number of requests received by the service.
- `lost_messages_total`: Total number of lost messages. This is aggregated for all services using PromQL in the system monitor.

## Configuration

In order to work properly, the service needs to be configured with the following environment variables:

- `SERVICE_NAME`: The name of the service. This is used to identify the service in the metrics and in the deployment infrastructure.
- `SERVICE_PORT`: The port on which the service will listen for incoming requests. This is used to configure the Express.js server.
- `MCL`: Maximum Computational Workload. This is used to simulate the delay in processing requests.
