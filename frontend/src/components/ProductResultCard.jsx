import { formatScore, getScoreTone } from "../utils/scoreUtils";

function ProductResultCard({ product }) {
  if (!product) return null;

  const score = product.healthScore ?? 0;
  const scoreTone = getScoreTone(score);

  const getIngredientDisplay = (ingredient) => {
    if (ingredient.healthStatus === "HEALTHY") {
      return {
        chipClass: "ingredient-chip-good",
        iconClass: "ingredient-icon-good",
        label: "Healthy",
        icon: "✓",
      };
    }

    if (ingredient.healthStatus === "UNHEALTHY") {
      return {
        chipClass: "ingredient-chip-caution",
        iconClass: "ingredient-icon-caution",
        label: "Unhealthy",
        icon: "X",
      };
    }

    return {
      chipClass: "ingredient-chip-unknown",
      iconClass: "ingredient-icon-unknown",
      label: "Unknown",
      icon: "?",
    };
  };

  return (
    <article className="product-card">
      <div className="product-card-header">
        <div>
          <p className="product-kicker">Latest scan</p>
          <h3>{product.name}</h3>
          <p className="brand">{product.brand}</p>
        </div>

        <div className={`score-badge ${scoreTone}`}>
          <span className="score-label">Health score</span>
          <span className="score-value">{formatScore(score)}</span>
        </div>
      </div>

      <div className="ingredient-section">
        <div className="ingredient-header">
          <h4>Ingredient review</h4>
          <span className="ingredient-count">
            {product.ingredients.length} ingredients
          </span>
        </div>

        <ul className="ingredient-list">
          {product.ingredients.map((ingredient, index) => {
            const display = getIngredientDisplay(ingredient);

            return (
              <li key={index} className="ingredient-row">
                <div className="ingredient-name-group">
                  <span className={`ingredient-icon ${display.iconClass}`} aria-hidden="true">
                    {display.icon}
                  </span>
                  <span className="ingredient-name">{ingredient.name}</span>
                </div>
                <span className={`ingredient-chip ${display.chipClass}`}>
                  {display.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

export default ProductResultCard;
