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

export const searchProductByName = async (productName) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/search/by-name`, {
      params: { name: productName },
    });

    return response.data;
  } catch (error) {
    console.error("Error searching product by name:", error);
    throw error;
  }
};
