import { useState } from "react";
import { scanBarcode, searchProductByName } from "../services/productService";
import BarcodeScanner from "../components/BarcodeScanner";
import BarcodeImageUpload from "../components/BarcodeImageUpload";
import ProductComparisonBoard from "../components/ProductComparisonBoard";
import ProductResultCard from "../components/ProductResultCard";

function HomePage() {
  const [product, setProduct] = useState(null);
  const [comparedProducts, setComparedProducts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [productNameQuery, setProductNameQuery] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");

  const updateVisibleProduct = (data) => {
    setProduct(data);
    setComparedProducts((currentProducts) => {
      const productKey = data.barcode ?? data.id ?? data.name;
      const nextProducts = currentProducts.filter((item) => {
        const itemKey = item.barcode ?? item.id ?? item.name;
        return itemKey !== productKey;
      });

      return [data, ...nextProducts].slice(0, 6);
    });
  };

  const handleScanSuccess = async (barcode) => {
    setScanning(false);
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await scanBarcode(barcode);
      updateVisibleProduct(data);
    } catch (error) {
      console.error(error);
      setProduct(null);
      setErrorMessage("We couldn't find a matching product for that barcode.");
    } finally {
      setLoading(false);
    }
  };

  const handleProductNameSearch = async (event) => {
    event.preventDefault();

    const normalizedQuery = productNameQuery.trim();

    if (!normalizedQuery) {
      setErrorMessage("Enter a product name to search Open Food Facts.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setScanning(false);

    try {
      const data = await searchProductByName(normalizedQuery);
      updateVisibleProduct(data);
    } catch (error) {
      console.error(error);
      setProduct(null);
      if (error?.response?.status === 503) {
        setErrorMessage(
          "Open Food Facts name search is temporarily unavailable. Try again shortly, scan a barcode, or use a product you already searched before."
        );
      } else {
        setErrorMessage("We couldn't find a matching product for that name.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualBarcodeSubmit = async (event) => {
    event.preventDefault();

    const normalizedBarcode = manualBarcode.trim();

    if (!/^\d{8,13}$/.test(normalizedBarcode)) {
      setErrorMessage("Enter an 8 to 13 digit UPC or EAN barcode.");
      return;
    }

    await handleScanSuccess(normalizedBarcode);
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
          <p className="hero-support-text">
            Search by product name, scan a live barcode, or upload a barcode
            image from your device.
          </p>
        </div>

        <div className="hero-stat-card">
          <div className="stat-label">What you get</div>
          <div className="stat-value">Live product lookup</div>
          <p className="hero-stat-description">
            You get a quick, easier-to-read breakdown of what is inside the
            product, which ingredients may be helping or hurting it, and how
            the overall score stacks up at a glance. That gives you a faster
            way to compare everyday snacks, pantry staples, and grocery finds
            without having to decode the label on your own.
          </p>
        </div>
      </section>

      <section className="content-grid">
        <div className="surface-card">
          <div className="section-heading">
            <span className="section-kicker">Scanner</span>
            <h2>Capture a barcode</h2>
            <p>
              Search by product name, enter a barcode manually, upload a
              barcode image, or open the camera for a live scan.
            </p>
          </div>

          <div className="scanner-panel">
            <div className="scanner-callout">
              <div>
                <strong>Ready to scan?</strong>
                <p>
                  Launch the scanner here, then compare the result with your
                  recent lookups below.
                </p>
              </div>

              <button
                className="primary-button scanner-launch-button"
                onClick={() => setScanning((current) => !current)}
                type="button"
              >
                {scanning ? "Close Scanner" : "Scan a Product"}
              </button>
            </div>

            {scanning ? (
              <BarcodeScanner onScanSuccess={handleScanSuccess} />
            ) : (
              <div className="empty-scanner-state scanner-idle-state">
                <div className="empty-scanner-icon">[]</div>
                <p>The scanner is ready whenever you are.</p>
                <span className="helper-text">
                  Use your camera for a live read or upload a barcode image.
                </span>
              </div>
            )}

            <form className="name-search-form" onSubmit={handleProductNameSearch}>
              <label className="upload-label" htmlFor="product-name-search">
                Search by product name
              </label>
              <div className="name-search-row">
                <input
                  id="product-name-search"
                  className="manual-barcode-input"
                  type="text"
                  placeholder="Ex: Mini Wheats, Cheerios, Tostitos"
                  value={productNameQuery}
                  onChange={(event) => setProductNameQuery(event.target.value)}
                />
                <button className="secondary-button" type="submit">
                  Search product
                </button>
              </div>
              <p className="name-search-helper">
                We will search Open Food Facts for the product name, resolve the barcode, and score the ingredients.
              </p>
            </form>

            <form className="manual-barcode-form" onSubmit={handleManualBarcodeSubmit}>
              <label className="upload-label" htmlFor="manual-barcode-home">
                Enter barcode manually
              </label>
              <div className="manual-barcode-row">
                <input
                  id="manual-barcode-home"
                  className="manual-barcode-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Type 8 to 13 digits"
                  value={manualBarcode}
                  onChange={(event) => setManualBarcode(event.target.value.replace(/\D/g, ""))}
                />
                <button className="secondary-button" type="submit">
                  Use barcode
                </button>
              </div>
              <p className="name-search-helper">
                Use this when the barcode is readable on the package but hard for the camera or image upload to detect.
              </p>
            </form>

            <BarcodeImageUpload onBarcodeDetected={handleScanSuccess} />
          </div>
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
