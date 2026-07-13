import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("profile image storage", () => {
  it("uploads profile images to the public object bucket and returns the public media URL", async () => {
    const putBuffer = vi.fn().mockResolvedValue(undefined);
    const resolveBucketForVisibility = vi.fn().mockReturnValue("public-bucket");
    const getPublicMediaUrlFromKey = vi
      .fn((key: string) => `https://cdn.example.com/media-public/${key}`);

    vi.doMock("@/lib/storage/s3", () => ({ putBuffer }));
    vi.doMock("@/lib/storage/visibility", () => ({ resolveBucketForVisibility }));
    vi.doMock("@/lib/media/urls", () => ({ getPublicMediaUrlFromKey }));

    const { saveImageFromFormData } = await import("@/lib/media/storage");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const result = await saveImageFromFormData(formData, "user_123");

    expect(resolveBucketForVisibility).toHaveBeenCalledWith("public");
    expect(putBuffer).toHaveBeenCalledTimes(1);
    expect(putBuffer.mock.calls[0]?.[0]).toBe("public-bucket");
    expect(putBuffer.mock.calls[0]?.[1]).toMatch(
      /^uploads\/profile-images\/user_123\/\d+-[0-9a-f-]+\.png$/,
    );
    expect(putBuffer.mock.calls[0]?.[2]).toBeInstanceOf(Buffer);
    expect(putBuffer.mock.calls[0]?.[3]).toBe("image/png");
    expect(getPublicMediaUrlFromKey).toHaveBeenCalledWith(putBuffer.mock.calls[0]?.[1]);
    expect(result.url).toBe(`https://cdn.example.com/media-public/${putBuffer.mock.calls[0]?.[1]}`);
  });

  it("deletes profile images by object key from the public media URL", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const resolveBucketForVisibility = vi.fn().mockReturnValue("public-bucket");

    vi.doMock("@/lib/storage/s3", () => ({ remove }));
    vi.doMock("@/lib/storage/visibility", () => ({ resolveBucketForVisibility }));
    vi.doMock("@/lib/media/cdn-config", () => ({
      mediaCdnConfig: {
        publicBaseUrl: "https://cdn.example.com/media-public",
        cdnBaseUrl: "https://cdn.example.com/media-public",
        originBaseUrl: "https://origin.example.com/media-public",
        isSignedCdn: false,
      },
    }));

    const { deleteByUrl } = await import("@/lib/media/storage");

    await deleteByUrl(
      "https://cdn.example.com/media-public/uploads/profile-images/user_123/avatar%20image.png",
      "user_123",
    );

    expect(resolveBucketForVisibility).toHaveBeenCalledWith("public");
    expect(remove).toHaveBeenCalledWith(
      "public-bucket",
      "uploads/profile-images/user_123/avatar image.png",
    );
  });

  it("returns a clear error when object storage configuration cannot be loaded", async () => {
    vi.doMock("@/lib/storage/s3", () => ({ putBuffer: vi.fn() }));
    vi.doMock("@/lib/storage/visibility", () => {
      throw new Error("missing S3 config");
    });
    vi.doMock("@/lib/media/urls", () => ({ getPublicMediaUrlFromKey: vi.fn() }));

    const { saveImageFromFormData } = await import("@/lib/media/storage");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    await expect(saveImageFromFormData(formData, "user_123")).rejects.toEqual(
      expect.objectContaining({
        name: "MediaStorageError",
        message: "تنظیمات ذخیره سازی تصاویر کامل نیست.",
      }),
    );
  });
});
