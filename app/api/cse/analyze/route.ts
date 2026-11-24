import { toolDefs, runTool } from "@/lib/tools";

const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:14b";

export async function POST(req: Request) {
  const { symbol, question } = await req.json();
  const messages: any[] = [
    { role: "system", content:
      `You analyse ${symbol}, a Sri Lankan finance company. Use the tools to get data; never invent numbers. ` +
      `Figures are in Rs '000 and fiscal years end 31 March. Interim figures are unaudited. ` +
      `Give trends, drivers, and risks concisely.` },
    { role: "user", content: question },
  ];

  for (let step = 0; step < 6; step++) {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      body: JSON.stringify({ model: MODEL, messages, tools: toolDefs, stream: false }),
    }).then((x) => x.json());

    const msg = r.message;
    messages.push(msg);
    if (!msg.tool_calls?.length) return Response.json({ answer: msg.content });

    for (const call of msg.tool_calls) {
      const result = runTool(symbol, call.function.name, call.function.arguments);
      messages.push({ role: "tool", content: JSON.stringify(result) });
    }
  }
  return Response.json({ answer: "Could not finish the analysis." });
}