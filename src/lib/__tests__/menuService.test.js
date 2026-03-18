import { describe, expect, test, vi } from "vitest";

vi.mock("../firebase", () => ({
  db: null,
  firebaseReady: false
}));

import {
  createCategory,
  createEventType,
  createMenuItem,
  deleteMenuItem,
  getEventTypes,
  getMenuCategories,
  getMenuItems,
  updateCategory,
  updateEventType,
  updateMenuItem
} from "../menuService";

describe("menuService fallback behavior", () => {
  test("returns empty lists when firebase is unavailable", async () => {
    await expect(getEventTypes()).resolves.toEqual([]);
    await expect(getMenuCategories("wedding")).resolves.toEqual([]);
    await expect(getMenuItems("wedding")).resolves.toEqual([]);
  });

  test("throws on mutating methods when firebase is unavailable", async () => {
    await expect(createEventType({ name: "Wedding" })).rejects.toThrow(/firebase is not configured/i);
    await expect(createCategory({ eventTypeId: "a", name: "Mains" })).rejects.toThrow(/firebase is not configured/i);
    await expect(createMenuItem({ eventTypeId: "a", categoryId: "b", name: "Ribs" })).rejects.toThrow(/firebase is not configured/i);
    await expect(updateEventType("id-1", { name: "Updated" })).rejects.toThrow(/firebase is not configured/i);
    await expect(updateCategory("id-1", { name: "Updated" })).rejects.toThrow(/firebase is not configured/i);
    await expect(updateMenuItem("id-1", { name: "Updated" })).rejects.toThrow(/firebase is not configured/i);
    await expect(deleteMenuItem("id-1")).rejects.toThrow(/firebase is not configured/i);
  });
});
