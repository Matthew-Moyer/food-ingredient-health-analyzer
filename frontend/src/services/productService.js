import axios from "axios";

const API_BASE_URL = "http://localhost:8080/api/products";

export const scanBarcode = async (barcode) => {
  const response = await axios.post(`${API_BASE_URL}/barcode/${barcode}`);

  return response.data;
};
