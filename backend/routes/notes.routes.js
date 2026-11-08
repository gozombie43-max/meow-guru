import { runtimeLog } from '../infrastructure/runtimeLog.js';
// routes/notes.routes.js

import express from "express";
import { v4 as uuidv4 } from "uuid";

import { listNotePage, listNotes, findNoteById, insertNote, patchNoteDocument, deleteNoteById } from '../repositories/notesRepository.js';

import adminAuth from "../middleware/auth.js";
import { noteImageKeys } from '../services/notes/imageKeys.js';
import { retainNoteImages, scheduleNoteImageCleanup } from '../repositories/noteImageRepository.js';

const router = express.Router();

const ALLOWED_NOTE_FIELDS = new Set([
  "title",
  "topic",
  "type",
  "body",
  "content",
  "summary",
  "thumbnail",
  "tags",
  "subject",
  "chapter",
  "folder",
  "status",
  "isPinned",
  "order",
  "examMode",
]);

function pickAllowedNoteFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (ALLOWED_NOTE_FIELDS.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ───────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────

function escapeRegex(value = "") {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function exactCaseInsensitive(value) {
  return new RegExp(
    `^${escapeRegex(value)}$`,
    "i"
  );
}

function sanitizeNote(note) {
  if (!note) return note;

  const {
    _id,
    _cosmosRid,
    ownerUserId: _ownerUserId,
    ...clean
  } = note;

  return clean;
}


// ======================================================
// GET /api/notes
//
// Optional:
// ?topic=X
// ?type=Y
// ======================================================

router.get("/", async (req, res) => {
  try {
    const {
      topic,
      type,
    } = req.query;

    const filter = {};

    if (
      typeof topic === "string" &&
      topic.trim()
    ) {
      filter.topic =
        exactCaseInsensitive(
          topic.trim()
        );
    }

    if (
      typeof type === "string" &&
      type.trim()
    ) {
      filter.type =
        exactCaseInsensitive(
          type.trim()
        );
    }

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const search = new RegExp(escapeRegex(req.query.search.trim().slice(0, 100)), 'i');
      filter.$or = [{ title: search }, { topic: search }, { tags: search }];
    }
    if (req.query.pagination === 'cursor' || req.query.cursor) {
      const page = await listNotePage(filter, { cursor: req.query.cursor, limit: req.query.limit });
      return res.json({ ...page, items: page.items.map(sanitizeNote) });
    }
    const notes = (await listNotes(filter)).map(sanitizeNote);

    return res.json(notes);

  } catch (err) {
    runtimeLog.error(
      "GET /api/notes error:",
      err
    );

    return res
      .status(err.statusCode || 500)
      .json({
        error:
          "Failed to fetch notes",
      });
  }
});


// ======================================================
// GET /api/notes/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const note =
      await findNoteById(req.params.id);

    if (!note) {
      return res
        .status(404)
        .json({
          error:
            "Note not found",
        });
    }

    return res.json(sanitizeNote(note));

  } catch (err) {
    runtimeLog.error(
      "GET /api/notes/:id error:",
      err
    );

    return res
      .status(err.statusCode || 500)
      .json({
        error:
          "Failed to fetch note",
      });
  }
});


// ======================================================
// POST /api/notes
// ======================================================

router.post(
  "/",
  adminAuth,
  async (req, res) => {
    try {
      const now =
        new Date().toISOString();

      const allowedFields = pickAllowedNoteFields(req.body);

      const note = {
        ...allowedFields,

        imageKeys: noteImageKeys(allowedFields.body),

        id:
          uuidv4(),

        createdAt:
          now,

        updatedAt:
          now,
      };

      await retainNoteImages(note.imageKeys, { userId: req.user?.id });
      await insertNote(note);

      return res
        .status(201)
        .json(
          sanitizeNote(note)
        );

    } catch (err) {
      runtimeLog.error(
        "POST /api/notes error:",
        err
      );

      return res
        .status(err.statusCode || 500)
        .json({
          error:
            err.statusCode && err.statusCode < 500 ? err.message : "Failed to create note",
        });
    }
  }
);


// ======================================================
// PUT /api/notes/:id
// ======================================================

router.put(
  "/:id",
  adminAuth,
  async (req, res) => {
    try {
      const id =
        String(req.params.id);

      const existing =
        await findNoteById(id, true);

      if (!existing) {
        return res
          .status(404)
          .json({
            error:
              "Note not found",
          });
      }

      const allowedUpdates = pickAllowedNoteFields(req.body);

      const updatedAt =
        new Date().toISOString();

      const existingImageKeys = noteImageKeys(existing.body);
      allowedUpdates.imageKeys = noteImageKeys(Object.hasOwn(allowedUpdates, 'body') ? allowedUpdates.body : existing.body);
      await retainNoteImages(allowedUpdates.imageKeys, {
        userId: req.user?.id,
        existingKeys: existingImageKeys,
      });
      await patchNoteDocument(existing._id, { ...allowedUpdates, updatedAt });

      const removed = existingImageKeys.filter(key => !allowedUpdates.imageKeys.includes(key));
      await scheduleNoteImageCleanup(removed);

      const updated = {
        ...sanitizeNote(existing),
        ...allowedUpdates,

        id,

        createdAt:
          existing.createdAt,

        updatedAt,
      };

      return res.json(
        updated
      );

    } catch (err) {
      runtimeLog.error(
        "PUT /api/notes error:",
        err
      );

      return res
        .status(err.statusCode || 500)
        .json({
          error:
            err.statusCode && err.statusCode < 500 ? err.message : "Failed to update note",
        });
    }
  }
);


// ======================================================
// DELETE /api/notes/:id
// ======================================================

router.delete(
  "/:id",
  adminAuth,
  async (req, res) => {
    try {
      const existing = await findNoteById(req.params.id);
      const result =
        await deleteNoteById(req.params.id);

      if (
        result.deletedCount === 0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Note not found",
          });
      }

      await scheduleNoteImageCleanup(noteImageKeys(existing?.body));
      return res.json({
        success: true,
      });

    } catch (err) {
      runtimeLog.error(
        "DELETE /api/notes error:",
        err
      );

      return res
        .status(err.statusCode || 500)
        .json({
          error:
            "Failed to delete note",
        });
    }
  }
);

export default router;
