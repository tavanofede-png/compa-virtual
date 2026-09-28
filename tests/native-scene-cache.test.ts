import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const fixture = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  download: new Uint8Array(),
  downloads: 0,
}));
vi.mock("../apps/mobile/node_modules/expo-file-system/src/index.ts", () => {
  class Directory {
    uri: string;
    constructor(parent: string, child: string) {
      this.uri = `${parent}/${child}`;
    }
    create() {}
    list() {
      return [...fixture.files.keys()].map((uri) => new File(uri));
    }
  }
  class File {
    uri: string;
    constructor(parent: Directory | string, child?: string) {
      this.uri = child
        ? `${typeof parent === "string" ? parent : parent.uri}/${child}`
        : String(parent);
    }
    get exists() {
      return fixture.files.has(this.uri);
    }
    get size() {
      return fixture.files.get(this.uri)?.byteLength ?? 0;
    }
    get lastModified() {
      return 0;
    }
    delete() {
      fixture.files.delete(this.uri);
    }
    async arrayBuffer() {
      return fixture.files.get(this.uri)!.slice().buffer;
    }
    static async downloadFileAsync(_url: string, file: File) {
      fixture.downloads++;
      fixture.files.set(file.uri, fixture.download.slice());
      return file;
    }
  }
  return {
    Directory,
    File,
    Paths: { cache: "file:///cache", availableDiskSpace: 1024 ** 3 },
  };
});
vi.mock("../apps/mobile/node_modules/expo-crypto/build/Crypto.js", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  async digest(_algorithm: string, input: Uint8Array) {
    // Match ExpoCrypto's Android TypedArray bridge, which rejects ArrayBuffer.
    if (!(input instanceof Uint8Array))
      throw Error("Expected a TypedArray in Android's native digest");
    const { createHash } = await import("node:crypto");
    return Uint8Array.from(createHash("sha256").update(input).digest()).buffer;
  },
}));
import { readCachedScene } from "../apps/mobile/src/scene-cache";

const binary = new Uint8Array(20);
const header = new DataView(binary.buffer);
header.setUint32(0, 0x46546c67, true);
header.setUint32(4, 2, true);
header.setUint32(8, binary.length, true);
const entry = {
  id: "cozy",
  url: "/selection/models/cozy-room.glb",
  bytes: binary.length,
  sha256: createHash("sha256").update(binary).digest("hex"),
};

beforeEach(() => {
  fixture.files.clear();
  fixture.download = binary.slice();
  fixture.downloads = 0;
});
describe("native scene verification", () => {
  it("verifies a downloaded room through Android's TypedArray contract and reuses the cache", async () => {
    expect(new Uint8Array(await readCachedScene(entry))).toEqual(binary);
    expect(new Uint8Array(await readCachedScene(entry))).toEqual(binary);
    expect(fixture.downloads).toBe(1);
  });
  it("removes a corrupt file and permits a subsequent valid retry", async () => {
    fixture.download[16] = 1;
    await expect(readCachedScene(entry)).rejects.toThrow("no coincide");
    expect(fixture.files.size).toBe(0);
    fixture.download = binary.slice();
    expect(new Uint8Array(await readCachedScene(entry))).toEqual(binary);
  });
  it("rejects partial downloads and invalid manifests before parsing a GLB", async () => {
    fixture.download = binary.slice(0, 14);
    await expect(readCachedScene(entry)).rejects.toThrow("incompleta");
    await expect(
      readCachedScene({ ...entry, url: "/private/file.glb" }),
    ).rejects.toThrow("manifiesto");
    expect(fixture.files.size).toBe(0);
    expect(fixture.downloads).toBe(1);
  });
  it("does not start a download after the scene has been cancelled", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(readCachedScene(entry, abort.signal)).rejects.toThrow(
      "cancelada",
    );
    expect(fixture.downloads).toBe(0);
  });
});
