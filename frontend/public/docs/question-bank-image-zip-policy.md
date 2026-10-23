# Question Bank image ZIP format and policy

## Purpose and workflow

Use Admin → Question Bank → Bulk upload question, solution & option images (.zip).
Works for existing SSC and IIT JAM Question Bank questions, including bilingual questions (English and Bengali).
This feature attaches images to existing questions; it does not create new questions.

1. **Select ZIP archive**: Prepare your archive containing `manifest.json` at the root and image files inside an `images/` folder. Select the file in the Question Bank admin panel.
2. **Validate ZIP**: Click **Validate ZIP**. The server performs a complete dry run with **zero storage uploads and zero database writes**. It verifies archive safety bounds, schema compliance, question identifiers, option and translation existence, and decodes every referenced image.
3. **Review Preview & Replacement badges**: Review the full inventory of targets, file paths, and replacement badges before committing:
   - `New image · ready to upload`: The target does not currently have an attached image or text content.
   - `Already linked · will replace image`: The question already has an attached question image that will be replaced.
   - `Already linked · will replace solution image`: The question already has an attached solution image that will be replaced.
   - `Already linked · will replace option image`: The option already contains an image Markdown tag that will be replaced.
   - `New image · replaces existing text`: The option currently contains text content; linking the image will replace the entire option content.
4. **Upload & link images**: Click **Upload & link images**. The server enforces an in-process single-flight mutex, revalidates all rules, checks question `updatedAt` timestamps for optimistic concurrency (returning HTTP 409 Conflict if any question was modified), converts images to WebP (quality 90), uploads files to Backblaze B2 under unique UUID prefixes, and atomically updates the questions in MongoDB. If a failure occurs before database persistence, newly uploaded objects are deleted on a best-effort basis (rollback).

Validation uploads nothing and changes nothing. Keep the page open during processing.
The upload panel displays the current stage: archive selected, validating, ready for upload, uploading, success, or error. A spinner and indeterminate progress bar remain visible while a request is active; they do not represent a measured percentage. When the import completes successfully, all affected questions reload immediately with their new image URLs; no secondary "Save" click is required.

---

## ZIP structure

Package `manifest.json` and the `images/` directory directly at the root of the ZIP archive, without an enclosing parent folder:

```text
question-bank-images.zip
├── manifest.json
└── images/
    ├── q1-diagram.png
    ├── q1-solution.png
    ├── q1-opt-a.jpg
    └── q1-opt-b-bn.webp
```

### Manifest specification

The `manifest.json` file must be encoded as UTF-8 JSON at the root of the archive:
- Maximum manifest size: **128 KiB** (131,072 bytes).
- Schema version: Numeric literal `1` (`"version": 1`).
- Exam mode: Optional string `"ssc"` or `"iit-jam"`. If specified, it must match the active exam mode of the admin session.
- Images list: Array of 1 to 500 mapping objects.
- Image paths: Must match regex `^images/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$` with lowercase extension.

---

## Manifest example

```json
{
  "version": 1,
  "examMode": "ssc",
  "images": [
    {
      "questionId": "65b123456789abcdef000001",
      "target": "question",
      "file": "images/q1-diagram.png"
    },
    {
      "questionId": "65b123456789abcdef000001",
      "target": "solution",
      "file": "images/q1-solution.png"
    },
    {
      "questionId": "65b123456789abcdef000001",
      "target": "option",
      "option": "A",
      "language": "en",
      "file": "images/q1-opt-a.jpg"
    },
    {
      "questionId": "65b123456789abcdef000001",
      "target": "option",
      "option": "B",
      "language": "bn",
      "file": "images/q1-opt-b-bn.webp"
    },
    {
      "questionId": "65b123456789abcdef000002",
      "target": "question",
      "file": "images/q2-figure.png"
    }
  ]
}
```

Replace example question IDs with exact IDs copied from the Question Bank admin interface. SSC and IIT JAM questions cannot be mixed in the same archive.

---

## Mapping rules

