import type { RequestHandler } from "express";
import vm from "node:vm";

export const compileAndRun: RequestHandler = async (req, res) => {
  const { language, code } = req.body ?? {};
  if (language !== "javascript") {
    return res.status(400).json({ error: "Only 'javascript' is supported" });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Code is required" });
  }

  const logs: string[] = [];
  const sandbox = {
    console: {
      log: (...args: any[]) => logs.push(args.map(String).join(" ")),
    },
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
  } as any;
  const context = vm.createContext(sandbox);
  const script = new vm.Script(code, {
    filename: "user-code.js",
    displayErrors: true,
  });

  try {
    const result = await Promise.race([
      Promise.resolve(script.runInContext(context, { timeout: 1000 })),
      new Promise((_r, reject) =>
        setTimeout(() => reject(new Error("Execution timed out")), 1200),
      ),
    ]);
    res.json({ ok: true, result: stringify(result), logs });
  } catch (err: any) {
    res
      .status(400)
      .json({ ok: false, error: err?.message ?? String(err), logs });
  }
};

function stringify(v: any): string {
  try {
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
