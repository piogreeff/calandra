import { itemSchema, type Item, type Rarity } from "@calandra/contract";

export class ItemTextParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemTextParseError";
  }
}

export class ClientLogParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientLogParseError";
  }
}

export type ClientLogEvent =
  | {
      type: "area-entered";
      areaName: string;
    }
  | {
      type: "area-generated";
      areaName: string;
      areaLevel: number;
      seed: string;
    }
  | {
      type: "unknown";
    };

export interface ParsedClientLogLine {
  timestamp: string;
  uptimeMs: number;
  channel: string;
  message: string;
  raw: string;
  event: ClientLogEvent;
}

export interface ParsedItemProperty {
  name: string;
  value: string;
  augmented: boolean;
}

export interface ParsedItemRequirement {
  name: string;
  value: number;
}

export interface ParsedClipboardItem {
  sourceText: string;
  itemClass: string;
  category: string;
  rarity: Rarity;
  name: string;
  baseType?: string;
  itemLevel?: number;
  quality?: number;
  properties: ParsedItemProperty[];
  requirements: ParsedItemRequirement[];
  implicitMods: string[];
  explicitMods: string[];
  corrupted: boolean;
  identified: boolean;
}

const rarityLabels: Record<string, Rarity> = {
  normal: "normal",
  magic: "magic",
  rare: "rare",
  unique: "unique",
  gem: "gem",
  currency: "currency",
};

const itemClassCategories: Record<string, string> = {
  amulets: "amulet",
  belts: "belt",
  "body armours": "body-armour",
  boots: "boots",
  bows: "bow",
  claws: "claw",
  crossbows: "crossbow",
  daggers: "dagger",
  foci: "focus",
  gloves: "gloves",
  helmets: "helmet",
  jewels: "jewel",
  "one hand axes": "one-hand-axe",
  "one hand maces": "one-hand-mace",
  "one hand swords": "one-hand-sword",
  quivers: "quiver",
  rings: "ring",
  sceptres: "sceptre",
  "skill gems": "skill-gem",
  "stackable currency": "currency",
  staves: "staff",
  "two hand axes": "two-hand-axe",
  "two hand maces": "two-hand-mace",
  "two hand swords": "two-hand-sword",
  wands: "wand",
};

const clientLogLinePattern =
  /^(?<timestamp>\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) (?<uptimeMs>\d+) \S+ \[(?<channel>[^\]]+)] (?<message>.*)$/;

export function parseClientLogLine(input: string): ParsedClientLogLine {
  const raw = input.trim();
  const match = raw.match(clientLogLinePattern);
  const groups = match?.groups;
  if (!groups) {
    throw new ClientLogParseError(
      "Client.txt line does not match the expected log format",
    );
  }

  const message = normalizeClientLogMessage(groups.message ?? "");
  return {
    timestamp: groups.timestamp ?? "",
    uptimeMs: Number.parseInt(groups.uptimeMs ?? "0", 10),
    channel: groups.channel ?? "",
    message,
    raw,
    event: parseClientLogEvent(message),
  };
}

export function parseClientLogText(input: string): ParsedClientLogLine[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseClientLogLine);
}

export function parseItemText(input: string): ParsedClipboardItem {
  const sourceText = input.trim();
  if (sourceText.length === 0) {
    throw new ItemTextParseError("Item text is empty");
  }

  const sections = splitSections(sourceText);
  const header = sections[0];
  if (!header) {
    throw new ItemTextParseError("Item text is missing a header");
  }

  const itemClassLine = findPrefixedLine(header, "Item Class");
  const rarityLine = findPrefixedLine(header, "Rarity");
  if (!itemClassLine || !rarityLine) {
    throw new ItemTextParseError("Item text is missing item class or rarity");
  }

  const itemClass = itemClassLine.value;
  const rarity = parseRarity(rarityLine.value);
  const titleLines = header.filter((line) => !line.includes(":"));
  const title = parseTitleLines(rarity, titleLines);

  const parsed: ParsedClipboardItem = {
    sourceText,
    itemClass,
    category: categoryForItemClass(itemClass),
    rarity,
    name: title.name,
    ...(title.baseType ? { baseType: title.baseType } : {}),
    properties: [],
    requirements: [],
    implicitMods: [],
    explicitMods: [],
    corrupted: false,
    identified: true,
  };

  let hasReachedModifierArea = false;
  for (const section of sections.slice(1)) {
    const consumedItemLevel = consumeSection(
      parsed,
      section,
      hasReachedModifierArea,
    );
    if (consumedItemLevel) {
      hasReachedModifierArea = true;
    }
  }

  return parsed;
}

export function toContractItem(item: ParsedClipboardItem): Item {
  return itemSchema.parse({
    id: `${item.category}/${slugify(item.name)}`,
    name: item.name,
    category: item.category,
    rarity: item.rarity,
  });
}

