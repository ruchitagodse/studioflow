type WorkspaceProps = { name: string; role: "Studio owner" | "Studio administrator" };

export function ProtectedWorkspace({ name, role }: WorkspaceProps) {
  return <main aria-labelledby="studio-dashboard-heading" style={{ minHeight: "calc(100dvh - 76px)", padding: "clamp(28px, 5vw, 72px)", background: "var(--canvas)" }}>
    <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".1em" }}>STUDIO DASHBOARD</p>
    <h1 id="studio-dashboard-heading" style={{ margin: "10px 0 8px", color: "var(--color-text)", fontSize: "clamp(2rem, 4vw, 3.4rem)", letterSpacing: "-.045em" }}>Good morning, {name}.</h1>
    <p style={{ maxWidth: "40rem", margin: 0, color: "var(--color-text-muted)" }}>Your {role.toLowerCase()} workspace is ready. Use the navigation to manage studio operations.</p>
  </main>;
}
