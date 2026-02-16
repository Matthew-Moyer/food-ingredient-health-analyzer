package com.mattmoyer.foodhealth.backend.controller;

import com.mattmoyer.foodhealth.backend.entity.Ingredient;
import com.mattmoyer.foodhealth.backend.entity.Product;
import com.mattmoyer.foodhealth.backend.repository.IngredientRepository;
import com.mattmoyer.foodhealth.backend.repository.ProductRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final IngredientRepository ingredientRepository;

    public ProductController(ProductRepository productRepository,
            IngredientRepository ingredientRepository) {
        this.productRepository = productRepository;
        this.ingredientRepository = ingredientRepository;
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product) {
        return productRepository.save(product);
    }

    @GetMapping
    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    @PostMapping("/{productId}/ingredients/{ingredientId}")
    public Product addIngredientToProduct(@PathVariable Long productId,
            @PathVariable Long ingredientId) {
        Product product = productRepository.findById(productId).orElseThrow();
        Ingredient ingredient = ingredientRepository.findById(ingredientId).orElseThrow();

        product.getIngredients().add(ingredient);
        return productRepository.save(product);
    }
}
