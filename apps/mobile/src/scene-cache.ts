import { Directory, File, Paths } from "expo-file-system";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";

export interface SceneAssetEntry {
  id: string;
  url: string;
  bytes: number;
  sha256: string;
}

const assetBase = (
  process.env.EXPO_PUBLIC_SCENE_ASSET_BASE_URL ||
  process.env.EXPO_PUBLIC_STUDY_ASSET_BASE_URL ||
  "https://kusiy.vercel.app"
).replace(/\/$/, "");
const cacheLimit = 250 * 1024 * 1024;

/** A bounded device cache shared by bedrooms, individual and group rooms. */
export async function readCachedScene(
  entry: SceneAssetEntry,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  if (
    (!/^\/selection\/(?:study-spaces|shared-spaces)\/[a-z-]+\.glb$/.test(
      entry.url,
    ) &&
      !/^\/selection\/models\/[a-z-]+-room\.glb$/.test(entry.url)) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes < 12 ||
    !/^[a-f0-9]{64}$/.test(entry.sha256)
  )
    throw Error("El recurso 3D no tiene un manifiesto válido.");
  if (signal?.aborted) throw Error("Descarga cancelada.");
  const directory = new Directory(Paths.cache, "kusiy-scenes");
  directory.create({ idempotent: true });
  const file = new File(
    directory,
    `${entry.sha256.slice(0, 16)}-${entry.id}.glb`,
  );
  if (file.exists && file.size !== entry.bytes) file.delete();
  if (!file.exists) {
    if (Paths.availableDiskSpace < entry.bytes * 1.5)
      throw Error(
        "No hay espacio libre suficiente para descargar este ambiente.",
      );
    try {
      await File.downloadFileAsync(`${assetBase}${entry.url}`, file, {
        signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
        },
      });
    } catch (error) {
      if (file.exists) file.delete();
      throw error;
    }
  }
  if (signal?.aborted) throw Error("Descarga cancelada.");
  if (file.size !== entry.bytes) {
    file.delete();
    throw Error("La descarga quedó incompleta. Volvé a intentarlo.");
  }
  const bytes = await file.arrayBuffer();
  // Android's ExpoCrypto bridge accepts a TypedArray, not a bare ArrayBuffer.
  // BufferSource in the JS signature is broader than the native contract.
  const actualHash = Array.from(
    new Uint8Array(
      await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes)),
    ),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
  if (actualHash !== entry.sha256) {
    file.delete();
    throw Error(
      "El archivo 3D no coincide con la versión publicada. Volvé a intentarlo.",
    );
  }
  const header = new DataView(bytes);
  if (
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(8, true) !== bytes.byteLength
  ) {
    file.delete();
    throw Error("El archivo 3D está dañado. Volvé a intentarlo.");
  }
  const files = directory
    .list()
    .filter((item): item is File => item instanceof File);
  let total = files.reduce((sum, item) => sum + item.size, 0);
  for (const old of files
    .filter((item) => item.uri !== file.uri)
    .sort((a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0))) {
    if (total <= cacheLimit) break;
    total -= old.size;
    old.delete();
  }
  return bytes;
}
