export default function PortalLoading() {
  return (
    <div className="pt-center" aria-busy="true">
      <span className="visually-hidden">Loading</span>
      <div className="pt-skel" style={{ width: 280, height: 320, borderRadius: 20 }} />
    </div>
  );
}
