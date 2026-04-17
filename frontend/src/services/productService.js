import axios from "axios";

const API_BASE_URL = "http://localhost:8080/api/products";

export const scanBarcode = async (barcode) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/${barcode}`);

    return response.data;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
};
