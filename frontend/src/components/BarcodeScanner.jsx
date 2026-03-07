import { useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

function BarcodeScanner({ onScanSuccess }) {

  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);

  // CAMERA SCANNING
  const startCamera = () => {

    setScanning(true);

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          facingMode: "environment"
        }
      },
      locator: {
        patchSize: "large",
        halfSample: false
      },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      frequency: 10,
      decoder: {
        readers: [
          "upc_reader",
          "upc_e_reader",
          "ean_reader",
          "ean_8_reader"
        ]
      },
      locate: true
    }, function (err) {

      if (err) {
        console.error(err);
        return;
      }

      Quagga.start();

    });

    Quagga.onDetected((data) => {

      const code = data.codeResult.code;

      if (code) {
        onScanSuccess(code);
        stopCamera();
      }

    });

  };

  const stopCamera = () => {
    Quagga.stop();
    setScanning(false);
  };

  // IMAGE UPLOAD SCANNING
  const handleFileUpload = (event) => {

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

      Quagga.decodeSingle({
        src: reader.result,
        numOfWorkers: 0,
        decoder: {
          readers: [
            "upc_reader",
            "upc_e_reader",
            "ean_reader",
            "ean_8_reader"
          ]
        },
        locate: true
      }, function (result) {

        if (result && result.codeResult) {

          const barcode = result.codeResult.code;
          onScanSuccess(barcode);

        } else {

          alert("Barcode not detected. Try zooming in on the barcode before uploading.");

        }

      });

    };

    reader.readAsDataURL(file);

  };

  return (
  <div className="scanner-container">

    <h2>Scan Barcode</h2>

    {!scanning ? (
      <button onClick={startCamera}>Start Camera Scan</button>
    ) : (
      <button onClick={stopCamera}>Stop Camera</button>
    )}

    <div className="video-wrapper">
      <div ref={scannerRef} className="video-container"></div>
    </div>

    <div className="upload-section">
      <h3>Upload Barcode Image</h3>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
      />
    </div>

  </div>
);
}

export default BarcodeScanner;