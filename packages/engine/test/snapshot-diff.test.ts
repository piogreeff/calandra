import { describe, expect, it } from "vitest";
import { diffAccountSnapshots } from "../src/index";

describe("deterministic account snapshot diff", () => {
  it("diffs official PoE2 character snapshots without requiring stash data", () => {
    const diff = diffAccountSnapshots(
      {
        id: "snapshot-before",
        capturedAt: "2026-06-21T10:00:00.000Z",
        characters: [
          {
            id: "character-1",
            name: "CalandraTest",
            className: "Deadeye",
            level: 72,
            equipment: [
              {
                slot: "gloves",
                name: "Frayed Mail Mitts",
                stats: { life: 40 },
              },
              {
                slot: "boots",
                name: "Threadbare Shoes",
                stats: { movementSpeed: 10 },
              },
            ],
          },
        ],
      },
      {
        id: "snapshot-after",
        capturedAt: "2026-06-21T12:00:00.000Z",
        characters: [
          {
            id: "character-1",
            name: "CalandraTest",
            className: "Deadeye",
            level: 73,
            equipment: [
              {
                slot: "gloves",
                name: "Duskthread Grips",
                stats: { life: 65, fireResistance: 18 },
              },
              {
                slot: "boots",
                name: "Threadbare Shoes",
                stats: { movementSpeed: 10 },
              },
              {
                slot: "ring",
                name: "Ruby Ring",
                stats: { fireResistance: 28 },
              },
            ],
          },
        ],
      },
    );

    expect(diff).toEqual({
      beforeSnapshotId: "snapshot-before",
      afterSnapshotId: "snapshot-after",
      beforeCapturedAt: "2026-06-21T10:00:00.000Z",
      afterCapturedAt: "2026-06-21T12:00:00.000Z",
      characterChanges: [
        {
          id: "character-1",
          name: "CalandraTest",
          type: "changed",
          beforeLevel: 72,
          afterLevel: 73,
          levelDelta: 1,
          equipmentChanges: [
            {
              type: "changed",
              slot: "gloves",
              beforeName: "Frayed Mail Mitts",
              afterName: "Duskthread Grips",
            },
            {
              type: "added",
              slot: "ring",
              afterName: "Ruby Ring",
            },
          ],
        },
      ],
      stashChanges: [],
    });
  });

  it("reports added and removed characters in deterministic id order", () => {
    const diff = diffAccountSnapshots(
      {
        id: "before",
        capturedAt: "2026-06-21T10:00:00.000Z",
        characters: [
          {
            id: "z-removed",
            name: "OldOne",
            className: "Witch",
            level: 10,
            equipment: [{ slot: "weapon", name: "Cracked Wand" }],
          },
        ],
      },
      {
        id: "after",
        capturedAt: "2026-06-21T11:00:00.000Z",
        characters: [
          {
            id: "a-added",
            name: "NewOne",
            className: "Mercenary",
            level: 5,
            equipment: [{ slot: "weapon", name: "Crossbow" }],
          },
        ],
      },
    );

    expect(diff.characterChanges.map((change) => change.id)).toEqual([
      "a-added",
      "z-removed",
    ]);
    expect(diff.characterChanges).toMatchObject([
      { type: "added", levelDelta: 5 },
      { type: "removed", levelDelta: -10 },
    ]);
  });

  it("diffs stash counts only when stash data is present", () => {
    const diff = diffAccountSnapshots(
      {
        id: "before",
        capturedAt: "2026-06-21T10:00:00.000Z",
        characters: [],
        stashes: [
          {
            id: "currency",
            name: "Currency",
            items: [
              { slot: "stash", name: "Divine Orb" },
              { slot: "stash", name: "Exalted Orb" },
            ],
          },
        ],
      },
      {
        id: "after",
        capturedAt: "2026-06-21T11:00:00.000Z",
        characters: [],
        stashes: [
          {
            id: "currency",
            name: "Currency",
            items: [{ slot: "stash", name: "Divine Orb" }],
          },
          {
            id: "maps",
            name: "Waystones",
            items: [{ slot: "stash", name: "Tier 1 Waystone" }],
          },
        ],
      },
    );

    expect(diff.stashChanges).toEqual([
      {
        id: "currency",
        name: "Currency",
        type: "changed",
        beforeItemCount: 2,
        afterItemCount: 1,
        itemCountDelta: -1,
      },
      {
        id: "maps",
        name: "Waystones",
        type: "added",
        afterItemCount: 1,
        itemCountDelta: 1,
      },
    ]);
  });

  it("returns an empty diff for identical snapshots", () => {
    const snapshot = {
      id: "same",
      capturedAt: "2026-06-21T10:00:00.000Z",
      characters: [
        {
          id: "character-1",
          name: "CalandraTest",
          className: "Deadeye",
          level: 72,
          equipment: [
            {
              slot: "gloves",
              name: "Duskthread Grips",
              stats: { fireResistance: 18, life: 65 },
            },
          ],
        },
      ],
    };

    expect(diffAccountSnapshots(snapshot, snapshot)).toMatchObject({
      characterChanges: [],
      stashChanges: [],
    });
  });
});
