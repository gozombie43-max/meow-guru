# Mock & PYQ paper image ZIP format and policy

## Purpose and workflow

Use Admin → Mock & Pyq → open a fixed paper → Bulk upload question & option images (.zip).
Works for existing SSC and IIT JAM fixed mock/PYQ papers, including bilingual source papers.
Dynamic slots must have a fixed paper uploaded first. This feature attaches images; it does not create questions.

1. Save existing question edits. Download the manifest template from the selected paper.
2. Add your images, edit the manifest using the exact question IDs displayed in the editor, and ZIP the contents.
3. Select the ZIP and click **Validate ZIP**. Review every target and replacement.
4. Click **Upload & link images**. The server revalidates, converts the images to WebP, uploads to B2, then saves all links in one conditional paper update.
5. Wait for success. The paper reloads with the saved URLs. ZIP imports save immediately; no separate Save changes click is needed.

Validation uploads nothing and changes nothing. Keep the page open during processing.
The upload panel shows ZIP selected, validating, ready, uploading, success or error status. A spinner and indeterminate progress bar remain visible while a request is running; they do not represent a measured upload percentage. Successful targets remain marked **Uploaded & linked** after the paper refreshes. The paper also shows saved image counts and warns **Already linked · will replace image** for existing target images. Existing links do not mean the selected ZIP is identical: applying a validated ZIP replaces those targets and uploads new objects. A full page reload reconstructs saved image status; the last request's success/error message is kept only while the editor stays open.
The template contains example mappings for the first question only. Edit or remove these mappings; it is not a complete paper image list.

## ZIP structure

ZIP `manifest.json` and `images/` directly, without an enclosing folder:

```text
paper-images.zip
├── manifest.json
└── images/
    ├── question.png
    ├── option-a.png
    └── option-b-bn.webp
```

```json
{
  "version": 1,
  "examSlug": "ssc-chsl",
  "paperId": "COPY_EXACT_PAPER_ID_FROM_EDITOR",
  "images": [
    { "questionId": "m001", "target": "question", "file": "images/question.png" },
    { "questionId": "m001", "target": "option", "option": "A", "language": "en", "file": "images/option-a.png" },
    { "questionId": "m001", "target": "option", "option": "B", "language": "bn", "file": "images/option-b-bn.webp" }
  ]
}
```

Replace every example ID with actual IDs. The exact paper ID and exam slug appear above the picker. IIT JAM uses its own exam slug and mode; SSC/JAM cannot be mixed.

## Mapping rules

- JSON uses UTF-8, double quotes, no comments, no trailing commas. Unknown properties are rejected.
- Required top-level fields: `version` (number `1`), `examSlug`, `paperId`, `images`.
- Every mapping requires `questionId`, `target` (`question` or `option`), and `file`.
- A question image replaces `questionImage`, shared across languages. Omit `option` and `language` for this target. Question text is retained.
- An option image requires `option` (`A`–`H`, only if present on the question) and `language` (`en` or `bn`, only if that language exists). NAT questions have no options.
- **An option mapping replaces the whole selected option with image Markdown**, for example `![Option A](/api/upload/image/...)`. Existing option text/images are replaced. Include required option text inside the image, or restore/edit its text afterward in the editor.
- English and Bangla option images are independent. Map both languages separately when needed. Other translations and options remain as stored.
- Question IDs are exact, case-sensitive IDs, never question display positions or inferred file numbers. No filename guessing/OCR occurs.
- Each target may occur once. Multiple targets may reuse the same file; that file uploads once per import.
- Partial paper batches are allowed. Answers, question order, identifiers, section timers and paper settings are retained.
- Filenames must match `images/[A-Za-z0-9_-]+.(png|jpg|jpeg|webp)` using lowercase extensions. No spaces, extra dots or subfolders. Paths are case sensitive.
- Every referenced file must exist; every non-directory file except `manifest.json` must be referenced.

## Limits and forbidden content

