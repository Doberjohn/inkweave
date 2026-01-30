import type { SynergyRule, SynergyMatch, SynergyStrength } from "../types";
import {
  textContains,
  hasKeyword,
  hasClassification,
  getBaseName,
  getKeywordValue,
  isSong,
  isCharacter,
  hasNegativeTargeting,
} from "../../cards";

// ============================================
// SYNERGY RULES
// ============================================

export const synergyRules: SynergyRule[] = [
  // --------------------------------------------
  // SINGER + SONGS
  // --------------------------------------------
  {
    id: "singer-songs",
    name: "Singer + Songs",
    type: "keyword",
    description: "Characters with Singer can use their cost to play Songs",

    matches: (card) => hasKeyword(card, "Singer"),

    findSynergies: (card, allCards) => {
      // Extract Singer value (e.g., "Singer 5" means can play songs up to cost 5)
      const singerValue = getKeywordValue(card, "Singer") ?? card.cost;

      return allCards
        .filter((other) => isSong(other) && other.cost <= singerValue)
        .map((song): SynergyMatch => ({
          card: song,
          strength: song.cost >= singerValue - 1 ? "strong" : "moderate",
          explanation: `${card.name} (Singer ${singerValue}) can play ${song.name} (cost ${song.cost}) for free`,
          bidirectional: true,
        }));
    },
  },

  // --------------------------------------------
  // EVASIVE + QUEST TRIGGERS
  // --------------------------------------------
  {
    id: "evasive-quest",
    name: "Evasive + Quest Triggers",
    type: "keyword",
    description: "Evasive characters can safely trigger quest abilities",

    matches: (card) => hasKeyword(card, "Evasive"),

    findSynergies: (card, allCards) => {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            (textContains(other, "when this character quests") ||
              textContains(other, /whenever .* quests/i) ||
              textContains(other, "gains evasive"))
        )
        .map((other): SynergyMatch => ({
          card: other,
          strength: "moderate",
          explanation: `${card.name}'s Evasive allows safe questing to trigger ${other.name}'s ability`,
          bidirectional: false,
        }));
    },
  },

  // --------------------------------------------
  // SHIFT TARGETS
  // --------------------------------------------
  {
    id: "shift-targets",
    name: "Shift Targets",
    type: "shift",
    description: "Floodborn characters can Shift onto same-named characters",

    matches: (card) => hasKeyword(card, "Shift"),

    findSynergies: (card, allCards) => {
      const baseName = getBaseName(card);

      return allCards
        .filter((other) => {
          if (other.id === card.id) return false;
          const otherBase = getBaseName(other);
          return otherBase === baseName && isCharacter(other);
        })
        .map((target): SynergyMatch => {
          const costDiff = card.cost - target.cost;
          const strength: SynergyStrength =
            costDiff >= 4 ? "strong" : costDiff >= 2 ? "moderate" : "weak";

          return {
            card: target,
            strength,
            explanation: `${card.name} can Shift onto ${target.fullName} (cost ${target.cost})`,
            bidirectional: true,
          };
        });
    },
  },

  // --------------------------------------------
  // CLASSIFICATION TRIBAL - PRINCESS
  // --------------------------------------------
  {
    id: "princess-tribal",
    name: "Princess Synergies",
    type: "classification",
    description: "Cards that benefit Princess characters",

    // Match "Princess character" to avoid false positives like ability names containing "Princess"
    matches: (card) =>
      hasClassification(card, "Princess") ||
      (textContains(card, /princess character/i) && !hasNegativeTargeting(card, "Princess")),

    findSynergies: (card, allCards) => {
      if (hasClassification(card, "Princess")) {
        // Princess character: find cards that mention "Princess character" without negative targeting
        return allCards
          .filter(
            (other) =>
              other.id !== card.id &&
              textContains(other, /princess character/i) &&
              !hasClassification(other, "Princess") &&
              !hasNegativeTargeting(other, "Princess")
          )
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${other.name} benefits Princess characters like ${card.name}`,
            bidirectional: true,
          }));
      } else {
        // Card that benefits Princesses: find Princess characters
        return allCards
          .filter((other) => other.id !== card.id && hasClassification(other, "Princess"))
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${card.name} benefits ${other.name} (Princess)`,
            bidirectional: true,
          }));
      }
    },
  },

  // --------------------------------------------
  // CLASSIFICATION TRIBAL - VILLAIN
  // --------------------------------------------
  {
    id: "villain-tribal",
    name: "Villain Synergies",
    type: "classification",
    description: "Cards that benefit Villain characters",

    // Match "Villain character" to avoid false positives
    matches: (card) =>
      hasClassification(card, "Villain") ||
      (textContains(card, /villain character/i) && !hasNegativeTargeting(card, "Villain")),

    findSynergies: (card, allCards) => {
      if (hasClassification(card, "Villain")) {
        // Villain character: find cards that mention "Villain character" without negative targeting
        return allCards
          .filter(
            (other) =>
              other.id !== card.id &&
              textContains(other, /villain character/i) &&
              !hasClassification(other, "Villain") &&
              !hasNegativeTargeting(other, "Villain")
          )
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${other.name} benefits Villain characters like ${card.name}`,
            bidirectional: true,
          }));
      } else {
        // Card that benefits Villains: find Villain characters
        return allCards
          .filter((other) => other.id !== card.id && hasClassification(other, "Villain"))
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${card.name} benefits ${other.name} (Villain)`,
            bidirectional: true,
          }));
      }
    },
  },

  // --------------------------------------------
  // CLASSIFICATION TRIBAL - HERO
  // --------------------------------------------
  {
    id: "hero-tribal",
    name: "Hero Synergies",
    type: "classification",
    description: "Cards that benefit Hero characters",

    // Match "Hero character" to avoid false positives
    matches: (card) =>
      hasClassification(card, "Hero") ||
      (textContains(card, /hero character/i) && !hasNegativeTargeting(card, "Hero")),

    findSynergies: (card, allCards) => {
      if (hasClassification(card, "Hero")) {
        // Hero character: find cards that mention "Hero character" without negative targeting
        return allCards
          .filter(
            (other) =>
              other.id !== card.id &&
              textContains(other, /hero character/i) &&
              !hasClassification(other, "Hero") &&
              !hasNegativeTargeting(other, "Hero")
          )
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${other.name} benefits Hero characters like ${card.name}`,
            bidirectional: true,
          }));
      } else {
        // Card that benefits Heroes: find Hero characters
        return allCards
          .filter((other) => other.id !== card.id && hasClassification(other, "Hero"))
          .map((other): SynergyMatch => ({
            card: other,
            strength: "moderate",
            explanation: `${card.name} benefits ${other.name} (Hero)`,
            bidirectional: true,
          }));
      }
    },
  },

  // --------------------------------------------
  // CHALLENGER + STAT BUFFS
  // --------------------------------------------
  {
    id: "challenger-buffs",
    name: "Challenger + Strength Buffs",
    type: "keyword",
    description: "Challenger characters benefit from strength buffs",

    matches: (card) => hasKeyword(card, "Challenger"),

    findSynergies: (card, allCards) => {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            (textContains(other, /\+\d+\s*(strength|\{S\})/i) ||
              textContains(other, /gets? \+/i) ||
              textContains(other, /gains? \+/i))
        )
        .map((other): SynergyMatch => ({
          card: other,
          strength: "moderate",
          explanation: `${other.name} can buff ${card.name}'s Challenger attacks`,
          bidirectional: false,
        }));
    },
  },

  // --------------------------------------------
  // EXERT SYNERGIES
  // --------------------------------------------
  {
    id: "exert-synergies",
    name: "Exert Synergies",
    type: "mechanic",
    description: "Cards that interact with exerted characters",

    matches: (card) => textContains(card, "exert") || textContains(card, "exerted"),

    findSynergies: (card, allCards) => {
      const exertsOthers =
        textContains(card, "exert chosen") ||
        textContains(card, "exert an opposing") ||
        textContains(card, "exert target");

      if (exertsOthers) {
        return allCards
          .filter(
            (other) =>
              other.id !== card.id &&
              (textContains(other, "exerted character") || textContains(other, /if .* exerted/i))
          )
          .map((other): SynergyMatch => ({
            card: other,
            strength: "strong",
            explanation: `${card.name} exerts opponents, enabling ${other.name}'s effects`,
            bidirectional: true,
          }));
      }

      return [];
    },
  },

  // --------------------------------------------
  // DRAW ENGINE
  // --------------------------------------------
  {
    id: "draw-engine",
    name: "Card Draw Synergies",
    type: "mechanic",
    description: "Cards that enable or benefit from drawing",

    matches: (card) => textContains(card, "draw") && !textContains(card, "withdraw"),

    findSynergies: (card, allCards) => {
      const drawsCards =
        textContains(card, "draw a card") ||
        textContains(card, "draw 2") ||
        textContains(card, "draw cards");

      if (drawsCards) {
        return allCards
          .filter(
            (other) =>
              other.id !== card.id &&
              (textContains(other, "whenever you draw") ||
                textContains(other, "when you draw") ||
                textContains(other, "for each card you drew"))
          )
          .map((other): SynergyMatch => ({
            card: other,
            strength: "strong",
            explanation: `${card.name}'s draw triggers ${other.name}'s ability`,
            bidirectional: true,
          }));
      }

      return [];
    },
  },

  // --------------------------------------------
  // INK RAMP
  // --------------------------------------------
  {
    id: "ink-ramp",
    name: "Ink Ramp",
    type: "mechanic",
    description: "Cards that accelerate ink production pair with expensive cards",

    matches: (card) =>
      textContains(card, /gain .* ink/i) ||
      textContains(card, /add .* to your inkwell/i) ||
      textContains(card, /put .* into your inkwell/i),

    findSynergies: (card, allCards) => {
      return allCards
        .filter((other) => other.id !== card.id && other.cost >= 6)
        .slice(0, 10)
        .map((other): SynergyMatch => ({
          card: other,
          strength: other.cost >= 8 ? "strong" : "moderate",
          explanation: `${card.name}'s ink ramp helps play ${other.name} (cost ${other.cost}) earlier`,
          bidirectional: false,
        }));
    },
  },

  // --------------------------------------------
  // WARD + AGGRESSIVE STRATEGIES
  // --------------------------------------------
  {
    id: "ward-aggro",
    name: "Ward + Aggression",
    type: "keyword",
    description: "Ward characters are safer for aggressive plays",

    matches: (card) => hasKeyword(card, "Ward"),

    findSynergies: (card, allCards) => {
      return allCards
        .filter(
          (other) =>
            other.id !== card.id &&
            (textContains(other, "challenge") ||
              hasKeyword(other, "Challenger") ||
              textContains(other, "ready"))
        )
        .map((other): SynergyMatch => ({
          card: other,
          strength: "moderate",
          explanation: `${card.name}'s Ward makes it a safer target for ${other.name}'s effects`,
          bidirectional: false,
        }));
    },
  },
];

// Get all rules
export const getAllRules = (): SynergyRule[] => synergyRules;

// Get rules by type
export const getRulesByType = (type: SynergyRule["type"]): SynergyRule[] => {
  return synergyRules.filter((rule) => rule.type === type);
};

// Get a specific rule by ID
export const getRuleById = (id: string): SynergyRule | undefined => {
  return synergyRules.find((rule) => rule.id === id);
};
