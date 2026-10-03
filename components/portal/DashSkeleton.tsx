import { AinfBrand } from "./AinfBrand";
import { PortalFooter } from "./PortalChrome";

function Bar({
  width,
  height = 12,
  radius = 8,
  className = "",
}: {
  width: string;
  height?: number;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`pt-skel ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

function Circle({ size }: { size: number }) {
  return <span className="pt-skel pt-skel--circle" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function DashSkeleton({
  kind = "page",
}: {
  kind?: "page" | "verify" | "table" | "admin" | "okr";
}) {
  return (
    <div className="pt-app pt-app--dash" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading dashboard</span>
      <header className="pt-header">
        <div className="pt-header__inner">
          <AinfBrand />
          <nav className="pt-site-links" aria-hidden="true">
            <Bar width="72px" height={14} />
            <Bar width="64px" height={14} />
            <Bar width="70px" height={14} />
            <Bar width="58px" height={14} />
            <Bar width="62px" height={14} />
          </nav>
          <div className="pt-header__right">
            <Circle size={40} />
            <span className="pt-skel" style={{ width: 118, height: 40, borderRadius: 999 }} />
          </div>
        </div>
      </header>

      <div className="pt-dash">
        <aside className="pt-sidebar pt-sidebar--dash" aria-hidden="true">
          <p className="pt-side-nav__label">Dashboard</p>
          <div className="pt-skel-stack">
            <Bar width="72%" height={36} radius={16} />
            <Bar width="58%" height={36} radius={16} />
            <Bar width="80%" height={36} radius={16} />
            <Bar width="64%" height={36} radius={16} />
          </div>
        </aside>

        <div className="pt-dash__body">
          <main className="pt-main">
            {kind === "verify" ? <VerifyBody /> : null}
            {kind === "admin" ? <AdminBody /> : null}
            {kind === "table" ? <TableBody /> : null}
            {kind === "okr" ? <OkrBody /> : null}
            {kind === "page" ? <PageBody /> : null}
          </main>
          <PortalFooter />
        </div>
      </div>
    </div>
  );
}

function PageBody() {
  return (
    <>
      <Bar width="88px" height={10} />
      <Bar width="220px" height={28} className="pt-skel--title" />
      <Bar width="70%" height={14} className="pt-skel--sub" />
      <div className="pt-grid pt-grid--3" style={{ marginBottom: 18 }}>
        <div className="pt-stat">
          <Bar width="40%" height={10} />
          <Bar width="56%" height={22} className="pt-skel--title" />
        </div>
        <div className="pt-stat">
          <Bar width="48%" height={10} />
          <Bar width="44%" height={22} className="pt-skel--title" />
        </div>
        <div className="pt-stat">
          <Bar width="36%" height={10} />
          <Bar width="50%" height={22} className="pt-skel--title" />
        </div>
      </div>
      <section className="pt-card">
        <Bar width="140px" height={16} />
        <div className="pt-skel-stack" style={{ marginTop: 16 }}>
          <Bar width="100%" height={12} />
          <Bar width="92%" height={12} />
          <Bar width="78%" height={12} />
        </div>
      </section>
    </>
  );
}

function VerifyBody() {
  return (
    <>
      <Bar width="96px" height={10} />
      <Bar width="260px" height={28} className="pt-skel--title" />
      <Bar width="64%" height={14} className="pt-skel--sub" />
      <section className="pt-card" style={{ marginBottom: 18 }}>
        <div className="pt-skel-row">
          <Bar width="110px" height={12} />
          <span className="pt-skel" style={{ width: 88, height: 24, borderRadius: 999 }} />
        </div>
      </section>
      <section className="pt-card" style={{ marginBottom: 18 }}>
        <Bar width="72px" height={12} />
        <span className="pt-skel pt-skel--bar" />
        <div className="pt-skel-row" style={{ marginTop: 18 }}>
          <Circle size={36} />
          <Bar width="90px" height={12} />
          <Circle size={36} />
          <Bar width="120px" height={12} />
        </div>
      </section>
      <section className="pt-card">
        <Bar width="140px" height={16} />
        <Bar width="80%" height={12} className="pt-skel--sub" />
        <div className="pt-skel-stack" style={{ marginTop: 18 }}>
          <Bar width="28%" height={10} />
          <Bar width="100%" height={42} radius={10} />
          <Bar width="46%" height={10} />
          <Bar width="100%" height={42} radius={10} />
          <Bar width="32%" height={10} />
          <Bar width="100%" height={42} radius={10} />
        </div>
      </section>
    </>
  );
}

function AdminBody() {
  return (
    <>
      <Bar width="110px" height={10} />
      <Bar width="200px" height={28} className="pt-skel--title" />
      <div className="pt-grid pt-grid--3" style={{ marginBottom: 18 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div className="pt-stat" key={i}>
            <Bar width="50%" height={10} />
            <Bar width="36%" height={26} className="pt-skel--title" />
          </div>
        ))}
      </div>
      <div className="pt-grid pt-grid--2">
        <section className="pt-card">
          <Bar width="160px" height={16} />
          <div className="pt-skel-stack" style={{ marginTop: 16 }}>
            <Bar width="100%" height={14} />
            <Bar width="88%" height={14} />
            <Bar width="72%" height={14} />
          </div>
        </section>
        <section className="pt-card">
          <Bar width="90px" height={16} />
          <div className="pt-skel-stack" style={{ marginTop: 16 }}>
            <Bar width="70%" height={36} radius={999} />
            <Bar width="64%" height={36} radius={999} />
          </div>
        </section>
      </div>
    </>
  );
}

function TableBody() {
  return (
    <>
      <Bar width="110px" height={10} />
      <Bar width="160px" height={28} className="pt-skel--title" />
      <section className="pt-card" style={{ marginBottom: 18 }}>
        <div className="pt-skel-row">
          <Bar width="220px" height={40} radius={10} />
          <Bar width="140px" height={40} radius={10} />
          <Bar width="88px" height={40} radius={999} />
        </div>
      </section>
      <section className="pt-card pt-card--flush">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="pt-skel-row pt-skel-row--line" key={i}>
            <Bar width="28%" height={12} />
            <Bar width="18%" height={12} />
            <Bar width="22%" height={12} />
            <Bar width="12%" height={12} />
          </div>
        ))}
      </section>
    </>
  );
}

function OkrBody() {
  return (
    <>
      <Bar width="88px" height={10} />
      <Bar width="80px" height={28} className="pt-skel--title" />
      <div className="pt-verify-stack">
        {Array.from({ length: 3 }, (_, i) => (
          <section className="pt-card" key={i}>
            <Bar width="40%" height={10} />
            <Bar width="86%" height={18} className="pt-skel--title" />
            <span className="pt-skel pt-skel--bar" />
            <div className="pt-skel-stack" style={{ marginTop: 12 }}>
              <Bar width="70%" height={12} />
              <Bar width="62%" height={12} />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
