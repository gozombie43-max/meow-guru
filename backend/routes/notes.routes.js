// routes/notes.routes.js

import express from "express";
import { v4 as uuidv4 } from "uuid";

import {
  getNotesCollection,
} from "../config/mongodb.js";

import adminAuth from "../middleware/auth.js";

const router = express.Router();


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

    const notes =
      await getNotesCollection()
        .find(
          filter,
          {
            projection: {
              _id: 0,
              _cosmosRid: 0,
            },
          }
        )
        .sort({
          updatedAt: -1,
          createdAt: -1,
          _ts: -1,
        })
        .toArray();

    return res.json(notes);

  } catch (err) {
    console.error(
      "GET /api/notes error:",
      err
    );

    return res
      .status(500)
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
      await getNotesCollection()
        .findOne(
          {
            id: String(
              req.params.id
            ),
          },
          {
            projection: {
              _id: 0,
              _cosmosRid: 0,
            },
          }
        );

    if (!note) {
      return res
        .status(404)
        .json({
          error:
            "Note not found",
        });
    }

    return res.json(note);

  } catch (err) {
    console.error(
      "GET /api/notes/:id error:",
      err
    );

    return res
      .status(500)
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

      /*
       * req.body comes first so clients
       * cannot override our generated id
       * or timestamps.
       */
      const note = {
        ...req.body,

        id:
          uuidv4(),

        createdAt:
          now,

        updatedAt:
          now,
      };

      await getNotesCollection()
        .insertOne(note);

      return res
        .status(201)
        .json(
          sanitizeNote(note)
        );

    } catch (err) {
      console.error(
        "POST /api/notes error:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to create note",
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

      const notes =
        getNotesCollection();

      const existing =
        await notes.findOne({
          id,
        });

      if (!existing) {
        return res
          .status(404)
          .json({
            error:
              "Note not found",
          });
      }

      /*
       * Never allow these internal/immutable
       * properties to be overwritten.
       */
      const {
        _id,
        _cosmosRid,
        id: _bodyId,
        createdAt: _createdAt,
        ...allowedUpdates
      } = req.body || {};

      const updatedAt =
        new Date().toISOString();

      await notes.updateOne(
        {
          _id:
            existing._id,
        },
        {
          $set: {
            ...allowedUpdates,
            updatedAt,
          },
        }
      );

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
      console.error(
        "PUT /api/notes error:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to update note",
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
      const result =
        await getNotesCollection()
          .deleteOne({
            id: String(
              req.params.id
            ),
          });

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

      return res.json({
        success: true,
      });

    } catch (err) {
      console.error(
        "DELETE /api/notes error:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to delete note",
        });
    }
  }
);

export default router;