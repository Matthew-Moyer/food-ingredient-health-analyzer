package com.mattmoyer.foodhealth.backend.service;

import com.mattmoyer.foodhealth.backend.entity.Product;
import com.mattmoyer.foodhealth.backend.entity.Ingredient;
import com.mattmoyer.foodhealth.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public Product getProductWithHealthScore(Long id) {

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        updateHealthScore(product);

        return productRepository.save(product);
    }

    public void updateHealthScore(Product product) {

        if (product.getIngredients() == null || product.getIngredients().isEmpty()) {
            product.setHealthScore(0);
            return;
        }

        int healthyCount = 0;
        int total = product.getIngredients().size();

        for (Ingredient ingredient : product.getIngredients()) {
            if (ingredient.isHealthy()) {
                healthyCount++;
            }
        }

        int score = (int) (((double) healthyCount / total) * 100);

        product.setHealthScore(score);
    }
}
