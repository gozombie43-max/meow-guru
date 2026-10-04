

export function validateEntry(entry, index) {
  const errors = [];

  if (!entry.filename) {
    errors.push(
      `[${index}] missing "filename"`
    );
  }

  if (
    !entry.correctAnswer ||
    !["A", "B", "C", "D"].includes(
      entry.correctAnswer
    )
  ) {
    errors.push(
      `[${index}] "correctAnswer" must be A, B, C, or D`
    );
  }

  if (
    !entry.options ||
    typeof entry.options !== "object"
  ) {
    errors.push(
      `[${index}] missing "options" object`
    );
  } else {
    for (
      const opt of ["A", "B", "C", "D"]
    ) {
      const option =
        entry.options[opt];

      if (!option) {
        errors.push(
          `[${index}] missing option "${opt}"`
        );
        continue;
      }

      for (
        const field of [
          "x",
          "y",
          "w",
          "h",
        ]
      ) {
        if (
          typeof option[field] !==
            "number" ||
          option[field] < 0 ||
          option[field] > 1
        ) {
          errors.push(
            `[${index}] option "${opt}.${field}" must be a number 0–1`
          );
        }
      }
    }
  }

  return errors;
}

export function stemOf(filename) {
  return filename.replace(
    /\.[^/.]+$/,
    ""
  );
}

export const IMAGE_EXTENSIONS =
  new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
  ]);

export function isImage(filename) {
  const dotIndex =
    filename.lastIndexOf(".");

  if (dotIndex === -1) {
    return false;
  }

  return IMAGE_EXTENSIONS.has(
    filename
      .slice(dotIndex)
      .toLowerCase()
  );
}

export function findImageInZip(
  zip,
  filename
) {
  return (
    zip.file(filename) ||
    zip.file(`images/${filename}`) ||
    Object.values(
      zip.files
    ).find(
      (file) =>
        file.name.endsWith(
          `/${filename}`
        ) ||
        file.name === filename
    )
  );
}
