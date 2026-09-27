import type { Repository } from "@compa/client";

export async function openMaterialOriginal(repo: Repository, path: string) {
  // Open synchronously in the click gesture, before fetching the private URL.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await repo.signedUrl(path);
    if (tab) tab.location.replace(url);
    else window.location.assign(url);
  } catch (error) { tab?.close(); throw error; }
}
