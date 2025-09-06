import type { RequestHandler } from "express";

const BASE = "https://ce.judge0.com"; // Judge0 CE (no API key)

let cachedLanguages: any[] | null = null;
let cacheTime = 0;

async function fetchLanguages(): Promise<any[]> {
  const now = Date.now();
  if (cachedLanguages && now - cacheTime < 6 * 60 * 60 * 1000) return cachedLanguages;
  const res = await fetch(`${BASE}/languages`);
  if (!res.ok) throw new Error(`Failed to fetch Judge0 languages: ${res.status}`);
  const langs = (await res.json()) as any[];
  cachedLanguages = langs;
  cacheTime = now;
  return langs;
}

function pickLanguageId(langs: any[], alias: string): number | null {
  const a = alias.toLowerCase();
  const prefer = (substr: string) => langs.filter((l) => String(l.name).toLowerCase().includes(substr));
  if (a === "c") {
    const list = prefer("c (gcc");
    const last = list[list.length - 1];
    return last?.id ?? null;
  }
  if (a === "cpp" || a === "c++") {
    const list = prefer("c++ (g++");
    const last = list[list.length - 1];
    return last?.id ?? null;
  }
  if (a === "java") {
    const list = prefer("java (");
    const last = list[list.length - 1];
    return last?.id ?? null;
  }
  return null;
}

export const compileJudge0: RequestHandler = async (req, res) => {
  try {
    const { language, code, stdin } = req.body ?? {} as { language: string; code: string; stdin?: string };
    if (typeof code !== "string" || !code.trim()) return res.status(400).json({ ok: false, error: "Code is required" });
    if (typeof language !== "string") return res.status(400).json({ ok: false, error: "language is required" });

    const langs = await fetchLanguages();
    let language_id: number | null = pickLanguageId(langs, language);
    if (!language_id) return res.status(400).json({ ok: false, error: `Unsupported language alias: ${language}` });

    const submissionBody = {
      language_id,
      source_code: Buffer.from(code, "utf8").toString("base64"),
      stdin: typeof stdin === "string" ? Buffer.from(stdin, "utf8").toString("base64") : undefined,
    } as Record<string, any>;

    const post = await fetch(`${BASE}/submissions?base64_encoded=true&wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submissionBody),
    });
    if (!post.ok) {
      const text = await post.text();
      return res.status(post.status).json({ ok: false, error: text });
    }
    const result = (await post.json()) as any;

    const decode = (v: any) => {
      if (!v) return "";
      try { return Buffer.from(String(v), "base64").toString("utf8"); } catch { return String(v); }
    };

    res.json({
      ok: true,
      status: result.status,
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
      compile_output: decode(result.compile_output),
      time: result.time,
      memory: result.memory,
      language_id,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
};
