import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { url, user_id } = await req.json();

    // ------------------------------------------------------------
    // 1) Validazioni iniziali
    // ------------------------------------------------------------
    if (!url) {
      return Response.json(
        { success: false, error: "URL mancante" },
        { status: 400 }
      );
    }

    if (!user_id) {
      return Response.json(
        { success: false, error: "User ID mancante" },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // 2) Recupero crediti utente
    // ------------------------------------------------------------
    const { data: row, error: creditErr } = await supabaseAdmin
      .from("analisi_video")
      .select("credits")
      .eq("user_id", user_id)
      .single();

    if (creditErr || !row) {
      return Response.json(
        { success: false, error: "Crediti non trovati" },
        { status: 500 }
      );
    }

    if (row.credits <= 0) {
      return Response.json(
        { success: false, error: "Crediti insufficienti" },
        { status: 403 }
      );
    }

    // ------------------------------------------------------------
    // 3) Download video da R2
    // ------------------------------------------------------------
    const videoRes = await fetch(url);
    const videoBuffer = await videoRes.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString("base64");

    // ------------------------------------------------------------
    // 4) Prompt PRO per TikTok
    // ------------------------------------------------------------
    const prompt = `
Sei un esperto analyst specializzato in video virali TikTok.

GUARDA il video e restituisci TUTTO questo in un unico output:

═══════════════════════════════════════
🎥 **1. ANALISI COMPLETA DEL VIDEO**
- Descrizione dettagliata della scena
- Azioni principali
- Elementi visivi rilevanti
- Contesto
- Interpretazione narrativa/emotiva

═══════════════════════════════════════
🚀 **2. HOOK ANALYSIS**
- Cos'è che cattura l'attenzione?
- Efficacia da 1 a 10
- Come migliorarlo

═══════════════════════════════════════
✨ **3. BODY ANALYSIS**
- Struttura narrativa
- Momentum
- Retention
- Punti di forza e debolezza

═══════════════════════════════════════
📢 **4. CTA ANALYSIS**
- Quale CTA è ideale per questo video?
- 3 CTA brevi e pronte all’uso

═══════════════════════════════════════
🛠 **5. PUNTI DA MIGLIORARE**
- Montaggio, ritmo, luce, storytelling, composizione

═══════════════════════════════════════
✍️ **6. CAPTION PER TIKTOK**
Breve, virale, max 3 righe.

═══════════════════════════════════════
#️⃣ **7. HASHTAG**
20 hashtag:
- 10 generici per viralità
- 10 specifici per il contenuto del video

═══════════════════════════════════════

Rispondi SEMPRE in italiano con stile pulito e professionale.
    `;

    // ------------------------------------------------------------
    // 5) Chiamata Gemini
    // ------------------------------------------------------------
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      { inlineData: { data: base64Video, mimeType: "video/mp4" } },
      { text: prompt }
    ]);

    const text = result.response.text();

    // ------------------------------------------------------------
    // 6) Decremento crediti (NUOVA VERSIONE)
    // ------------------------------------------------------------
    const { error: decErr } = await supabaseAdmin.rpc("decrease_credits", {
      uid: user_id,
      amount: 1
    });

    if (decErr) {
      console.error("decrease_credits ERROR:", decErr);
      return Response.json(
        { success: false, error: "Errore decremento crediti" },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // 7) Risposta finale
    // ------------------------------------------------------------
    return Response.json({ success: true, text });

  } catch (err: any) {
    console.error("ANALYZE ERROR:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
