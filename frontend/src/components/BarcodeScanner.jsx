import Quagga from "@ericblade/quagga2";

function BarcodeScanner({ onScanSuccess }) {

  const handleFileUpload = (event) => {

    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

      const img = new Image();
      img.src = reader.result;

      img.onload = function () {

        Quagga.decodeSingle(
          {
            src: img.src,
            numOfWorkers: 0,
            inputStream: {
              size: 800
            },
            decoder: {
              readers: [
                "upc_reader",
                "upc_e_reader",
                "ean_reader",
                "ean_8_reader"
              ]
            }
          },
          function (result) {

            if (result && result.codeResult) {
              onScanSuccess(result.codeResult.code);
            } else {
              alert("Could not detect barcode. Try a clearer image.");
            }

          }
        );

      };

    };

    reader.readAsDataURL(file);
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>Upload Barcode Image</h3>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
      />
    </div>
  );
}

export default BarcodeScanner;
