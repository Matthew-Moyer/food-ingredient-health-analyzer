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

const getBarcodeDetectorFormats = async () => {
  if (typeof window === "undefined" || typeof window.BarcodeDetector === "undefined") {
    return [];
  }

  if (typeof window.BarcodeDetector.getSupportedFormats !== "function") {
    return ["ean_13", "ean_8", "upc_a", "upc_e"];
  }

  try {
    const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
    return supportedFormats.filter((format) =>
      ["ean_13", "ean_8", "upc_a", "upc_e"].includes(format)
    );
  } catch (error) {
    console.error("Unable to query BarcodeDetector formats", error);
    return ["ean_13", "ean_8", "upc_a", "upc_e"];
  }
};

function BarcodeScanner({ onScanSuccess }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
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
        setManualBarcode(code);
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

  const decodeImage = (src, locate = true) =>
    new Promise((resolve) => {
      Quagga.decodeSingle(
        {
          src,
          numOfWorkers: 0,
          locate,
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          decoder: {
            readers: BARCODE_READERS,
          },
        },
        (result) => {
          const code = normalizeBarcode(result?.codeResult?.code);
          const format = result?.codeResult?.format;

          resolve(isLikelyValidBarcode(code, format) ? code : null);
        }
      );
    });

  const decodeWithBarcodeDetector = async (source) => {
    const supportedFormats = await getBarcodeDetectorFormats();

    if (!supportedFormats.length) {
      return null;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: supportedFormats });
      const results = await detector.detect(source);

      for (const result of results) {
        const format = result?.format === "upc_a" ? "upc" : result?.format;
        const code = normalizeBarcode(result?.rawValue);

        if (isLikelyValidBarcode(code, format)) {
          return code;
        }
      }
    } catch (error) {
      console.error("BarcodeDetector image scan failed", error);
    }

    return null;
  };

  const createProcessedVariant = (img, options = {}) => {
    const {
      cropStart = 0,
      cropHeightRatio = 1,
      scale = 1,
      grayscale = false,
      contrast = 1,
      rotate = 0,
    } = options;

    const cropHeight = img.height * cropHeightRatio;
    const cropY = (img.height - cropHeight) * cropStart;
    const radians = (rotate * Math.PI) / 180;
    const swapDimensions = Math.abs(rotate) % 180 === 90;
    const sourceWidth = img.width * scale;
    const sourceHeight = cropHeight * scale;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: grayscale || contrast !== 1 });

    if (!ctx) {
      return null;
    }

    canvas.width = swapDimensions ? sourceHeight : sourceWidth;
    canvas.height = swapDimensions ? sourceWidth : sourceHeight;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(
      img,
      0,
      cropY,
      img.width,
      cropHeight,
      -sourceWidth / 2,
      -sourceHeight / 2,
      sourceWidth,
      sourceHeight
    );

    if (grayscale || contrast !== 1) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;

      for (let index = 0; index < data.length; index += 4) {
        let red = data[index];
        let green = data[index + 1];
        let blue = data[index + 2];

        if (grayscale) {
          const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
          red = luminance;
          green = luminance;
          blue = luminance;
        }

        red = Math.max(0, Math.min(255, (red - 128) * contrast + 128));
        green = Math.max(0, Math.min(255, (green - 128) * contrast + 128));
        blue = Math.max(0, Math.min(255, (blue - 128) * contrast + 128));

        data[index] = red;
        data[index + 1] = green;
        data[index + 2] = blue;
      }

      ctx.putImageData(imageData, 0, 0);
    }

    return canvas.toDataURL("image/png");
  };

  const createCroppedVariant = (img, cropStart, cropHeightRatio) => {
    return createProcessedVariant(img, { cropStart, cropHeightRatio });
  };

  const buildImageVariants = (img, originalSrc) => {
    const variants = [originalSrc];
    const processedVariants = [
      createCroppedVariant(img, 0.5, 0.6),
      createCroppedVariant(img, 0.45, 0.75),
      createCroppedVariant(img, 0.35, 0.85),
      createProcessedVariant(img, { cropStart: 0.45, cropHeightRatio: 0.75, scale: 1.5 }),
      createProcessedVariant(img, {
        cropStart: 0.45,
        cropHeightRatio: 0.75,
        scale: 1.5,
        grayscale: true,
        contrast: 1.45,
      }),
      createProcessedVariant(img, {
        cropStart: 0.35,
        cropHeightRatio: 0.85,
        grayscale: true,
        contrast: 1.65,
      }),
      createProcessedVariant(img, {
        cropStart: 0.45,
        cropHeightRatio: 0.75,
        scale: 1.35,
        rotate: 90,
      }),
      createProcessedVariant(img, {
        cropStart: 0.45,
        cropHeightRatio: 0.75,
        scale: 1.35,
        rotate: -90,
      }),
    ].filter(Boolean);

    return [...new Set([...variants, ...processedVariants])];
  };

  const tryDecodeImage = async (img, originalSrc) => {
    const variants = buildImageVariants(img, originalSrc);
    const decodeCounts = new Map();

    const originalDetectorCode = await decodeWithBarcodeDetector(img);
    if (originalDetectorCode) {
      decodeCounts.set(originalDetectorCode, (decodeCounts.get(originalDetectorCode) ?? 0) + 3);
    }

    for (const variant of variants) {
      const detectorImage = new Image();
      detectorImage.src = variant;
      await new Promise((resolve) => {
        detectorImage.onload = resolve;
        detectorImage.onerror = resolve;
      });

      const detectorCode = await decodeWithBarcodeDetector(detectorImage);
      if (detectorCode) {
        decodeCounts.set(detectorCode, (decodeCounts.get(detectorCode) ?? 0) + 2);
      }

      const locatedCode = await decodeImage(variant, true);
      if (locatedCode) {
        decodeCounts.set(locatedCode, (decodeCounts.get(locatedCode) ?? 0) + 1);
      }

      const directCode = await decodeImage(variant, false);
      if (directCode) {
        decodeCounts.set(directCode, (decodeCounts.get(directCode) ?? 0) + 1);
      }
    }

    const rankedResults = [...decodeCounts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return right[0].length - left[0].length;
    });

    const [bestMatch] = rankedResults;

    if (!bestMatch) {
      return null;
    }

    if (bestMatch[1] >= 2 || rankedResults.length === 1) {
      return bestMatch[0];
    }

    return null;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    const imageUrl = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        setScanStatus("Analyzing uploaded barcode image...");
        const barcode = await tryDecodeImage(img, imageUrl);

        if (barcode) {
          setDetectedBarcode(barcode);
          setManualBarcode(barcode);
          setScanStatus("Barcode detected from image. Looking up product...");
          onScanSuccess(barcode);
        } else {
          setScanStatus("No reliable barcode match was found. You can type the barcode manually below.");
        }
      } finally {
        URL.revokeObjectURL(imageUrl);
        event.target.value = "";
      }
    };

    img.src = imageUrl;
  };

  const submitManualBarcode = (event) => {
    event.preventDefault();

    const normalizedBarcode = normalizeBarcode(manualBarcode);

    if (!normalizedBarcode || !/^\d{8,13}$/.test(normalizedBarcode)) {
      setScanStatus("Enter an 8 to 13 digit UPC or EAN barcode.");
      return;
    }

    setDetectedBarcode(normalizedBarcode);
    setScanStatus("Using manually entered barcode. Looking up product...");
    onScanSuccess(normalizedBarcode);
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

      <div className="upload-section">
        <label className="upload-label" htmlFor="barcode-upload">
          Upload Barcode Image
        </label>
        <input
          id="barcode-upload"
          className="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>

      <div className="scan-feedback-card">
        <div className="scan-feedback-header">
          <strong>Detected barcode</strong>
          <span>{detectedBarcode || "Waiting for a reliable match"}</span>
        </div>
        <p className="scan-feedback-text">
          {scanStatus || "If a package still fails, type the barcode number manually to verify the lookup."}
        </p>
      </div>

      <form className="manual-barcode-form" onSubmit={submitManualBarcode}>
        <label className="upload-label" htmlFor="manual-barcode">
          Enter barcode manually
        </label>
        <div className="manual-barcode-row">
          <input
            id="manual-barcode"
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
      </form>
    </div>
  );
}

export default BarcodeScanner;
