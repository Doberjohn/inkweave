import { describe, it, expect } from "vitest";
import { SynergyEngine } from "./SynergyEngine";
import type { LorcanaCard } from "../../cards/types";
import type { SynergyRule } from "../types";

// Helper to create mock cards
function createCard(overrides: Partial<LorcanaCard>): LorcanaCard {
  return {
    id: "test-1",
    name: "Test Card",
    fullName: "Test Card - Version",
    cost: 3,
    ink: "Amber",
    inkwell: true,
    type: "Character",
    ...overrides,
  };
}

describe("SynergyEngine", () => {
  describe("findSynergies", () => {
    it("should find synergies based on registered rules", () => {
      const engine = new SynergyEngine();

      // Singer card
      const singer = createCard({
        id: "singer-1",
        name: "Ariel",
        fullName: "Ariel - Spectacular Singer",
        keywords: ["Singer 5"],
      });

      // Song card
      const song = createCard({
        id: "song-1",
        name: "Part of Your World",
        type: "Action",
        cost: 3,
        classifications: ["Song"],
      });

      const allCards = [singer, song];
      const synergies = engine.findSynergies(singer, allCards);

      expect(synergies.length).toBeGreaterThan(0);
      const keywordGroup = synergies.find((g) => g.type === "keyword");
      expect(keywordGroup).toBeDefined();
      expect(keywordGroup?.synergies.some((s) => s.card.id === "song-1")).toBe(true);
    });

    it("should not include the source card in results", () => {
      const engine = new SynergyEngine();

      const singer = createCard({
        id: "singer-1",
        name: "Ariel",
        keywords: ["Singer 5"],
      });

      const synergies = engine.findSynergies(singer, [singer]);

      const allCards = synergies.flatMap((g) => g.synergies.map((s) => s.card.id));
      expect(allCards).not.toContain("singer-1");
    });

    it("should group synergies by type", () => {
      const engine = new SynergyEngine();

      // Card with both Singer and Princess classification
      const ariel = createCard({
        id: "ariel-1",
        name: "Ariel",
        fullName: "Ariel - Spectacular Singer",
        keywords: ["Singer 5"],
        classifications: ["Princess"],
      });

      const song = createCard({
        id: "song-1",
        name: "Part of Your World",
        type: "Action",
        cost: 3,
        classifications: ["Song"],
      });

      const princessCard = createCard({
        id: "princess-buff",
        name: "Royal Decree",
        type: "Action",
        text: "Your Princess characters get +1 strength.",
      });

      const synergies = engine.findSynergies(ariel, [ariel, song, princessCard]);

      // Should have keyword synergy (singer+song)
      const keywordGroup = synergies.find((g) => g.type === "keyword");
      expect(keywordGroup).toBeDefined();

      // Should have classification synergy (princess tribal)
      const classGroup = synergies.find((g) => g.type === "classification");
      expect(classGroup).toBeDefined();
    });

    it("should sort synergies by strength (strong first)", () => {
      const engine = new SynergyEngine();

      const singer = createCard({
        id: "singer-1",
        name: "Ariel",
        keywords: ["Singer 7"],
      });

      // Multiple songs with different costs
      const cheapSong = createCard({
        id: "song-cheap",
        name: "A Song",
        type: "Action",
        cost: 2,
        classifications: ["Song"],
      });

      const expensiveSong = createCard({
        id: "song-expensive",
        name: "Z Song",
        type: "Action",
        cost: 6,
        classifications: ["Song"],
      });

      const synergies = engine.findSynergies(singer, [cheapSong, expensiveSong]);
      const keywordGroup = synergies.find((g) => g.type === "keyword");

      expect(keywordGroup).toBeDefined();
      // Both should be found
      expect(keywordGroup?.synergies).toHaveLength(2);
    });
  });

  describe("checkSynergy", () => {
    it("should return true when cards have synergy", () => {
      const engine = new SynergyEngine();

      const singer = createCard({
        id: "singer-1",
        name: "Ariel",
        keywords: ["Singer 5"],
      });

      const song = createCard({
        id: "song-1",
        name: "Part of Your World",
        type: "Action",
        cost: 3,
        classifications: ["Song"],
      });

      const result = engine.checkSynergy(singer, song);

      expect(result.hasSynergy).toBe(true);
      expect(result.synergies.length).toBeGreaterThan(0);
      expect(result.synergies[0].type).toBe("keyword");
    });

    it("should return false when cards have no synergy", () => {
      const engine = new SynergyEngine();

      const card1 = createCard({
        id: "card-1",
        name: "Random Card 1",
        cost: 3,
      });

      const card2 = createCard({
        id: "card-2",
        name: "Random Card 2",
        cost: 5,
      });

      const result = engine.checkSynergy(card1, card2);

      expect(result.hasSynergy).toBe(false);
      expect(result.synergies).toHaveLength(0);
    });
  });

  describe("findSynergiesFlat", () => {
    it("should return a flat deduplicated list", () => {
      const engine = new SynergyEngine();

      const singer = createCard({
        id: "singer-1",
        name: "Ariel",
        keywords: ["Singer 5"],
      });

      const song = createCard({
        id: "song-1",
        name: "Part of Your World",
        type: "Action",
        cost: 3,
        classifications: ["Song"],
      });

      const results = engine.findSynergiesFlat(singer, [singer, song]);

      // Should be flat array
      expect(Array.isArray(results)).toBe(true);
      // Each result should have type property
      results.forEach((r) => {
        expect(r.type).toBeDefined();
        expect(r.card).toBeDefined();
        expect(r.strength).toBeDefined();
      });
    });
  });

  describe("custom rules", () => {
    it("should allow adding custom rules", () => {
      const engine = new SynergyEngine({ rules: [] });

      const customRule: SynergyRule = {
        id: "custom-test",
        name: "Custom Test Rule",
        type: "mechanic",
        description: "Test rule",
        matches: (card) => card.name === "Test",
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id && c.name === "Synergy Target")
            .map((c) => ({
              card: c,
              strength: "strong" as const,
              explanation: "Custom synergy",
            })),
      };

      engine.addRule(customRule);

      const rules = engine.getRules();
      expect(rules.some((r) => r.id === "custom-test")).toBe(true);
    });

    it("should use custom rules for synergy detection", () => {
      const customRule: SynergyRule = {
        id: "custom-test",
        name: "Custom Test Rule",
        type: "mechanic",
        description: "Test rule",
        matches: (card) => card.name === "Source",
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id && c.name === "Target")
            .map((c) => ({
              card: c,
              strength: "strong" as const,
              explanation: "Custom synergy found",
            })),
      };

      const engine = new SynergyEngine({ rules: [customRule] });

      const source = createCard({ id: "1", name: "Source" });
      const target = createCard({ id: "2", name: "Target" });
      const other = createCard({ id: "3", name: "Other" });

      const synergies = engine.findSynergies(source, [source, target, other]);

      expect(synergies).toHaveLength(1);
      expect(synergies[0].synergies).toHaveLength(1);
      expect(synergies[0].synergies[0].card.name).toBe("Target");
      expect(synergies[0].synergies[0].explanation).toBe("Custom synergy found");
    });
  });

  describe("maxResultsPerType", () => {
    it("should limit results per type", () => {
      const customRule: SynergyRule = {
        id: "many-matches",
        name: "Many Matches",
        type: "mechanic",
        description: "Matches everything",
        matches: () => true,
        findSynergies: (card, allCards) =>
          allCards
            .filter((c) => c.id !== card.id)
            .map((c) => ({
              card: c,
              strength: "moderate" as const,
              explanation: "Match",
            })),
      };

      const engine = new SynergyEngine({ rules: [customRule], maxResultsPerType: 3 });

      const source = createCard({ id: "0", name: "Source" });
      const cards = [
        source,
        ...Array.from({ length: 10 }, (_, i) =>
          createCard({ id: String(i + 1), name: `Card ${i + 1}` })
        ),
      ];

      const synergies = engine.findSynergies(source, cards);

      expect(synergies[0].synergies.length).toBeLessThanOrEqual(3);
    });
  });
});
