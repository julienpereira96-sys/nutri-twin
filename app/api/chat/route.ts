import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { message, systemPrompt } = await request.json();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system:
        systemPrompt ||
        "Tu es un assistant nutritionniste. Réponds sans markdown, sans ## ni **, en phrases simples et naturelles, comme si tu parlais à quelqu'un.",
      messages: [{ role: "user", content: message }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text ?? "Aucune reponse recue.";
    return Response.json({ response: text });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}
