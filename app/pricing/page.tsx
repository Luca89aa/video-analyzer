import { CSSProperties } from "react";

export default function PaymentsPage() {
  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontSize: "2.8rem",
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        Scegli il tuo pacchetto
      </h1>

      <p style={{ textAlign: "center", opacity: 0.8 }}>
        I crediti vengono usati per analizzare i video (1 credito = 1 video).
        I video devono essere massimo 1 minuto.
      </p>

      <div
        style={{
          marginTop: 50,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 30,
        }}
      >
        {/* 5 VIDEO */}
        <div style={card}>
          <h2 style={title}>5 Video</h2>
          <p style={price}>€ 4,99</p>
          <p style={desc}>Ideale per provare il servizio</p>

          <form
            action="https://www.paypal.com/cgi-bin/webscr"
            method="post"
            target="_top"
            style={{ marginTop: "auto" }}
          >
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value="TGN8YDER4R258" />
            <input type="hidden" name="currency_code" value="EUR" />
            <input
              type="hidden"
              name="return"
              value="https://video-analyzer.vercel.app/payment/success?pack=5"
            />
            <button style={btn}>Acquista ora</button>
          </form>
        </div>

        {/* 10 VIDEO */}
        <div style={card}>
          <h2 style={title}>10 Video</h2>
          <p style={price}>€ 8,99</p>
          <p style={desc}>Perfetto per uso continuativo</p>

          <form
            action="https://www.paypal.com/cgi-bin/webscr"
            method="post"
            target="_top"
            style={{ marginTop: "auto" }}
          >
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value="CSJPDWHV5P22L" />
            <input type="hidden" name="currency_code" value="EUR" />
            <input
              type="hidden"
              name="return"
              value="https://video-analyzer.vercel.app/payment/success?pack=10"
            />
            <button style={btn}>Acquista ora</button>
          </form>
        </div>

        {/* 25 VIDEO */}
        <div style={card}>
          <h2 style={title}>25 Video</h2>
          <p style={price}>€ 19,99</p>
          <p style={desc}>Per creator e freelance</p>

          <form
            action="https://www.paypal.com/cgi-bin/webscr"
            method="post"
            target="_top"
            style={{ marginTop: "auto" }}
          >
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value="PX2MVFSBL7W5G" />
            <input type="hidden" name="currency_code" value="EUR" />
            <input
              type="hidden"
              name="return"
              value="https://video-analyzer.vercel.app/payment/success?pack=25"
            />
            <button style={btn}>Acquista ora</button>
          </form>
        </div>

        {/* 50 VIDEO */}
        <div style={card}>
          <h2 style={title}>50 Video</h2>
          <p style={price}>€ 29,99</p>
          <p style={desc}>Offerta Super Conveniente</p>

          <form
            action="https://www.paypal.com/cgi-bin/webscr"
            method="post"
            target="_top"
            style={{ marginTop: "auto" }}
          >
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value="9A4HDSCXUF9U6" />
            <input type="hidden" name="currency_code" value="EUR" />
            <input
              type="hidden"
              name="return"
              value="https://video-analyzer.vercel.app/payment/success?pack=50"
            />
            <button style={btn}>Acquista ora</button>
          </form>
        </div>

        {/* 100 VIDEO */}
        <div style={cardSpecial}>
          <h2 style={title}>100 Video</h2>
          <p style={price}>€ 49,99</p>
          <p style={desc}>Miglior rapporto qualità / prezzo</p>

          <form
            action="https://www.paypal.com/cgi-bin/webscr"
            method="post"
            target="_top"
            style={{ marginTop: "auto" }}
          >
            <input type="hidden" name="cmd" value="_s-xclick" />
            <input type="hidden" name="hosted_button_id" value="VQYV8839QN7HQ" />
            <input type="hidden" name="currency_code" value="EUR" />
            <input
              type="hidden"
              name="return"
              value="https://video-analyzer.vercel.app/payment/success?pack=100"
            />
            <button style={btnSpecial}>Acquista ora</button>
          </form>
        </div>
      </div>
    </main>
  );
}

/* === STYLES === */

const card: CSSProperties = {
  padding: "30px",
  borderRadius: "14px",
  background: "#0f1629",
  color: "white",
  boxShadow: "0 12px 32px rgba(0,0,0,.3)",
  textAlign: "center",
  display: "flex",
  flexDirection: "column" as const, // 🔑 FIX DEFINITIVO
  minHeight: "350px",
};

const cardSpecial: CSSProperties = {
  ...card,
  border: "2px solid #3b82f6",
};

const title: CSSProperties = {
  fontSize: "1.5rem",
  marginBottom: 5,
};

const price: CSSProperties = {
  fontSize: "2.2rem",
  fontWeight: 800,
  margin: "15px 0",
};

const desc: CSSProperties = {
  opacity: 0.75,
  marginBottom: 25,
};

const btn: CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontSize: "1rem",
  cursor: "pointer",
  fontWeight: 700,
};

const btnSpecial: CSSProperties = {
  ...btn,
  background: "#3b82f6",
};
