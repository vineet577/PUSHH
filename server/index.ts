import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { listItems, createItem, updateItem, deleteItem } from "./routes/items";
import { compileAndRun } from "./routes/compile";
import { pushFile } from "./routes/github";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health & examples
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // CRUD: Items
  app.get("/api/items", listItems);
  app.post("/api/items", createItem);
  app.put("/api/items/:id", updateItem);
  app.delete("/api/items/:id", deleteItem);

  // Compile
  app.post("/api/compile", compileAndRun);

  // GitHub push
  app.post("/api/github/push", pushFile);

  return app;
}
