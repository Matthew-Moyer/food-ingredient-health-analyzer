package com.mattmoyer.foodhealth.backend.controller;

import com.mattmoyer.foodhealth.backend.entity.Ingredient;
import com.mattmoyer.foodhealth.backend.entity.Product;
import com.mattmoyer.foodhealth.backend.repository.IngredientRepository;
import com.mattmoyer.foodhealth.backend.repository.ProductRepository;
import com.mattmoyer.foodhealth.backend.service.ProductService;
import com.mattmoyer.foodhealth.backend.service.OpenFoodFactsService;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final IngredientRepository ingredientRepository;
    private final ProductService productService;
    private final OpenFoodFactsService openFoodFactsService;

    public ProductController(
            ProductRepository productRepository,
            IngredientRepository ingredientRepository,
            ProductService productService,
            OpenFoodFactsService openFoodFactsService) {

        this.productRepository = productRepository;
        this.ingredientRepository = ingredientRepository;
        this.productService = productService;
        this.openFoodFactsService = openFoodFactsService;
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product) {
        return productRepository.save(product);
    }

    @GetMapping
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    @GetMapping("/{id}")
    public Product getProduct(@PathVariable Long id) {
        return productService.getProductWithHealthScore(id);
    }

    @PostMapping("/{productId}/ingredients/{ingredientId}")
    public Product addIngredientToProduct(
            @PathVariable Long productId,
            @PathVariable Long ingredientId) {

        Product product = productRepository.findById(productId).orElseThrow();
        Ingredient ingredient = ingredientRepository.findById(ingredientId).orElseThrow();

        product.getIngredients().add(ingredient);

        return productRepository.save(product);
    }

    // ===============================
    // BARCODE IMPORT (OpenFoodFacts)
    // ===============================
    @PostMapping("/barcode/{barcode}")
    public Product importByBarcode(@PathVariable String barcode) {

        Map<String, Object> productData = openFoodFactsService.fetchProductByBarcode(barcode);

        if (productData == null) {
            throw new RuntimeException("Product not found in OpenFoodFacts");
        }

        Product product = new Product();

        product.setBarcode(barcode);
        product.setName(
                (String) productData.getOrDefault("product_name", "Unknown"));
        product.setBrand(
                (String) productData.getOrDefault("brands", "Unknown"));

        product = productRepository.save(product);

        // Extract ingredient names
        List<String> ingredients = openFoodFactsService.extractIngredients(productData);

        for (String rawIngredientName : ingredients) {

            final String ingredientName = rawIngredientName.toLowerCase();

            Ingredient ingredient = ingredientRepository
                    .findByName(ingredientName)
                    .orElseGet(() -> {

                        Ingredient newIngredient = new Ingredient();
                        newIngredient.setName(ingredientName);

                        // Unknown ingredients default unhealthy
                        newIngredient.setHealthy(false);
                        newIngredient.setNotes("Auto-added from barcode scan");

                        return ingredientRepository.save(newIngredient);
                    });

            product.getIngredients().add(ingredient);
        }

        int score = productService.calculateHealthScore(product);
        product.setHealthScore(score);

        return productRepository.save(product);
    }
}