function normalizeClientLogMessage(message: string): string {
  return message.replace(/^:\s*/, "").trim();
}

function parseClientLogEvent(message: string): ClientLogEvent {
  const enteredArea = message.match(/^You have entered (?<areaName>.+)\.$/);
  if (enteredArea?.groups?.areaName) {
    return {
      type: "area-entered",
      areaName: enteredArea.groups.areaName,
    };
  }

  const generatedArea = message.match(
    /^Generating level (?<areaLevel>\d+) area "(?<areaName>.+)" with seed (?<seed>\d+)$/,
  );
  if (generatedArea?.groups) {
    return {
      type: "area-generated",
      areaName: generatedArea.groups.areaName ?? "",
      areaLevel: Number.parseInt(generatedArea.groups.areaLevel ?? "0", 10),
      seed: generatedArea.groups.seed ?? "",
    };
  }

  return { type: "unknown" };
}

function splitSections(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n-{8,}\n/)
    .map((section) =>
      section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((section) => section.length > 0);
}

function findPrefixedLine(
  lines: string[],
  key: string,
): { key: string; value: string } | undefined {
  const prefix = `${key}:`;
  const line = lines.find((entry) => entry.startsWith(prefix));
  if (!line) {
    return undefined;
  }
  return { key, value: line.slice(prefix.length).trim() };
}

function parseRarity(value: string): Rarity {
  const rarity = rarityLabels[value.toLowerCase()];
  if (!rarity) {
    throw new ItemTextParseError(`Unsupported item rarity: ${value}`);
  }
  return rarity;
}

function parseTitleLines(
  rarity: Rarity,
  titleLines: string[],
): { name: string; baseType?: string } {
  const [first, second] = titleLines;
  if (!first) {
    throw new ItemTextParseError("Item text is missing an item name");
  }

  if ((rarity === "rare" || rarity === "unique") && second) {
    return { name: first, baseType: second };
  }

  return { name: first };
}

function categoryForItemClass(itemClass: string): string {
  const normalized = itemClass.toLowerCase();
  return (
    itemClassCategories[normalized] ?? slugify(itemClass.replace(/s$/i, ""))
  );
}

function consumeSection(
  item: ParsedClipboardItem,
  section: string[],
  hasReachedModifierArea: boolean,
): boolean {
  const [firstLine] = section;
  if (!firstLine) {
    return false;
  }

  if (firstLine === "Requirements:") {
    item.requirements.push(...parseRequirements(section.slice(1)));
    return false;
  }

  const itemLevel = findPrefixedLine(section, "Item Level");
  if (itemLevel) {
    item.itemLevel = parseIntegerValue("Item Level", itemLevel.value);
    return true;
  }

  if (section.length === 1 && firstLine === "Corrupted") {
    item.corrupted = true;
    return false;
  }

  if (section.length === 1 && firstLine === "Unidentified") {
    item.identified = false;
    return false;
  }

  if (!hasReachedModifierArea && section.every((line) => line.includes(":"))) {
    const properties = section.map(parseProperty);
    item.properties.push(...properties);
    const quality = properties.find((property) => property.name === "Quality");
    if (quality) {
      const parsedQuality = parseSignedPercentage(quality.value);
      if (parsedQuality !== undefined) {
        item.quality = parsedQuality;
      }
    }
    return false;
  }

  const normalizedMods = section.map(normalizeModLine);
  if (normalizedMods.every((line) => line.endsWith("(implicit)"))) {
    item.implicitMods.push(
      ...normalizedMods.map((line) => line.replace(/\s+\(implicit\)$/, "")),
    );
    return false;
  }

  item.explicitMods.push(...normalizedMods);
  return false;
}

function parseProperty(line: string): ParsedItemProperty {
  const separator = line.indexOf(":");
  if (separator === -1) {
    throw new ItemTextParseError(`Invalid property line: ${line}`);
  }

  const rawValue = line.slice(separator + 1).trim();
  return {
    name: line.slice(0, separator).trim(),
    value: rawValue.replace(/\s+\(augmented\)$/, ""),
    augmented: rawValue.endsWith("(augmented)"),
  };
}

function parseRequirements(lines: string[]): ParsedItemRequirement[] {
  return lines.map((line) => {
    const property = parseProperty(line);
    return {
      name: property.name,
      value: parseIntegerValue(property.name, property.value),
    };
  });
}

function parseIntegerValue(label: string, value: string): number {
  const match = value.match(/\d+/);
  if (!match) {
    throw new ItemTextParseError(`${label} must contain a number`);
  }
  return Number.parseInt(match[0], 10);
}

function parseSignedPercentage(value: string): number | undefined {
  const match = value.match(/[+-]?(\d+)%/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : undefined;
}

function normalizeModLine(line: string): string {
  return line.replace(/\s+\(augmented\)$/, "").trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
