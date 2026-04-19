package com.mattmoyer.foodhealth.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.*;

@Service
public class OpenFoodFactsService {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final Set<String> IGNORED_INGREDIENT_TERMS = Set.of(
            "and",
            "or",
            "with",
            "contains",
            "contain",
            "less than",
            "less than 2 of",
            "less than 2% of",
            "less than 1 of",
            "less than 1% of");

    public Map<String, Object> fetchProductByBarcode(String barcode) {
        return fetchProductByBarcode(List.of(barcode));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchProductByBarcode(List<String> barcodes) {
        if (barcodes == null || barcodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product barcode is required");
        }

        for (String barcode : barcodes) {
            if (barcode == null || barcode.isBlank()) {
                continue;
            }

            String url = "https://world.openfoodfacts.org/api/v0/product/"
                    + barcode + ".json";

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response != null && response.get("status") != null && response.get("status").equals(1)) {
                return (Map<String, Object>) response.get("product");
            }
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found in OpenFoodFacts");
    }

    @SuppressWarnings("unchecked")
    public String searchBarcodeByProductName(String productName) {
        String normalizedQuery = productName == null ? "" : productName.trim();

        if (normalizedQuery.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product name is required");
        }

        String url = UriComponentsBuilder
                .fromUriString("https://world.openfoodfacts.org/cgi/search.pl")
                .queryParam("search_terms", normalizedQuery)
                .queryParam("search_simple", 1)
                .queryParam("action", "process")
                .queryParam("json", 1)
                .queryParam("page_size", 10)
                .queryParam("fields", "code,product_name,brands")
                .toUriString();

        Map<String, Object> response;

        try {
            response = restTemplate.getForObject(url, Map.class);
        } catch (HttpServerErrorException.ServiceUnavailable exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Open Food Facts search is temporarily unavailable. Please try again shortly or use a barcode.");
        }

        if (response == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found in OpenFoodFacts");
        }

        Object productsObject = response.get("products");

        if (!(productsObject instanceof List<?> products) || products.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found in OpenFoodFacts");
        }

        Map<String, Object> bestMatch = null;
        int bestScore = Integer.MIN_VALUE;

        for (Object productObject : products) {
            if (!(productObject instanceof Map<?, ?> rawProduct)) {
                continue;
            }

            Map<String, Object> product = (Map<String, Object>) rawProduct;
            Object code = product.get("code");

            String normalizedBarcode = normalizeSearchResultBarcode(code);

            if (normalizedBarcode.isBlank()) {
                continue;
            }

            int score = scoreSearchMatch(normalizedQuery, product);

            if (score > bestScore) {
                bestMatch = product;
                bestScore = score;
            }
        }

        if (bestMatch == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found in OpenFoodFacts");
        }

        String normalizedBarcode = normalizeSearchResultBarcode(bestMatch.get("code"));

        if (normalizedBarcode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product barcode was unavailable in OpenFoodFacts");
        }

        return normalizedBarcode;
    }

    private int scoreSearchMatch(String query, Map<String, Object> product) {
        String normalizedQuery = normalizeSearchText(query);
        String productName = normalizeSearchText(product.get("product_name"));
        String brand = normalizeSearchText(product.get("brands"));
        Set<String> queryTerms = splitSearchTerms(normalizedQuery);
        Set<String> productTerms = splitSearchTerms(productName);
        Set<String> brandTerms = splitSearchTerms(brand);
        int score = 0;

        if (!productName.isEmpty()) {
            if (productName.equals(normalizedQuery)) {
                score += 500;
            } else if (productName.startsWith(normalizedQuery)) {
                score += 250;
            } else if (productName.contains(normalizedQuery)) {
                score += 180;
            }
        }

        if (!brand.isEmpty()) {
            if (brand.equals(normalizedQuery)) {
                score += 100;
            } else if (normalizedQuery.contains(brand)) {
                score += 30;
            }
        }

        int matchedProductTerms = countSharedTerms(queryTerms, productTerms);
        int matchedBrandTerms = countSharedTerms(queryTerms, brandTerms);
        int missingProductTerms = Math.max(0, queryTerms.size() - matchedProductTerms);
        int extraProductTerms = Math.max(0, productTerms.size() - matchedProductTerms);

        score += matchedProductTerms * 40;
        score += matchedBrandTerms * 10;
        score -= missingProductTerms * 90;
        score -= extraProductTerms * 18;

        if (!queryTerms.isEmpty() && matchedProductTerms == queryTerms.size()) {
            score += 120;
        }

        return score;
    }

    private String normalizeSearchText(Object value) {
        if (value == null) {
            return "";
        }

        return value.toString()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String normalizeSearchResultBarcode(Object code) {
        if (code == null) {
            return "";
        }

        String normalizedCode = code.toString().trim();

        if (normalizedCode.endsWith(".0")) {
            normalizedCode = normalizedCode.substring(0, normalizedCode.length() - 2);
        }

        normalizedCode = normalizedCode.replaceAll("\\D", "");

        if (normalizedCode.length() == 11) {
            return "0" + normalizedCode;
        }

        return normalizedCode;
    }

    private Set<String> splitSearchTerms(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }

        return new LinkedHashSet<>(Arrays.asList(value.split("\\s+")));
    }

    private int countSharedTerms(Set<String> leftTerms, Set<String> rightTerms) {
        int matches = 0;

        for (String term : leftTerms) {
            if (rightTerms.contains(term)) {
                matches++;
            }
        }

        return matches;
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
                    String normalizedIngredient = text.toString()
                            .toLowerCase(Locale.ROOT)
                            .replaceAll("[^a-z0-9%\\s-]", " ")
                            .replaceAll("\\s+", " ")
                            .trim();

                    if (!normalizedIngredient.isBlank()
                            && !IGNORED_INGREDIENT_TERMS.contains(normalizedIngredient)) {
                        ingredientNames.add(normalizedIngredient);
                    }
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
