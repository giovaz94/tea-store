import express from "express";
import { handleRequest } from "#middleware/middleware.js";

const app = express();
const port = process.env.PORT ?? "9001";

app.post("/request", handleRequest);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
