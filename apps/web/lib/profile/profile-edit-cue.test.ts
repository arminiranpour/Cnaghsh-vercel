import { describe, expect, it } from "vitest";

import {
  didProfileEditableFieldsChange,
  shouldHighlightEditProfileIcon,
} from "./profile-edit-cue";

function createProfileSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    firstName: null,
    lastName: null,
    stageName: null,
    age: null,
    birthDate: null,
    bio: null,
    avatarUrl: null,
    cityId: null,
    phone: "09123456789",
    address: null,
    gallery: null,
    skills: null,
    languages: null,
    accents: null,
    experience: null,
    degrees: null,
    voices: null,
    awards: [],
    videos: null,
    introVideoMediaId: null,
    ...overrides,
  };
}

describe("profile edit cue", () => {
  it("does not treat unchanged snapshots as edited", () => {
    const previous = createProfileSnapshot({
      birthDate: new Date("2024-01-01T00:00:00.000Z"),
    });
    const next = createProfileSnapshot({
      birthDate: new Date("2024-01-01T00:00:00.000Z"),
    });

    expect(didProfileEditableFieldsChange(previous, next)).toBe(false);
  });

  it("treats a phone-only edit as a real profile edit", () => {
    const previous = createProfileSnapshot();
    const next = createProfileSnapshot({ phone: "09999999999" });

    expect(didProfileEditableFieldsChange(previous, next)).toBe(true);
  });

  it("treats gallery additions as a real profile edit", () => {
    const previous = createProfileSnapshot({ gallery: null });
    const next = createProfileSnapshot({
      gallery: [{ url: "https://example.com/photo.jpg", slot: "headshotFront" }],
    });

    expect(didProfileEditableFieldsChange(previous, next)).toBe(true);
  });

  it("highlights the icon until the profile has real edits", () => {
    expect(shouldHighlightEditProfileIcon(null)).toBe(true);
    expect(shouldHighlightEditProfileIcon({ hasProfileEdits: false })).toBe(true);
    expect(shouldHighlightEditProfileIcon({ hasProfileEdits: true })).toBe(false);
  });
});
