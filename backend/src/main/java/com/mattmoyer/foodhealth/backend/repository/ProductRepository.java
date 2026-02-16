package com.mattmoyer.foodhealth.backend.repository;

import com.mattmoyer.foodhealth.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
}