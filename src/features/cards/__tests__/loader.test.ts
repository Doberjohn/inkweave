import { describe, it, expect } from "vitest";
import {
  searchCardsByName,
  filterCards,
  getUniqueKeywords,
  getUniqueClassifications,
  getUniqueSets,
} from "../loader";
import type { LorcanaCard } from "../types";
import { createCard } from "../../../shared/test-utils/factories";

describe("Card Search", () => {
  const cards: LorcanaCard[] = [
    createCard({ id: "1", name: "Elsa", fullName: "Elsa - Snow Queen" }),
    createCard({ id: "2", name: "Anna", fullName: "Anna - Heir to Arendelle" }),
    createCard({ id: "3", name: "Elsa", fullName: "Elsa - Ice Maker", version: "Ice Maker" }),
    createCard({ id: "4", name: "Mickey Mouse", fullName: "Mickey Mouse - Brave Little Tailor" }),
  ];

  it("should find cards by name (case insensitive)", () => {
    const results = searchCardsByName(cards, "elsa");
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.name === "Elsa")).toBe(true);
  });

  it("should find cards by fullName", () => {
    const results = searchCardsByName(cards, "Snow Queen");
    expect(results).toHaveLength(1);
    expect(results[0].fullName).toBe("Elsa - Snow Queen");
  });

  it("should find cards by version", () => {
    const results = searchCardsByName(cards, "Ice Maker");
    expect(results).toHaveLength(1);
    expect(results[0].version).toBe("Ice Maker");
  });

  it("should return empty array for no matches", () => {
    const results = searchCardsByName(cards, "Donald");
    expect(results).toHaveLength(0);
  });
});

describe("Card Filtering", () => {
  const cards: LorcanaCard[] = [
    createCard({ id: "1", ink: "Amber", cost: 2, type: "Character" }),
    createCard({ id: "2", ink: "Amethyst", cost: 4, type: "Action" }),
    createCard({ id: "3", ink: "Amber", cost: 6, type: "Item" }),
    createCard({ id: "4", ink: "Ruby", cost: 3, type: "Character", keywords: ["Evasive"] }),
    createCard({ id: "5", ink: "Sapphire", cost: 5, type: "Character", classifications: ["Princess"] }),
    createCard({ id: "6", ink: "Steel", cost: 1, type: "Location", setCode: "1" }),
    createCard({ id: "7", ink: "Emerald", cost: 7, type: "Character", setCode: "5" }),
  ];

  it("should filter by single ink", () => {
    const results = filterCards(cards, { ink: "Amber" });
    expect(results).toHaveLength(2);
    expect(results.every((c) => c.ink === "Amber")).toBe(true);
  });

  it("should filter by multiple inks", () => {
    const results = filterCards(cards, { ink: ["Amber", "Ruby"] });
    expect(results).toHaveLength(3);
  });

  it("should filter by card type", () => {
    const results = filterCards(cards, { type: "Character" });
    expect(results).toHaveLength(4);
    expect(results.every((c) => c.type === "Character")).toBe(true);
  });

  it("should filter by cost range", () => {
    const results = filterCards(cards, { minCost: 3, maxCost: 5 });
    expect(results).toHaveLength(3);
    expect(results.every((c) => c.cost >= 3 && c.cost <= 5)).toBe(true);
  });

  it("should filter by keywords", () => {
    const results = filterCards(cards, { keywords: ["Evasive"] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("4");
  });

  it("should filter by classifications", () => {
    const results = filterCards(cards, { classifications: ["Princess"] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("5");
  });

  it("should filter by set code", () => {
    const results = filterCards(cards, { setCode: "5" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("7");
  });

  it("should filter by game mode (core excludes sets 1-4)", () => {
    const results = filterCards(cards, { gameMode: "core" });
    expect(results).toHaveLength(6); // All except setCode "1"
    expect(results.find((c) => c.setCode === "1")).toBeUndefined();
  });

  it("should include all sets in infinity mode", () => {
    const results = filterCards(cards, { gameMode: "infinity" });
    expect(results).toHaveLength(7);
  });

  it("should combine multiple filters", () => {
    const results = filterCards(cards, { ink: "Amber", minCost: 3 });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });
});

describe("Unique Extractors", () => {
  const cards: LorcanaCard[] = [
    createCard({ id: "1", keywords: ["Singer 5", "Evasive"] }),
    createCard({ id: "2", keywords: ["Singer 3"] }),
    createCard({ id: "3", keywords: ["Bodyguard", "Ward"] }),
    createCard({ id: "4", classifications: ["Princess", "Hero"] }),
    createCard({ id: "5", classifications: ["Villain"] }),
    createCard({ id: "6", setCode: "1" }),
    createCard({ id: "7", setCode: "5" }),
    createCard({ id: "8", setCode: "10" }),
    createCard({ id: "9", setCode: "Q1" }),
  ];

  it("should extract unique keywords (base form)", () => {
    const keywords = getUniqueKeywords(cards);
    expect(keywords).toContain("Singer");
    expect(keywords).toContain("Evasive");
    expect(keywords).toContain("Bodyguard");
    expect(keywords).toContain("Ward");
    expect(keywords).not.toContain("Singer 5"); // Should extract base keyword
  });

  it("should extract unique classifications", () => {
    const classifications = getUniqueClassifications(cards);
    expect(classifications).toContain("Princess");
    expect(classifications).toContain("Hero");
    expect(classifications).toContain("Villain");
    expect(classifications).toHaveLength(3);
  });

  it("should extract unique sets sorted numerically", () => {
    const sets = getUniqueSets(cards);
    expect(sets).toEqual(["1", "5", "10", "Q1"]);
  });
});
