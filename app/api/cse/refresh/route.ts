import { spawn } from "child_process";
import path from "path";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let running = false; // one run at a time

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ETL !== "1") {
    return new Response("ETL is disabled on this server", { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const symbol = body?.symbol;
  if (typeof symbol !== "string" || !/^[A-Z0-9.\-]{2,20}$/i.test(symbol)) {
    return new Response("Invalid symbol", { status: 400 });
  }
  if (running) return new Response("A refresh is already running", { status: 409 });
  running = true;

  const py = process.env.PYTHON_BIN ?? "python";
  const dir = path.join(process.cwd(), "elt");
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        try { controller.enqueue(enc.encode(s)); } catch { /* client went away */ }
      };
      try {
        for (const script of ["download.py", "extract.py"]) {
          write(`\n=== ${script} ${symbol} ===\n`);
          const code = await new Promise<number>((resolve) => {
            const p = spawn(py, ["-u", path.join(dir, script), symbol], {
              cwd: process.cwd(),
              env: { ...process.env, PYTHONIOENCODING: "utf-8" },
            });
            p.stdout.on("data", (d) => write(d.toString()));
            p.stderr.on("data", (d) => write(d.toString()));
            p.on("error", (e) => { write(`spawn error: ${e.message}\n`); resolve(-1); });
            p.on("close", (c) => resolve(c ?? -1));
          });
          if (code !== 0) { write(`\n${script} failed (exit ${code})\n`); break; }
        }
        revalidatePath("/stock/[symbol]", "page");
        write("\nDONE\n");
      } finally {
        running = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}