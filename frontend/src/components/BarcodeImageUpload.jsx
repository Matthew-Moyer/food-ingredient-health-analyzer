import { useState } from "react";
import Quagga from "@ericblade/quagga2";

const BARCODE_READERS = [
  "upc_reader",
  "upc_e_reader",
  "ean_reader",
  "ean_8_reader",
];

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

const isValidEan13 = (code) => /^\d{13}$/.test(code)
  && calculateModulo10CheckDigit(code.slice(0, 12)) === Number.parseInt(code[12], 10);

const isValidEan8 = (code) => /^\d{8}$/.test(code)
  && calculateModulo10CheckDigit(code.slice(0, 7)) === Number.parseInt(code[7], 10);

const isValidUpcA = (code) => /^\d{12}$/.test(code)
  && calculateModulo10CheckDigit(code.slice(0, 11)) === Number.parseInt(code[11], 10);

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
      if (code.length === 12) return isValidUpcA(code);
      if (code.length === 13) return isValidEan13(code);
      if (code.length === 8) return isValidEan8(code);
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

function BarcodeImageUpload({ onBarcodeDetected }) {
  const [detectedBarcode, setDetectedBarcode] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

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

  const buildImageVariants = (img, originalSrc) => {
    const variants = [originalSrc];
    const processedVariants = [
      createProcessedVariant(img, { cropStart: 0.5, cropHeightRatio: 0.6 }),
      createProcessedVariant(img, { cropStart: 0.45, cropHeightRatio: 0.75 }),
      createProcessedVariant(img, { cropStart: 0.35, cropHeightRatio: 0.85 }),
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
        setUploadStatus("Analyzing uploaded barcode image...");
        const barcode = await tryDecodeImage(img, imageUrl);

        if (barcode) {
          setDetectedBarcode(barcode);
          setUploadStatus("Barcode detected from image. Looking up product...");
          onBarcodeDetected(barcode);
        } else {
          setUploadStatus("No reliable barcode match was found. Try manual entry if needed.");
        }
      } finally {
        URL.revokeObjectURL(imageUrl);
        event.target.value = "";
      }
    };

    img.src = imageUrl;
  };

  return (
    <div className="barcode-upload-panel">
      <div className="upload-section">
        <label className="upload-label" htmlFor="barcode-upload">
          Upload barcode image
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
          {uploadStatus || "Upload a clear barcode image from your device to run product lookup."}
        </p>
      </div>
    </div>
  );
}

export default BarcodeImageUpload;