| Item | Limit |
| --- | --- |
| Compressed ZIP | 20 MiB |
| Total expanded contents | 64 MiB |
| Any expanded file | 8 MiB |
| Manifest | 128 KiB |
| ZIP entries, including directories | 1,000 |
| Image mappings | 1–500 |
| Image pixels | 16 million per image |

Use standard unencrypted ZIP with static PNG, JPEG or WebP. The file extension must match actual image content. Images must fully decode; animated/multipage files are rejected. Images are auto-oriented and converted to WebP (quality 90); inspect fine text after upload.

Do not upload password-protected archives, nested ZIPs, PDFs, SVGs, GIFs, executables, symlinks, absolute paths, `..`, backslashes, hidden metadata (`.DS_Store`, `__MACOSX`) or unrelated files. Do not rename a PDF or other file to an image extension. Split larger papers into batches within the limits.

## Errors and corrective actions

| Error | What to do |
| --- | --- |
| Missing manifest.json | Put the manifest at the ZIP root; remove an enclosing folder. |
| Invalid JSON / manifest | Correct the reported field or mapping index; use the downloaded template. |
| Wrong paperId/examSlug / current exam mode | Open the correct paper/mode or correct the manifest IDs. |
| Unknown question ID | Copy the ID displayed under the question heading. Do not use display numbers. |
| Missing image | Match exact path, filename, extension and capitalization. |
| Duplicate target | Keep one mapping for each question image or option/language pair. |
| Option/language does not exist | Select an existing option and supported language; omit options for NAT. |
| Unexpected file / unsafe path | Remove unused, hidden or unsafe entries and create a clean ZIP. |
| Decode / format / pixel error | Re-export a static supported image with matching extension and lower resolution. |
| Size / entry limit | Split the ZIP and reduce image dimensions/file sizes. |
| Paper changed (409) | Reload the paper, preserve/reapply any needed work, and validate again. |
| Access denied (401/403) | Sign in using an active admin/superadmin account. |
| Rate limited (429) | Wait, then validate again. Avoid repeated parallel submissions. |
| Another ZIP is processing (503) | Wait for the current import on this API process to finish, then retry. |
| B2 upload failed (503) | Paper links were not saved. Retry; repeated failures need B2 credentials/connectivity checked by an operator. |
| Save outcome unconfirmed / network interruption | Reload and inspect the paper before retrying. A disconnected browser does not prove that the server stopped. |

## Operational and content policy

Only active admins/superadmins may import. Upload only content you are authorized to publish. Do not include credentials, personal data or unrelated materials. Review target replacements before applying. There is no automatic undo: retain original assets/paper backups to restore replaced images or option text.

The server checks the paper version before processing and at the final save. A known failure prevents partial paper link updates. Uploads use unique keys under `question-images/paper-imports/` and stable `/api/upload/image/` resolver URLs, rather than expiring B2 signed URLs. Existing images are never overwritten or deleted by a successful import.

On a known storage/save failure, newly attempted objects receive best-effort cleanup. Cleanup failures are logged for operators. If the database save outcome is unknown, objects remain available because the paper may already reference them; operators must inspect the paper and logged keys before cleanup. B2 version retention may keep hidden versions even after deletion. A process crash can leave unlinked objects: reconcile against stored paper references before deleting anything. Do not apply temporary-object expiry rules to this permanent image prefix.

This is a bounded synchronous import, not a resumable background job. Validation/apply can each take time; split large batches if your hosting request timeout is short. Infrastructure limits may reject a request before application validation. Published paper edits affect future paper loads; existing attempts can retain their saved question snapshot.

## API contract

`POST /api/mocktest/admin/slots/:paperId/question-images-zip?examSlug=...&examMode=ssc|iit-jam`

Authenticated multipart fields: `zipFile` (one ZIP), `action` (`validate` or `apply`), `expectedUpdatedAt` (JSON string of the currently loaded timestamp, or literal `null`). Apply repeats validation and checks the version even if validation was run earlier. Responses include the target list and file/question counts. Errors return an `error` message with a corrective action where applicable.
