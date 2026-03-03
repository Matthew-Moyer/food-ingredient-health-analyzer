import { useState } from "react";
import { scanBarcode } from "../services/productService";
import BarcodeScanner from "../components/BarcodeScanner";

function HomePage() {

  const [product, setProduct] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleScanSuccess = async (barcode) => {

    setScanning(false);

    try {
      const data = await scanBarcode(barcode);
      setProduct(data);
    } catch (error) {
      console.error(error);
      alert("Product not found");
    }
  };

  return (
    <div style={{ padding: "20px" }}>

      <h1>Food Health Analyzer</h1>

      <button onClick={() => setScanning(true)}>
        Scan Barcode
      </button>

      {scanning && (
        <BarcodeScanner onScanSuccess={handleScanSuccess} />
      )}

      {product && (
        <div style={{ marginTop: "20px" }}>
          <h2>{product.name}</h2>
          <p>{product.brand}</p>

          <h1>
            Health Score: {product.healthScore}
          </h1>
        </div>
      )}

    </div>
  );
}

export default HomePage;
