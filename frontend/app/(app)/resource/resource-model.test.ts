import { describe, expect, it } from "vitest";
import { formatSize, getCategory, sortFiles, type ResourceFile } from "./resource-model";

describe("resource model", () => {
  it("maps visible tabs to backend categories", () => {
    expect(getCategory("Books")).toBe("notes");
    expect(getCategory("Chapter Wise")).toBe("formula");
    expect(getCategory("DPP")).toBe("dpp");
  });

  it("sorts document names naturally without mutating the input", () => {
    const files = [
      { id: "2", title: "Chapter 10", topic: "math", streamUrl: "/2" },
      { id: "1", title: "Chapter 2", topic: "math", streamUrl: "/1" },
    ] satisfies ResourceFile[];
    expect(sortFiles(files).map((file) => file.id)).toEqual(["1", "2"]);
    expect(files.map((file) => file.id)).toEqual(["2", "1"]);
  });

  it("formats stored sizes and falls back to the file type", () => {
    expect(formatSize(1024, "notes.pdf")).toBe("1 KB");
    expect(formatSize(undefined, "lesson.html")).toBe("HTML");
  });
});
