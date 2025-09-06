import type { RequestHandler } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Data file under project root "data/items.json"
const dataDir = path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDir, "items.json");

interface Item {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

async function ensureDataFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(
      dataFile,
      JSON.stringify({ items: [] as Item[] }, null, 2),
      "utf8",
    );
  }
}

async function readItems(): Promise<Item[]> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const json = JSON.parse(raw) as { items: Item[] };
  return json.items ?? [];
}

async function writeItems(items: Item[]) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify({ items }, null, 2), "utf8");
}

export const listItems: RequestHandler = async (_req, res) => {
  try {
    const items = await readItems();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "Failed to read items" });
  }
};

export const createItem: RequestHandler = async (req, res) => {
  try {
    const { title, description } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }
    const now = new Date().toISOString();
    const item: Item = {
      id: randomUUID(),
      title,
      description: typeof description === "string" ? description : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const items = await readItems();
    items.unshift(item);
    await writeItems(items);
    res.status(201).json({ item });
  } catch (e) {
    res.status(500).json({ error: "Failed to create item" });
  }
};

export const updateItem: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { title, description } = req.body ?? {};
    const items = await readItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const now = new Date().toISOString();
    items[idx] = {
      ...items[idx],
      title:
        typeof title === "string" && title.length ? title : items[idx].title,
      description:
        typeof description === "string" ? description : items[idx].description,
      updatedAt: now,
    };
    await writeItems(items);
    res.json({ item: items[idx] });
  } catch (e) {
    res.status(500).json({ error: "Failed to update item" });
  }
};

export const deleteItem: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const items = await readItems();
    const next = items.filter((i) => i.id !== id);
    if (next.length === items.length)
      return res.status(404).json({ error: "Not found" });
    await writeItems(next);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: "Failed to delete item" });
  }
};