- JSON formatting: UTF-8 encoding, standard double quotes, no comments, no trailing commas. Unknown or extra keys are rejected.
- Required top-level fields: `version` (number `1`) and `images` (array of 1 to 500 objects). `examMode` is optional (`"ssc"` or `"iit-jam"`).
- Target mapping types:
  - `question`: Targets the question diagram or prompt image. Shared across languages. Omit `option` and `language`. Updates `questionImage`, stores image dimensions, and embeds the image markdown into the question text.
  - `solution`: Targets the solution explanation image. Shared across languages. Omit `option` and `language`. Updates `solutionImage`, stores image dimensions (`solutionImageWidth`, `solutionImageHeight`), and merges `![solution](<url>)` into the explanation text via `mergeSolutionContent`, preserving any existing written explanation without duplicates.
  - `option`: Targets a specific multiple-choice answer option. Requires `option` (`'A'` through `'H'`) and `language` (`'en'` or `'bn'`).
- **Option replacement rule**: Attaching an option image replaces the **ENTIRE** option content with Markdown `![Option <letter>](<url>)`. Existing option text or previous option images are completely replaced. If explanatory text is needed alongside the image, include the text inside the image graphic or edit the option text in the admin interface after import.
- Language validation: Only languages stored on the question are permitted. English (`en`) is always supported. Bengali (`bn`) is accepted only if the question has an existing Bengali translation record (`translations.bn.options`).
- Option existence validation: The target `option` letter must exist within the question's defined options array (e.g., A–D for a 4-option question). Numerical Answer Type (`NAT`) questions have no options; option targets are rejected.
- Exact question identifiers: `questionId` must match the exact case-sensitive database ID or unique UID (`questionUid`) displayed in the Question Bank. Question display positions or serial numbers are not accepted.
- Duplicate targets: Each target (`questionId:target:language:option`) may appear only once per ZIP.
- File reuse: Multiple mappings can reference the same image file; the image is uploaded once to Backblaze B2 and referenced by all specified targets.
- Path conventions: All image files must be located directly in `images/` and match `^images/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$` with lowercase extension. No spaces, subfolders, or extra punctuation.
- Archive completeness: Every file referenced in `manifest.json` must exist in the archive. Every non-directory file in the archive (except `manifest.json`) must be referenced in the manifest (no unreferenced extra files).

---

## Limits and forbidden content

| Item | Limit |
| --- | --- |
| Compressed ZIP size | 20 MiB (20,971,520 bytes) |
| Total expanded archive contents | 64 MiB (67,108,864 bytes) |
| Maximum single expanded file size | 8 MiB (8,388,608 bytes) |
| Maximum manifest file size | 128 KiB (131,072 bytes) |
| Total ZIP entries (files and directories) | 1,000 entries |
| Image mappings per manifest | 1 to 500 mappings |
| Maximum image dimensions / pixels | 16,000,000 pixels per image |
| Supported image formats | Static PNG, JPEG, WebP only |
| Output image normalization | Auto-oriented (`.rotate()`) and transcoded to WebP (quality 90) |

### Forbidden content

