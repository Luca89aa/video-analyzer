import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const email = form.get("email") as string | null;
    const userIdFromClient = form.get("user_id") as string | null;

    if (!email || !userIdFromClient) {
      return Response.json(
        { success: false, error: "Dati utente mancanti" },
        { status: 400 }
      );
    }

    if (!file) {
      return Response.json(
        { success: false, error: "Missing file" },
        { status: 400 }
      );
    }

    // 🟡 Supabase ADMIN CLIENT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔎 Verifica che l’utente esista in auth.users
    const { data: authUser, error: authErr } = await supabase.auth.admin.listUsers();

    if (authErr) {
      return Response.json(
        { success: false, error: "Errore Supabase Auth" },
        { status: 500 }
      );
    }

    const user = authUser.users.find((u) => u.email === email);

    if (!user) {
      return Response.json(
        { success: false, error: "Utente non trovato tramite email" },
        { status: 404 }
      );
    }

    const userId = user.id;

    // 🔥 Controllo crediti
    const { data: creditsRow, error: creditsErr } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", userId)
      .single();

    if (creditsErr || !creditsRow) {
      return Response.json(
        { success: false, error: "Impossibile recuperare crediti" },
        { status: 500 }
      );
    }

    if (creditsRow.credits <= 0) {
      return Response.json(
        {
          success: false,
          error: "Nessun credito disponibile.",
          redirect: "/pricing",
        },
        { status: 403 }
      );
    }

    // 🔥 Upload su R2
    const bytes = Buffer.from(await file.arrayBuffer());
    const key = `videos/${userId}-${Date.now()}-${file.name}`;

    const client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: bytes,
        ContentType: file.type,
      })
    );

    const publicUrl = `https://pub-${process.env.R2_BUCKET_ID}.r2.dev/${key}`;

    return Response.json({ success: true, url: publicUrl });

  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return Response.json(
      { success: false, error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
