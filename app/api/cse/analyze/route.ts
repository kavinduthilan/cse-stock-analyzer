import { toolDefs, runTool } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 300;

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

export async function POST(req: Request) {
  try {
    const { symbol, question } = await req.json();

    const messages: any[] = [
      {
        role: "system",
        content:
          `You analyse ${symbol}, a company listed on the Colombo Stock Exchange. ` +
          `Use the tools to get data; never invent numbers. ` +
          `Money figures are in Sri Lankan rupees (LKR); per-share values (EPS, NAV) are rupees per share. ` +
          `Fiscal years end 31 March. Interim figures are unaudited. ` +
          `If a tool returns no data, say so. Give trends, drivers, and risks concisely.`,
      },
      { role: "user", content: question },
    ];

    for (let step = 0; step < 6; step++) {
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, tools: toolDefs, stream: false }),
      });

      const r = await res.json().catch(() => null);

      // Ollama reports problems (e.g. model not found) as { error: "..." }
      if (!res.ok || !r || r.error) {
        return Response.json({ answer: `Ollama error: ${r?.error ?? res.statusText}` });
      }
      const msg = r.message;
      if (!msg) {
        return Response.json({ answer: "Ollama returned no message: " + JSON.stringify(r).slice(0, 300) });
      }

      messages.push(msg);
      if (!msg.tool_calls?.length) return Response.json({ answer: msg.content });

      for (const call of msg.tool_calls) {
        let result: unknown;
        try {
          let args = call.function.arguments;
          if (typeof args === "string") args = JSON.parse(args);
          result = runTool(symbol, call.function.name, args ?? {});
        } catch (e: any) {
          result = { error: String(e?.message ?? e) };
        }
        messages.push({ role: "tool", content: JSON.stringify(result) });
      }
    }
    return Response.json({ answer: "Could not finish the analysis." });
  } catch (e: any) {
    console.error("analyze failed:", e);
    const code = String(e?.cause?.code ?? e?.message ?? e);
    return Response.json({
      answer:
        code.includes("ECONNREFUSED") || code.includes("fetch failed")
          ? "Cannot reach Ollama. Start it with `ollama serve` and check OLLAMA_URL."
          : `Analysis failed: ${code}`,
    });
  }
}