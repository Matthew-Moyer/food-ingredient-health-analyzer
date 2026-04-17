import { formatScore, getScoreTone } from "../utils/scoreUtils";

function ProductComparisonBoard({ products, onRemoveProduct, onClearProducts }) {
  if (!products.length) {
    return (
      <div className="empty-result-state comparison-empty-state">
        <p>Scan at least two products to compare their health scores side by side.</p>
      </div>
    );
  }

  return (
    <section className="comparison-board">
      <div className="comparison-header">
        <div>
          <span className="section-kicker">Compare</span>
          <h2>Health score lineup</h2>
          <p>Each card uses the same score color rules: 64 and below red, 65-79 yellow, 80-100 green.</p>
        </div>

        {products.length > 1 && (
          <button className="secondary-button" onClick={onClearProducts} type="button">
            Clear comparison
          </button>
        )}
      </div>

      <div className="comparison-grid">
        {products.map((product) => {
          const score = product.healthScore ?? 0;
          const scoreTone = getScoreTone(score);

          return (
            <article className="comparison-card" key={product.barcode ?? product.id ?? product.name}>
              <div className="comparison-card-top">
                <div>
                  <h3>{product.name}</h3>
                  <p className="brand">{product.brand}</p>
                </div>

                <button
                  className="comparison-remove-button"
                  onClick={() => onRemoveProduct(product)}
                  type="button"
                >
                  Remove
                </button>
              </div>

              <div className={`score-badge comparison-score-badge ${scoreTone}`}>
                <span className="score-label">Health score</span>
                <span className="score-value">{formatScore(score)}</span>
              </div>

              <div className="comparison-meta">
                <div className="comparison-stat">
                  <span className="comparison-stat-label">Ingredients</span>
                  <strong>{product.ingredients?.length ?? 0}</strong>
                </div>
                <div className="comparison-stat">
                  <span className="comparison-stat-label">Barcode</span>
                  <strong>{product.barcode ?? "N/A"}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ProductComparisonBoard;
