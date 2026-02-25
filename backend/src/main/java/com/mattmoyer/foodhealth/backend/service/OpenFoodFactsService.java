package com.mattmoyer.foodhealth.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class OpenFoodFactsService {

    private final RestTemplate restTemplate = new RestTemplate();

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchProductByBarcode(String barcode) {

        String url = "https://world.openfoodfacts.org/api/v0/product/"
                + barcode + ".json";

        Map<String, Object> response = restTemplate.getForObject(url, Map.class);

        if (response == null || !response.get("status").equals(1)) {
            throw new RuntimeException("Product not found in OpenFoodFacts");
        }

        return (Map<String, Object>) response.get("product");
    }

    public List<String> extractIngredients(
            Map<String, Object> productData) {

        List<String> ingredientNames = new ArrayList<>();

        Object ingredientsObj = productData.get("ingredients");

        if (ingredientsObj instanceof List<?>) {

            List<?> ingredients = (List<?>) ingredientsObj;

            for (Object obj : ingredients) {

                @SuppressWarnings("unchecked")
                Map<String, Object> ingredient = (Map<String, Object>) obj;

                Object text = ingredient.get("text");

                if (text != null) {
                    ingredientNames.add(
                            text.toString().toLowerCase());
                }
            }
        }

        return ingredientNames;
    }

    public String extractProductName(
            Map<String, Object> productData) {

        Object name = productData.get("product_name");

        if (name == null) {
            return "Unknown Product";
        }

        return name.toString();
    }
}
