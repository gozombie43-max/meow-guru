import { afterEach, describe, expect, it } from "vitest";
import { activateModalSurface } from "./modal-surface";

const releases: Array<() => void> = [];
afterEach(() => { releases.reverse().forEach(release => release()); releases.length = 0; document.body.innerHTML = ""; });

describe("modal surfaces", () => {
  it("traps focus, makes background inert and restores opener and scroll", () => {
    document.body.innerHTML = '<button id="open">Open</button><div id="modal" tabindex="-1"><button id="first">First</button><button id="last">Last</button></div>';
    const opener = document.getElementById("open")!;
    opener.focus();
    const release = activateModalSurface(document.getElementById("modal")!);
    releases.push(release);
    expect(opener.inert).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    document.getElementById("last")!.focus();
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement?.id).toBe("first");
    release();
    expect(opener.inert).toBeFalsy();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the parent modal locked and restores focus when a nested layer closes", () => {
    document.body.innerHTML = '<button id="open">Open</button><div id="parent" tabindex="-1"><button id="nested">Nested</button><div id="child" tabindex="-1"><button>Done</button></div></div>';
    document.getElementById("open")!.focus();
    const parent = activateModalSurface(document.getElementById("parent")!);
    releases.push(parent);
    const child = activateModalSurface(document.getElementById("child")!);
    releases.push(child);
    expect(document.getElementById("nested")!.inert).toBe(true);
    child();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement?.id).toBe("nested");
    expect(document.getElementById("open")!.inert).toBe(true);
    parent();
    expect(document.activeElement?.id).toBe("open");
    expect(document.body.style.overflow).toBe("");
  });
});
