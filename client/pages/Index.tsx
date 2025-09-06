import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

type Language = "javascript" | "typescript" | "python" | "c" | "cpp" | "java";

export default function Index() {
  // GitHub settings
  const [token, setToken] = useState<string>("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [filePath, setFilePath] = useState("src/index.js");
  const [commitMessage, setCommitMessage] = useState(
    "feat: add code from in-app compiler",
  );
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState<string>(
    "console.log('Hello from in-app compiler!')",
  );
  const [compileResult, setCompileResult] = useState<string>("");
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [pushStatus, setPushStatus] = useState<string>("");

  // Pyodide loader (for Python)
  const pyodideRef = useRef<any>(null);
  const loadingPyRef = useRef(false);
  async function loadPyodideIfNeeded() {
    if (pyodideRef.current) return pyodideRef.current;
    if (loadingPyRef.current) {
      while (!pyodideRef.current) await new Promise((r) => setTimeout(r, 50));
      return pyodideRef.current;
    }
    loadingPyRef.current = true;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Pyodide"));
      document.head.appendChild(s);
    });
    const anyWin = window as any;
    const py = await anyWin.loadPyodide?.({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
    });
    py.setStdout({ write: (s: string) => setCompileLogs((l) => [...l, s]) });
    py.setStderr({ write: (s: string) => setCompileLogs((l) => [...l, s]) });
    pyodideRef.current = py;
    return py;
  }

  useEffect(() => {
    const saved = localStorage.getItem("gh_token");
    if (saved) setToken(saved);
  }, []);

  const saveToken = () => {
    localStorage.setItem("gh_token", token);
  };

  // CRUD: Items
  const qc = useQueryClient();
  const itemsQuery = useQuery<{ items: Item[] }>({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { title: string; description?: string }) => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      description,
    }: {
      id: string;
      title?: string;
      description?: string;
    }) => {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  function exampleFor(lang: Language) {
    switch (lang) {
      case "typescript":
        return "function add(a: number, b: number){ return a+b }\nconsole.log(add(2, 3));";
      case "python":
        return "print('Hello from Python!')\n\n# You can write Python 3.11 here";
      case "c":
        return "#include <stdio.h>\nint main(){ printf(\"Hello from C!\\n\"); return 0; }";
      case "cpp":
        return "#include <iostream>\nint main(){ std::cout << \"Hello from C++!\\n\"; return 0; }";
      case "java":
        return "public class Main { public static void main(String[] args){ System.out.println(\"Hello from Java!\"); } }";
      default:
        return "console.log('Hello from JavaScript!')";
    }
  }

  function pathFor(lang: Language) {
    switch (lang) {
      case "typescript":
        return "src/index.ts";
      case "python":
        return "main.py";
      case "c":
        return "main.c";
      case "cpp":
        return "main.cpp";
      case "java":
        return "Main.java";
      default:
        return "src/index.js";
    }
  }

  async function handleCompile() {
    setCompileResult("");
    setCompileLogs([]);
    if (language === "python") {
      try {
        const py = await loadPyodideIfNeeded();
        const result = await py.runPythonAsync(code);
        setCompileResult(String(result ?? ""));
      } catch (e: any) {
        setCompileResult(`Error: ${e?.message ?? e}`);
      }
      return;
    }
    if (language === "c" || language === "cpp" || language === "java") {
      const res = await fetch("/api/compile/judge0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });
      const data = await res.json();
      if (data.ok) {
        const out = [data.stdout, data.compile_output, data.stderr].filter(Boolean).join("\n");
        setCompileResult(out || "(no output)");
      } else {
        setCompileResult(`Error: ${data.error}`);
      }
      return;
    }
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code }),
    });
    const data = await res.json();
    if (data.ok) {
      setCompileResult(data.result);
      setCompileLogs(data.logs || []);
    } else {
      setCompileResult(`Error: ${data.error}`);
      setCompileLogs(data.logs || []);
    }
  }

  async function handlePush() {
    if (!token) {
      setPushStatus("Please add your GitHub token first.");
      return;
    }
    if (!owner || !repo || !filePath) {
      setPushStatus("Owner, repo and file path are required.");
      return;
    }
    setPushStatus("Pushing...");
    const res = await fetch("/api/github/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-github-token": token },
      body: JSON.stringify({ owner, repo, branch, path: filePath, message: commitMessage, content: code }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setPushStatus(`Pushed! Commit ${data.commit?.slice(0, 7)}`);
    } else {
      setPushStatus(`Failed: ${data.error || res.statusText}`);
    }
  }

  const brandGradient = useMemo(
    () => "bg-gradient-to-br from-primary/20 via-accent/20 to-transparent",
    [],
  );

  return (
    <main className={cn("min-h-[calc(100vh-60px)]", brandGradient)}>
      <section className="container mx-auto px-4 py-10 grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card className="border-primary/20 shadow-[0_10px_40px_-15px_rgba(99,102,241,0.4)]">
          <CardHeader>
            <CardTitle>In-App Compiler & Push to GitHub</CardTitle>
            <CardDescription>
              Write code in JavaScript, TypeScript, Python, C, C++, or Java; run it, then commit to GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Token</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                  />
                  <Button onClick={saveToken} variant="secondary">
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Personal Access Token with repo scope. Stored locally in your
                  browser.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Owner</label>
                  <Input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="your-github-username"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Repo</label>
                  <Input
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="repo-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Branch</label>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">File Path</label>
                  <Input
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder={pathFor(language)}
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-[200px_1fr] gap-2 items-end">
              <div>
                <label className="text-sm font-medium">Language</label>
                <Select
                  value={language}
                  onValueChange={(v) => {
                    const lang = v as Language;
                    setLanguage(lang);
                    setCode(exampleFor(lang));
                    setFilePath(pathFor(lang));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="c">C</SelectItem>
                    <SelectItem value="cpp">C++</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Commit Message</label>
                <Input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Code ({language})</label>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono min-h-[200px]"
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleCompile}>Run</Button>
              <Button variant="outline" onClick={handlePush}>
                Push to GitHub
              </Button>
              <span className="text-sm text-muted-foreground">{pushStatus}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Output</h4>
                <pre className="bg-muted/40 rounded-md p-3 text-sm overflow-auto min-h-16 max-h-48">
                  {compileResult}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Console</h4>
                <pre className="bg-muted/40 rounded-md p-3 text-sm overflow-auto min-h-16 max-h-48">
                  {compileLogs.join("\n")}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader>
            <CardTitle>CRUD Items (Full-stack)</CardTitle>
            <CardDescription>
              Create, edit, and delete items stored on the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-2">
              <Input
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Input
                placeholder="Description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!newTitle.trim()) return;
                  createMutation.mutate({
                    title: newTitle.trim(),
                    description: newDesc.trim() || undefined,
                  });
                  setNewTitle("");
                  setNewDesc("");
                }}
              >
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {itemsQuery.data?.items?.length ? (
                itemsQuery.data.items.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    onSave={(t, d) =>
                      updateMutation.mutate({
                        id: it.id,
                        title: t,
                        description: d,
                      })
                    }
                    onDelete={() => deleteMutation.mutate(it.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No items yet. Add your first above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function ItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: Item;
  onSave: (title?: string, description?: string) => void;
  onDelete: () => void;
}) {
  const [t, setT] = useState(item.title);
  const [d, setD] = useState(item.description ?? "");
  const changed = t !== item.title || d !== (item.description ?? "");
  return (
    <div className="grid md:grid-cols-5 gap-2 items-center rounded-md border p-2">
      <Input
        className="md:col-span-2"
        value={t}
        onChange={(e) => setT(e.target.value)}
      />
      <Input
        className="md:col-span-2"
        value={d}
        onChange={(e) => setD(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant={changed ? "default" : "secondary"}
          onClick={() => onSave(t, d)}
          disabled={!changed}
        >
          Save
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
