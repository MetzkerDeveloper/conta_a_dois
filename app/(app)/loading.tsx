export default function Loading() {
  return (
    <div role="status" aria-label="Carregando painel" className="skeleton-grid">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton wide" />
    </div>
  );
}
