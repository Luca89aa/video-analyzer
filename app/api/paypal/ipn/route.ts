import { NextRequest, NextResponse } from "next/server";

/**
 * Questo endpoint riceve la notifica IPN da PayPal
 * e registra l’acquisto effettuato dall’utente.
 */

export async function POST(req: NextRequest) {
  try {
    // PayPal manda i dati come form-urlencoded
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const txnId = params.get("txn_id");
    const payerEmail = params.get("payer_email");
    const amount = params.get("mc_gross");
    const currency = params.get("mc_currency");
    const customField = params.get("custom"); // se ti serve per passare info extra
    const hostedButtonId = params.get("hosted_button_id");

    // INFO UTILI
    console.log("🔔 IPN ricevuto da PayPal");
    console.log("➡️ Transaction ID:", txnId);
    console.log("➡️ Pagatore:", payerEmail);
    console.log("➡️ Importo:", amount, currency);
    console.log("➡️ Button ID:", hostedButtonId);

    // Mappa i pacchetti in base al tasto acquistato
    const packages: Record<string, number> = {
      "TGN8YDER4R258": 5,   // 5 video
      "CSJPDWHV5P22L": 10,  // 10 video
      "PX2MVFSBL7W5G": 25,  // 25 video
      "9A4HDSCXUF9U6": 50,  // 50 video
      "VQYV8839QN7HQ": 100, // 100 video
    };

    const credits = packages[hostedButtonId ?? ""] ?? 0;

    if (credits === 0) {
      console.error("❌ Button ID non riconosciuto:", hostedButtonId);
    } else {
      console.log(`✅ L'utente ha acquistato ${credits} crediti`);
    }

    // Qui dovresti salvare nel DB dell’utente i crediti acquistati
    // Esempio (FAKE):
    /*
    await db.user.update({
      where: { email: payerEmail },
      data: { credits: { increment: credits } }
    });
    */

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Errore IPN:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
