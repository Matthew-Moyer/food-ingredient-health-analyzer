import { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

const BARCODE_READERS = [
  "upc_reader",
  "upc_e_reader",
  "ean_reader",
  "ean_8_reader",
];

const CAMERA_SCAN_AREA = {
  top: "25%",
  right: "8%",
  left: "8%",
  bottom: "25%",
};

const normalizeBarcode = (code) => code?.replace(/\s+/g, "").trim() ?? "";

const isRetailBarcodeFormat = (format) =>
  ["upc", "upc_e", "ean_13", "ean_8"].includes(format);

const calculateModulo10CheckDigit = (digits) => {
  const reversedDigits = digits
    .split("")
    .reverse()
    .map((digit) => Number.parseInt(digit, 10));

  const total = reversedDigits.reduce((sum, digit, index) => {
    const weight = index % 2 === 0 ? 3 : 1;
    return sum + digit * weight;
  }, 0);

  return (10 - (total % 10)) % 10;
};

const isValidEan13 = (code) => {
  if (!/^\d{13}$/.test(code)) {
    return false;
  }

  return calculateModulo10CheckDigit(code.slice(0, 12)) === Number.parseInt(code[12], 10);
};

const isValidEan8 = (code) => {
  if (!/^\d{8}$/.test(code)) {
    return false;
  }

  return calculateModulo10CheckDigit(code.slice(0, 7)) === Number.parseInt(code[7], 10);
};

const isValidUpcA = (code) => {
  if (!/^\d{12}$/.test(code)) {
    return false;
  }

  return calculateModulo10CheckDigit(code.slice(0, 11)) === Number.parseInt(code[11], 10);
};

const isValidUpcE = (code) => /^\d{6,8}$/.test(code);

const isValidRetailBarcode = (code, format) => {
  if (!/^\d+$/.test(code)) {
    return false;
  }

  switch (format) {
    case "upc":
      return isValidUpcA(code);
    case "upc_e":
      return isValidUpcE(code);
    case "ean_13":
      return isValidEan13(code);
    case "ean_8":
      return isValidEan8(code);
    default:
      if (code.length === 12) {
        return isValidUpcA(code);
      }

      if (code.length === 13) {
        return isValidEan13(code);
      }

      if (code.length === 8) {
        return isValidEan8(code);
      }

      return code.length >= 6;
  }
};

const isLikelyValidBarcode = (code, format) => {
  const normalizedCode = normalizeBarcode(code);

  if (!normalizedCode) {
    return false;
  }

  if (isRetailBarcodeFormat(format)) {
    return isValidRetailBarcode(normalizedCode, format);
  }

  return isValidRetailBarcode(normalizedCode, format);
};

function BarcodeScanner({ onScanSuccess }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const lastDetectedCodeRef = useRef("");
  const detectionCountRef = useRef(0);

  useEffect(() => () => {
    Quagga.stop();
    Quagga.offDetected();
  }, []);

  const resetDetectionState = () => {
    lastDetectedCodeRef.current = "";
    detectionCountRef.current = 0;
  };

  const startCamera = () => {
    setScanning(true);
    setScanStatus("Scanning for a retail UPC or EAN barcode...");
    resetDetectionState();

    Quagga.offDetected();

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          area: CAMERA_SCAN_AREA,
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        frequency: 15,
        decoder: {
          readers: BARCODE_READERS,
          multiple: false,
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error(err);
          return;
        }

        Quagga.start();
      }
    );

    Quagga.onDetected((data) => {
      const code = normalizeBarcode(data?.codeResult?.code);
      const format = data?.codeResult?.format;

      if (!isLikelyValidBarcode(code, format)) {
        resetDetectionState();
        return;
      }

      if (lastDetectedCodeRef.current === code) {
        detectionCountRef.current += 1;
      } else {
        lastDetectedCodeRef.current = code;
        detectionCountRef.current = 1;
      }

      if (detectionCountRef.current >= 2) {
        setDetectedBarcode(code);
        setScanStatus("Barcode confirmed. Looking up product...");
        onScanSuccess(code);
        stopCamera();
      }
    });
  };

  const stopCamera = () => {
    Quagga.stop();
    Quagga.offDetected();
    resetDetectionState();
    setScanning(false);
  };

  return (
    <div className="scanner-container">
      <div className="scanner-toolbar">
        <h3>Scan Barcode</h3>
        {!scanning ? (
          <button className="secondary-button" onClick={startCamera}>
            Start camera
          </button>
        ) : (
          <button className="secondary-button secondary-button-active" onClick={stopCamera}>
            Stop camera
          </button>
        )}
      </div>

      <div className="video-wrapper">
        <div ref={scannerRef} className="video-container">
          <div className="scan-overlay">
            <div className="scan-box"></div>
            <p className="scan-text">Place barcode inside the guide</p>
          </div>
        </div>
      </div>
      <div className="scan-feedback-card">
        <div className="scan-feedback-header">
          <strong>Live scan</strong>
          <span>{detectedBarcode || "Waiting for a reliable match"}</span>
        </div>
        <p className="scan-feedback-text">
          {scanStatus || "If a package still fails, use the manual barcode entry in the scanner section."}
        </p>
      </div>
    </div>
  );
}

export default BarcodeScanner;
