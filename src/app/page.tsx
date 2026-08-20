import Link from "next/link";

export default function HomePage() {
  return (
    <div className="cc-shell">
      <div className="cc-container" style={{ textAlign: "center", paddingTop: 80 }}>
        <div className="cc-title" style={{ fontSize: 28, marginBottom: 8 }}>
          Carbon Commandos
        </div>
        <p className="cc-subtitle" style={{ marginBottom: 32 }}>
          Live tactical command system
        </p>
        <div className="cc-row" style={{ justifyContent: "center" }}>
          <Link href="/join" className="cc-btn cc-btn-primary">
            Join the game
          </Link>
          <Link href="/admin/login" className="cc-btn">
            Admin login
          </Link>
        </div>
      </div>
    </div>
  );
}
