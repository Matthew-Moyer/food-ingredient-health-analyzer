package com.mattmoyer.foodhealth.backend.repository;

import com.mattmoyer.foodhealth.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findTopByBarcodeOrderByIdDesc(String barcode);
    List<Product> findAllByBarcodeOrderByIdDesc(String barcode);
    List<Product> findByNameContainingIgnoreCaseOrBrandContainingIgnoreCase(String name, String brand);
}
