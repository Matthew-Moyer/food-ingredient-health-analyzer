package com.mattmoyer.foodhealth.backend.entity;

import jakarta.persistence.*;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    @Enumerated(EnumType.STRING)
    private IngredientHealthStatus healthStatus = IngredientHealthStatus.UNKNOWN;
    private String notes;

    @Column(length = 1000)
    private String explanation;

    @JsonIgnore
    @ManyToMany(mappedBy = "ingredients")
    private List<Product> products;

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public IngredientHealthStatus getHealthStatus() {
        return healthStatus == null ? IngredientHealthStatus.UNKNOWN : healthStatus;
    }

    public void setHealthStatus(IngredientHealthStatus healthStatus) {
        this.healthStatus = healthStatus == null ? IngredientHealthStatus.UNKNOWN : healthStatus;
    }

    public boolean isHealthy() {
        return healthStatus == IngredientHealthStatus.HEALTHY;
    }

    public boolean isUnknown() {
        return healthStatus == IngredientHealthStatus.UNKNOWN;
    }

    public void setHealthy(boolean healthy) {
        this.healthStatus = healthy
                ? IngredientHealthStatus.HEALTHY
                : IngredientHealthStatus.UNHEALTHY;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<Product> getProducts() {
        return products;
    }

    public void setProducts(List<Product> products) {
        this.products = products;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (!(o instanceof Ingredient))
            return false;
        Ingredient that = (Ingredient) o;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
