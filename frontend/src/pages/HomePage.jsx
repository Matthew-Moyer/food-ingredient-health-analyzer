import { useState } from "react";
import { scanBarcode } from "../services/productService";
import BarcodeScanner from "../components/BarcodeScanner";
import ProductComparisonBoard from "../components/ProductComparisonBoard";
import ProductResultCard from "../components/ProductResultCard";

function HomePage() {
  const [product, setProduct] = useState(null);
  const [comparedProducts, setComparedProducts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleScanSuccess = async (barcode) => {
    setScanning(false);
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await scanBarcode(barcode);
      setProduct(data);
      setComparedProducts((currentProducts) => {
        const productKey = data.barcode ?? data.id ?? data.name;
        const nextProducts = currentProducts.filter((item) => {
          const itemKey = item.barcode ?? item.id ?? item.name;
          return itemKey !== productKey;
        });

        return [data, ...nextProducts].slice(0, 6);
      });
    } catch (error) {
      console.error(error);
      setProduct(null);
      setErrorMessage("We couldn't find a matching product for that barcode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Smart Label Insight</span>
          <h1>Food Health Analyzer</h1>
          <p className="hero-text">
            Scan a barcode and get a fast ingredient breakdown with a simple
            health score for the product you are holding.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => setScanning((current) => !current)}
            >
              {scanning ? "Close Scanner" : "Scan a Product"}
            </button>

            <span className="helper-text">
              Use your camera or upload a barcode image.
            </span>
          </div>
        </div>

        <div className="hero-stat-card">
          <div className="stat-label">What you get</div>
          <div className="stat-value">Live product lookup</div>
          <p>
            Ingredients are pulled into a scorecard so the result is easy to
            read at a glance.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <div className="surface-card">
          <div className="section-heading">
            <span className="section-kicker">Scanner</span>
            <h2>Capture a barcode</h2>
            <p>
              Open the camera for a live scan, or upload a cropped package
              photo.
            </p>
          </div>

          {scanning ? (
            <BarcodeScanner onScanSuccess={handleScanSuccess} />
          ) : (
            <div className="empty-scanner-state">
              <div className="empty-scanner-icon">[]</div>
              <p>The scanner is ready whenever you are.</p>
            </div>
          )}
        </div>

        <div className="surface-card">
          <div className="section-heading">
            <span className="section-kicker">Result</span>
            <h2>Product summary</h2>
            <p>
              Your latest scan will appear here with its score and ingredient
              review.
            </p>
          </div>

          {loading && <div className="status-banner">Looking up product data...</div>}
          {errorMessage && <div className="status-banner status-error">{errorMessage}</div>}

          {!loading && !product && !errorMessage && (
            <div className="empty-result-state">
              <p>Scan a product to populate the analysis card.</p>
            </div>
          )}

          <ProductResultCard product={product} />
        </div>
      </section>

      <section className="surface-card comparison-section">
        <ProductComparisonBoard
          products={comparedProducts}
          onClearProducts={() => setComparedProducts([])}
          onRemoveProduct={(productToRemove) =>
            setComparedProducts((currentProducts) =>
              currentProducts.filter((item) => {
                const itemKey = item.barcode ?? item.id ?? item.name;
                const removeKey =
                  productToRemove.barcode ?? productToRemove.id ?? productToRemove.name;
                return itemKey !== removeKey;
              })
            )
          }
        />
      </section>
    </main>
  );
}

export default HomePage;
