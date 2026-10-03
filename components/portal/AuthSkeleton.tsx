export function AuthSkeleton({ label }: { label: string }) {
  return (
    <div className="pt-auth pt-auth-skel" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div className="pt-auth-skel__toggle" aria-hidden="true">
        <span className="pt-skel" />
        <span className="pt-skel" />
      </div>
      <section className="pt-card" style={{ width: "100%", margin: 0 }} aria-hidden="true">
        <span className="pt-skel pt-auth-skel__title" />
        <span className="pt-skel pt-auth-skel__line" />
        <div className="pt-skel-stack" style={{ marginTop: 18 }}>
          <span className="pt-skel pt-auth-skel__label" />
          <span className="pt-skel pt-auth-skel__field" />
          <span className="pt-skel pt-auth-skel__label" />
          <span className="pt-skel pt-auth-skel__field" />
          <span className="pt-skel pt-auth-skel__btn" />
        </div>
      </section>
    </div>
  );
}