- Animated images: Animated GIFs, animated WebP, and multi-frame images are strictly rejected.
- Documents and vector files: PDFs, SVGs, TIFFs, executables, and scripts are rejected.
- Symbolic links: Symbolic links (POSIX mode `0o120000` or text pointer payloads) are rejected.
- Unsafe paths: Path traversal (`..`), leading slashes (`/`), and backslashes (`\`) are rejected.
- Hidden files and metadata: OS metadata (`.DS_Store`, `__MACOSX`, `Thumbs.db`) and unreferenced extra files are rejected.
- Nested archives: ZIP files inside the ZIP archive are rejected.
- Encrypted or password-protected archives: Encrypted ZIP archives cannot be extracted and are rejected.

---

## Errors and corrective actions

| Condition | HTTP Status | Error Message Received | How to Fix It |
| --- | --- | --- | --- |
| Missing manifest.json | 422 | `Missing manifest.json at ZIP root. Download the format guide and add the manifest.` | Place `manifest.json` directly at the root of the ZIP file; remove any enclosing parent folder. |
| Manifest exceeds 128 KiB | 422 | `manifest.json exceeds 128 KiB. Split this upload.` | Split the import into smaller ZIP archives containing fewer image mappings. |
| Invalid JSON syntax | 422 | `manifest.json is not valid JSON. Remove trailing commas and use double quotes.` | Fix JSON syntax errors; ensure strings use double quotes and remove trailing commas or comments. |
| Manifest schema validation failure / Extra keys | 422 | `Invalid manifest: <field>: <issue>` | Correct the indicated field or mapping index; remove any unrecognized top-level or mapping properties. |
| Manifest version not 1 | 422 | `Invalid manifest: version: Invalid literal value, expected 1` | Set `"version": 1` as a numeric literal in `manifest.json`. |
| Empty images array | 422 | `Invalid manifest: images: Array must contain at least 1 element(s)` | Add at least one image mapping object to the `images` array. |
| More than 500 mappings | 422 | `Invalid manifest: images: Array must contain at most 500 element(s)` | Split the batch into multiple archives containing at most 500 image mappings each. |
| Missing option or language on option target | 422 | `Invalid manifest: images.<index>: Option images require option and language` | Provide both `option` ('A'–'H') and `language` ('en' or 'bn') for option targets. |
| Option or language provided on question/solution target | 422 | `Invalid manifest: images.<index>: Question images are shared across languages; omit option and language` / `Solution images are shared across languages; omit option and language` | Remove `option` and `language` fields from question and solution target mappings. |
| Invalid image file path syntax | 422 | `Invalid manifest: images.<index>.file: File must be located in images/ directory and use alphanumeric, hyphen, or underscore characters with a .png, .jpg, .jpeg, or .webp extension` | Rename the file using only letters, numbers, hyphens, and underscores, place it in `images/`, and use a `.png`, `.jpg`, `.jpeg`, or `.webp` extension. |
| Manifest exam mode mismatch | 422 | `Manifest examMode does not match requested exam mode. Open the correct exam mode or fix the manifest.` | Switch your admin session to the matching exam mode (`ssc` or `iit-jam`), or correct `examMode` in `manifest.json`. |
| Unknown question ID | 422 | `Unknown question ID <id>. Use the ID shown in the Question Bank, not its display number.` | Copy the exact internal ID or UID displayed in the Question Bank; do not use question display numbers. |
| Question from different exam mode | 422 | `Question <id> belongs to a different exam mode. Choose questions from the current exam mode (<MODE>).` | Ensure all targeted questions belong to the active exam mode (SSC or IIT-JAM), or switch admin exam mode. |
| Duplicate target mapping | 422 | `Duplicate target <targetKey>. Keep one image per target.` | Remove redundant mappings so each question, solution, or option/language pair is targeted only once. |
| Option letter not on question | 422 | `Question <id>: option <letter> does not exist on this question. Use an existing option letter.` | Target only option letters ('A' through 'H') that exist on the question; omit option targets for NAT questions. |
| Language not present on question | 422 | `Question <id>: option <letter>/bn does not exist. Use an existing option and language.` | Add a Bengali translation for the question in the admin editor first, or omit the `bn` option mapping. |
| Missing referenced image file | 422 | `Missing image <file>. File names are case sensitive.` | Ensure all referenced image files exist in `images/`; match exact spelling, capitalization, and extension. |
| Unreferenced extra file in archive | 422 | `Unexpected file: <file>. Remove unused files, nested ZIPs and system metadata.` | Remove all unreferenced files, system metadata (`.DS_Store`, `__MACOSX`), and unused images from the archive. |
| Unsafe path traversal or backslashes | 413 / 422 | `Unsafe ZIP entry path` / `Unsafe ZIP entry path: <path>. Use standard relative paths without .. or backslashes.` | Re-create the ZIP using standard relative paths without `..`, leading slashes, or backslashes. |
| Symbolic links in archive | 422 | `Symbolic links are forbidden: <entry>. Use standard image files.` | Replace symbolic links or shortcuts with standard, standalone image files. |
| Compressed archive exceeds 20 MiB | 413 | `ZIP rejected: ZIP compressed size exceeds the import limit. Use a standard, unencrypted ZIP within the documented limits.` | Compress images or split the upload into smaller ZIP batches under 20 MiB. |
| Expanded archive exceeds 64 MiB or entry exceeds 8 MiB | 413 | `ZIP rejected: ZIP expanded size exceeds the import limit. Use a standard, unencrypted ZIP within the documented limits.` | Reduce image resolutions and file sizes so total uncompressed content is <= 64 MiB and every file is <= 8 MiB. |
| More than 1,000 ZIP entries | 413 | `ZIP rejected: ZIP contains too many entries. Use a standard, unencrypted ZIP within the documented limits.` | Reduce the number of entries in the ZIP archive to 1,000 or fewer. |
| Extension does not match container format | 422 | `<file>: cannot decode image. Use a static PNG, JPEG or WebP whose extension matches its content. Re-export a static PNG/JPEG/WebP under 8 MiB and 16 million pixels.` | Re-save the image in a genuine PNG, JPEG, or WebP container that matches its file extension. |
| Animated or multipage image | 422 | `<file>: cannot decode image. Use a static PNG, JPEG or WebP whose extension matches its content. Re-export a static PNG/JPEG/WebP under 8 MiB and 16 million pixels.` | Convert multi-frame or animated files into single-frame static images. |
| Undecodable image or exceeds 16M pixels | 422 | `<file>: cannot decode image. <details>. Re-export a static PNG/JPEG/WebP under 8 MiB and 16 million pixels.` | Verify the image is not corrupted and reduce its resolution so total pixels (width × height) do not exceed 16,000,000. |
| Question changed concurrently (409) | 409 | `Question <id> changed after validation. Reload questions and validate the ZIP again.` | Refresh the Question Bank admin view, re-select the ZIP, validate to capture fresh timestamps, and apply. |
| Process busy (503) | 503 | `Another Question Bank image ZIP import is currently processing. Wait for it to finish, then retry.` | Wait a moment for the currently running import on this server process to complete, then retry. |
| Backblaze B2 upload failed (503) | 503 | `B2 upload failed. No question changes were saved. Retry the ZIP; if it repeats, ask an administrator to check B2 connectivity and credentials.` | Retry the import. No database updates were made. If failures persist, verify Backblaze B2 credentials and network access. |
| Ambiguous database save outcome (503) | 503 | `Save outcome could not be confirmed. Reload questions to check images before retrying; report this to an administrator.` | Reload the Question Bank admin interface to inspect question status before retrying; report the incident to an administrator. |
| Unauthorized / Forbidden | 401 / 403 | `Admin authentication required` | Sign in with an active administrator account with Question Bank permissions. |

---

## Operational and content policy

- **Authorization**: Only active administrators and superadministrators may import images.
- **Content responsibility**: Upload only authorized educational diagrams and explanations. Do not include credentials, personally identifiable information, or unrelated assets.
- **All-or-nothing persistence**: The import operates with an all-or-nothing outcome. If validation fails, if concurrency timestamps mismatch, or if storage upload encounters an error, **zero questions are modified**.
- **Concurrency protection**: The server inspects question `updatedAt` timestamps both prior to storage upload and within the database persistence transaction. If any targeted question was modified between validation and application, the request is rejected with HTTP 409 Conflict, and no question is updated.
- **Unique storage namespaces**: Uploaded images are stored in Backblaze B2 under unique UUID directories (`question-images/bank-imports/${UUID}/${i}.webp`) and accessed via stable `/api/upload/image/...` resolver URLs. Existing storage objects are never overwritten.
- **Failure rollback**: On any known failure during processing (such as a B2 connection timeout or database constraint failure), newly uploaded objects from that import attempt are deleted on a best-effort basis. Rollback failures are logged for operator audit.
- **Ambiguous persistence handling**: If connectivity to MongoDB is severed during the write operation such that the commit outcome cannot be verified, uploaded objects are preserved (not deleted) to prevent broken links on questions that may have been committed. Operators must reconcile question records against logged object keys before performing manual storage cleanup.
- **Single-flight execution**: Only one Question Bank ZIP import may execute at a time per API server instance. Concurrent import requests receive HTTP 503 Service Unavailable.
- **Synchronous import scope**: Validation and application execute as synchronous HTTP requests. For large question sets, partition images into smaller ZIP archives within the 500-mapping limit to fit within hosting proxy timeout limits.

---

## API contract

`POST /api/questions/admin/image-zip?examMode=ssc|iit-jam`

### Request headers & query parameters

- Header: `Content-Type: multipart/form-data`
- Header / Query: `examMode` (`"ssc"` or `"iit-jam"`), passed via `?examMode=` query parameter or `x-exam-mode` request header.
- Authentication: Administrator session cookie (`access_session`) or Bearer token.

### Multipart form-data fields

- `zipFile`: The binary ZIP archive buffer (required, max 20 MiB compressed).
- `action`: String, `"validate"` or `"apply"` (optional, defaults to `"validate"`).
- `expectedUpdatedAts`: JSON-encoded string mapping question IDs to ISO-8601 updatedAt strings, e.g. `'{"65b...":"2026-10-23T08:00:00.000Z"}'` (required when `action === "apply"`).

---

### Response schemas

#### 1. Validate success (HTTP 200)

Returned when `action === "validate"`:

```json
{
  "valid": true,
  "summary": {
    "questionCount": 2,
    "fileCount": 3,
    "targetCount": 3,
    "targets": [
      {
        "questionId": "65b123456789abcdef000001",
        "target": "question",
        "file": "images/q1-diagram.png",
        "replacesExisting": true,
        "status": "Already linked · will replace image"
      },
      {
        "questionId": "65b123456789abcdef000001",
        "target": "solution",
        "file": "images/q1-solution.png",
        "replacesExisting": false,
        "status": "New image · ready to upload"
      },
      {
        "questionId": "65b123456789abcdef000001",
        "target": "option",
        "option": "A",
        "language": "en",
        "file": "images/q1-opt-a.jpg",
        "replacesExisting": true,
        "status": "New image · replaces existing text"
      }
    ],
    "expectedUpdatedAts": {
      "65b123456789abcdef000001": "2026-10-23T08:00:00.000Z"
    }
  }
}
```

#### 2. Apply success (HTTP 200)

Returned when `action === "apply"` succeeds:

```json
{
  "success": true,
  "appliedCount": 3,
  "questionCount": 1,
  "fileCount": 3,
  "targetCount": 3,
  "message": "Successfully updated 1 questions with 3 images.",
  "summary": {
    "questionCount": 1,
    "fileCount": 3,
    "targetCount": 3,
    "targets": [
      {
        "questionId": "65b123456789abcdef000001",
        "target": "question",
        "file": "images/q1-diagram.png",
        "replacesExisting": true,
        "status": "Already linked · will replace image"
      }
    ]
  }
}
```

#### 3. Validation / Client error (HTTP 400 / 413 / 422)

```json
{
  "error": "Question 65b123456789abcdef000001: option E does not exist on this question. Use an existing option letter."
}
```

#### 4. Concurrency conflict (HTTP 409)

```json
{
  "error": "Question 65b123456789abcdef000001 changed after validation. Reload questions and validate the ZIP again."
}
```

#### 5. Process busy (HTTP 503)

```json
{
  "error": "Another Question Bank image ZIP import is currently processing. Wait for it to finish, then retry."
}
```

#### 6. Storage failure (HTTP 503)

```json
{
  "error": "B2 upload failed. No question changes were saved. Retry the ZIP; if it repeats, ask an administrator to check B2 connectivity and credentials."
}
```

#### 7. Unauthorized (HTTP 401 / 403)

```json
{
  "error": "Admin authentication required"
}
```
