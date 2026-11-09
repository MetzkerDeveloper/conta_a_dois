export default function LoadingFinance() {
  return (
    <div
      role="status"
      aria-label="Carregando suas finanças"
      className="skeleton-grid"
    >
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton wide" />
    </div>
  );
}
