import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

/**
 * 提案書用の文章（キャッチコピー・物件説明文）の下書き。
 * 不動産の表示に関する公正競争規約に反する断定表現（「最高」「完璧」「日本一」「格安」等）や、
 * 根拠のない数値は使わない。渡された事実だけを使う。
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  const { facts, tone } = (await req.json()) as { facts: string; tone?: string };
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: `あなたは神奈川県の不動産会社「イチエン不動産」の営業担当の文章を手伝う編集者です。
渡された事実だけを使って、提案書に載せる文章を日本語で書きます。
守ること:
- 不動産の表示に関する公正競争規約に反する表現（最高・完璧・日本一・格安・掘り出し物・必ず値上がり等の断定、根拠のない優良誤認）は使わない。
- 事実に無い設備・環境・数値を足さない。距離・時間・面積は渡された数字だけ。
- 法規の判定は「参考」であることを崩さない（「建築可能」と断定しない。「参考プランでは〜を想定」等）。
- トーン: ${tone ?? "丁寧で落ち着いた、お客様向け"}。
返す JSON だけ: {"catchCopy": "30字以内のキャッチコピー", "description": "200〜300字の物件説明文", "cautions": ["表現上の注意点があれば"]}`,
    messages: [{ role: "user", content: `事実:\n${facts}` }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return NextResponse.json({ catchCopy: String(j.catchCopy ?? ""), description: String(j.description ?? ""), cautions: Array.isArray(j.cautions) ? j.cautions.map(String) : [] });
  } catch {
    return NextResponse.json({ error: "文章を作れませんでした: " + text.slice(0, 200) }, { status: 500 });
  }
}
