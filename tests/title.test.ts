import { describe, it, expect } from "vitest";
import { windowTitle } from "../src/title";

describe("windowTitle", () => {
  it("shows the file name and its folder, with ~ for home", () => {
    expect(windowTitle("/home/kaji/notes/plan.md", false, "/home/kaji")).toBe("plan.md — ~/notes — md-read");
    expect(windowTitle("/home/kaji/plan.md", false, "/home/kaji/")).toBe("plan.md — ~ — md-read");
    expect(windowTitle("/home/kajiko/plan.md", false, "/home/kaji")).toBe("plan.md — /home/kajiko — md-read");
    expect(windowTitle("/etc/x.md", false, null)).toBe("x.md — /etc — md-read");
    expect(windowTitle("/x.md", false, null)).toBe("x.md — / — md-read");
  });
  it("handles Windows paths", () => {
    expect(windowTitle("C:\\Users\\b\\docs\\a.md", false, "C:\\Users\\b")).toBe("a.md — ~\\docs — md-read");
  });
  it("marks unsaved edits and untitled documents", () => {
    expect(windowTitle("/tmp/a.md", true, null)).toBe("● a.md — /tmp — md-read");
    expect(windowTitle(null, false, null)).toBe("Untitled — md-read");
  });
});
