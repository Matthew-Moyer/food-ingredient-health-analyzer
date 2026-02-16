package com.mattmoyer.foodhealth.backend.repository;

import com.mattmoyer.foodhealth.backend.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
}
