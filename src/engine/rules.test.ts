import { describe, it, expect } from "vitest";
import { synergyRules, getRuleById } from "./rules";
import { hasNegativeTargeting, hasPositiveClassificationEffect } from "../utils";
import type { LorcanaCard } from "../types";

// Helper to create mock cards
function createCard(overrides: Partial<LorcanaCard>): LorcanaCard {
  return {
    id: "test-1",
    name: "Test Card",
    fullName: "Test Card - Version",
    cost: 3,
    ink: "Amber",
    inkwell: true,
    type: ["Character"],
    ...overrides,
  };
}

describe("Synergy Rules", () => {
  describe("Princess Tribal", () => {
    const princessRule = getRuleById("princess-tribal")!;

    it("should match Princess characters", () => {
      const belle = createCard({
        id: "belle-1",
        name: "Belle",
        fullName: "Belle - Strange but Special",
        classifications: ["Princess", "Hero"],
      });

      expect(princessRule.matches(belle)).toBe(true);
    });

    it("should match cards that mention 'Princess character' without negative targeting", () => {
      const princessBuff = createCard({
        id: "buff-1",
        name: "Royal Decree",
        type: ["Action"],
        text: "While you have a Princess character in play, this character gains Ward.",
      });

      expect(princessRule.matches(princessBuff)).toBe(true);
    });

    it("should NOT match cards with 'Princess' only in ability name", () => {
      const bashful = createCard({
        id: "bashful-1",
        name: "Bashful",
        fullName: "Bashful - Adoring Knight",
        text: "IMPRESS THE PRINCESS While you have a character named Snow White in play, this character gains Bodyguard.",
      });

      expect(princessRule.matches(bashful)).toBe(false);
    });

    it("should NOT match cards with negative Princess targeting", () => {
      const princeAchmed = createCard({
        id: "achmed-1",
        name: "Prince Achmed",
        fullName: "Prince Achmed - Rival Suitor",
        text: "When you play this character, you may exert chosen Princess character.",
      });

      expect(princessRule.matches(princeAchmed)).toBe(false);
    });

    it("should NOT find synergy between Princess and negative targeting card", () => {
      const belle = createCard({
        id: "belle-1",
        name: "Belle",
        fullName: "Belle - Strange but Special",
        classifications: ["Princess", "Hero"],
      });

      const princeAchmed = createCard({
        id: "achmed-1",
        name: "Prince Achmed",
        fullName: "Prince Achmed - Rival Suitor",
        text: "When you play this character, you may exert chosen Princess character.",
      });

      const allCards = [belle, princeAchmed];
      const synergies = princessRule.findSynergies(belle, allCards);

      // Prince Achmed should NOT appear as a synergy for Belle
      const achmedSynergy = synergies.find((s) => s.card.id === "achmed-1");
      expect(achmedSynergy).toBeUndefined();
    });

    it("should find synergy between Princess and card mentioning 'Princess character'", () => {
      const belle = createCard({
        id: "belle-1",
        name: "Belle",
        fullName: "Belle - Strange but Special",
        classifications: ["Princess", "Hero"],
      });

      const princessBuff = createCard({
        id: "buff-1",
        name: "Royal Gathering",
        type: ["Action"],
        text: "While you have a Princess character in play, draw a card.",
      });

      const allCards = [belle, princessBuff];
      const synergies = princessRule.findSynergies(belle, allCards);

      const buffSynergy = synergies.find((s) => s.card.id === "buff-1");
      expect(buffSynergy).toBeDefined();
    });
  });

  describe("Villain Tribal", () => {
    const villainRule = getRuleById("villain-tribal")!;

    it("should NOT match cards that negatively target Villains", () => {
      const antiVillain = createCard({
        id: "anti-1",
        name: "Hero's Strike",
        type: ["Action"],
        text: "Banish chosen Villain character.",
      });

      expect(villainRule.matches(antiVillain)).toBe(false);
    });

    it("should match cards with positive Villain effects", () => {
      const villainBuff = createCard({
        id: "vbuff-1",
        name: "Villain's Scheme",
        type: ["Action"],
        text: "Your Villain characters gain +1 lore this turn.",
      });

      expect(villainRule.matches(villainBuff)).toBe(true);
    });
  });

  describe("Singer + Songs", () => {
    const singerRule = getRuleById("singer-songs")!;

    it("should match characters with Singer keyword", () => {
      const ariel = createCard({
        id: "ariel-1",
        name: "Ariel",
        fullName: "Ariel - Spectacular Singer",
        keywords: ["Singer 5"],
      });

      expect(singerRule.matches(ariel)).toBe(true);
    });

    it("should find songs that cost <= Singer value", () => {
      const ariel = createCard({
        id: "ariel-1",
        name: "Ariel",
        fullName: "Ariel - Spectacular Singer",
        cost: 5,
        keywords: ["Singer 5"],
      });

      const cheapSong = createCard({
        id: "song-1",
        name: "Part of Your World",
        type: ["Action"],
        cost: 3,
        classifications: ["Song"],
      });

      const expensiveSong = createCard({
        id: "song-2",
        name: "Powerful Song",
        type: ["Action"],
        cost: 7,
        classifications: ["Song"],
      });

      const allCards = [ariel, cheapSong, expensiveSong];
      const synergies = singerRule.findSynergies(ariel, allCards);

      expect(synergies.find((s) => s.card.id === "song-1")).toBeDefined();
      expect(synergies.find((s) => s.card.id === "song-2")).toBeUndefined();
    });
  });

  describe("Shift Targets", () => {
    const shiftRule = getRuleById("shift-targets")!;

    it("should find same-named characters for Shift", () => {
      const elsaShift = createCard({
        id: "elsa-shift",
        name: "Elsa",
        fullName: "Elsa - Ice Maker",
        cost: 7,
        keywords: ["Shift 5"],
        classifications: ["Floodborn"],
      });

      const elsaBase = createCard({
        id: "elsa-base",
        name: "Elsa",
        fullName: "Elsa - Snow Queen",
        cost: 4,
      });

      const anna = createCard({
        id: "anna-1",
        name: "Anna",
        fullName: "Anna - Heir to Arendelle",
        cost: 3,
      });

      const allCards = [elsaShift, elsaBase, anna];
      const synergies = shiftRule.findSynergies(elsaShift, allCards);

      expect(synergies.find((s) => s.card.id === "elsa-base")).toBeDefined();
      expect(synergies.find((s) => s.card.id === "anna-1")).toBeUndefined();
    });
  });

  describe("Exert Synergies", () => {
    const exertRule = getRuleById("exert-synergies")!;

    it("should find synergy between exert effects and exerted-character benefits", () => {
      const exerter = createCard({
        id: "exert-1",
        name: "Controller",
        text: "When played, exert chosen opposing character.",
      });

      const benefitsFromExert = createCard({
        id: "benefit-1",
        name: "Punisher",
        text: "Deal 2 damage to each exerted character.",
      });

      const allCards = [exerter, benefitsFromExert];
      const synergies = exertRule.findSynergies(exerter, allCards);

      expect(synergies.find((s) => s.card.id === "benefit-1")).toBeDefined();
    });
  });
});

describe("Card Helper Functions", () => {
  describe("hasNegativeTargeting", () => {
    it("should detect exert targeting", () => {
      const card = createCard({
        text: "When you play this character, you may exert chosen Princess character.",
      });

      expect(hasNegativeTargeting(card, "Princess")).toBe(true);
      expect(hasNegativeTargeting(card, "Villain")).toBe(false);
    });

    it("should detect banish targeting", () => {
      const card = createCard({
        text: "Banish target Villain character.",
      });

      expect(hasNegativeTargeting(card, "Villain")).toBe(true);
    });
  });

  describe("hasPositiveClassificationEffect", () => {
    it("should detect positive buff effects", () => {
      const card = createCard({
        text: "Your Princess characters get +2 strength.",
      });

      expect(hasPositiveClassificationEffect(card, "Princess")).toBe(true);
    });

    it("should detect conditional benefits", () => {
      const card = createCard({
        text: "If you have a Villain character, draw a card.",
      });

      expect(hasPositiveClassificationEffect(card, "Villain")).toBe(true);
    });
  });
});
