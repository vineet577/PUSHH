import type { RequestHandler } from "express";
import type { RequestInit } from "undici";
import { Buffer } from "node:buffer";

interface PushBody {
  owner: string;
  repo: string;
  branch?: string; // default main
  path: string; // file path in repo
  message: string;
  content: string; // raw text content, will be base64 encoded
}

async function githubRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export const pushFile: RequestHandler = async (req, res) => {
  try {
    const token = req.header("x-github-token");
    if (!token) return res.status(401).json({ error: "Missing x-github-token header" });
    const { owner, repo, branch = "main", path, message, content } = (req.body ?? {}) as PushBody;
    if (!owner || !repo || !path || !message || typeof content !== "string") {
      return res.status(400).json({ error: "owner, repo, path, message, content are required" });
    }

    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    // Ensure branch ref exists; get the latest commit sha of branch
    const refData = await githubRequest<any>(token, `${base}/git/refs/heads/${encodeURIComponent(branch)}`);
    const commitSha: string = refData.object.sha;

    // Get current file sha if exists
    let sha: string | undefined;
    try {
      const fileData = await githubRequest<any>(token, `${base}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
      sha = fileData.sha;
    } catch {
      sha = undefined; // New file
    }

    const response = await githubRequest<any>(
      token,
      `${base}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          sha,
        }),
      },
    );

    res.json({ ok: true, content: { path: response.content?.path, sha: response.content?.sha }, commit: response.commit?.sha, baseCommit: commitSha });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
};
