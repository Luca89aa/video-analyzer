export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        padding: 20
      }}
    >
      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, textAlign: "center" }}>
        Benvenuto nella Dashboard
      </h1>

      <p style={{ opacity: 0.7, marginTop: 10, textAlign: "center" }}>
        Gestisci i tuoi crediti e carica nuovi video.
      </p>

      {/* BOTTONI */}
      <div
        style={{
          marginTop: 35,
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          justifyContent: "center"
        }}
      >
        <a
          href="/upload"
          style={{
            padding: "14px 26px",
            background: "#2563eb",
            borderRadius: 10,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            minWidth: 200,
            textAlign: "center"
          }}
        >
          Carica Video
        </a>

        <a
          href="/pricing"
          style={{
            padding: "14px 26px",
            background: "#3b82f6",
            borderRadius: 10,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 700,
            textDecoration: "none",
            minWidth: 200,
            textAlign: "center"
          }}
        >
          Acquista Crediti
        </a>
      </div>
    </main>
  );
}
