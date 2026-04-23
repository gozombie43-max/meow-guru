// routes/notes.routes.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getNotesContainer } from "../containerStore.js";

const router = express.Router();

// GET /api/notes  (optional ?topic=X  &type=Y)
router.get("/", async (req, res) => {
  try {
    const { topic, type } = req.query;
    const normalizedTopic = typeof topic === "string" ? topic.toLowerCase() : topic;
    const normalizedType  = typeof type === "string" ? type.toLowerCase() : type;
    let query      = "SELECT * FROM c ORDER BY c._ts DESC";
    const parameters = [];

    if (topic && type) {
      query = "SELECT * FROM c WHERE LOWER(c.topic) = @topic AND LOWER(c.type) = @type ORDER BY c._ts DESC";
      parameters.push({ name: "@topic", value: normalizedTopic });
      parameters.push({ name: "@type",  value: normalizedType  });
    } else if (topic) {
      query = "SELECT * FROM c WHERE LOWER(c.topic) = @topic ORDER BY c._ts DESC";
      parameters.push({ name: "@topic", value: normalizedTopic });
    } else if (type) {
      query = "SELECT * FROM c WHERE LOWER(c.type) = @type ORDER BY c._ts DESC";
      parameters.push({ name: "@type", value: normalizedType });
    }

    const { resources } = await getNotesContainer().items
      .query({ query, parameters })
      .fetchAll();

    res.json(resources);
  } catch (err) {
    console.error("GET /api/notes error:", err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /api/notes/:id
router.get("/:id", async (req, res) => {
  try {
    const { resource } = await getNotesContainer()
      .item(req.params.id, req.params.id)
      .read();
    res.json(resource);
  } catch (err) {
    res.status(404).json({ error: "Note not found" });
  }
});

// POST /api/notes
router.post("/", async (req, res) => {
  try {
    const note = {
      id:        uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await getNotesContainer().items.create(note);
    res.status(201).json(resource);
  } catch (err) {
    console.error("POST /api/notes error:", err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// PUT /api/notes/:id
router.put("/:id", async (req, res) => {
  try {
    const { resource: existing } = await getNotesContainer()
      .item(req.params.id, req.params.id)
      .read();

    const updated = {
      ...existing,
      ...req.body,
      id:        req.params.id,
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await getNotesContainer()
      .item(req.params.id, req.params.id)
      .replace(updated);

    res.json(resource);
  } catch (err) {
    console.error("PUT /api/notes error:", err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", async (req, res) => {
  try {
    await getNotesContainer()
      .item(req.params.id, req.params.id)
      .delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;