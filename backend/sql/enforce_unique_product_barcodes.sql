START TRANSACTION;

CREATE TEMPORARY TABLE product_barcode_keepers AS
SELECT barcode, MAX(id) AS keep_id
FROM product
WHERE barcode IS NOT NULL AND barcode <> ''
GROUP BY barcode;

INSERT IGNORE INTO product_ingredient (product_id, ingredient_id)
SELECT keepers.keep_id, product_ingredient.ingredient_id
FROM product
JOIN product_barcode_keepers AS keepers
    ON keepers.barcode = product.barcode
JOIN product_ingredient
    ON product_ingredient.product_id = product.id
WHERE product.id <> keepers.keep_id;

DELETE product_ingredient
FROM product_ingredient
JOIN product
    ON product.id = product_ingredient.product_id
JOIN product_barcode_keepers AS keepers
    ON keepers.barcode = product.barcode
WHERE product.id <> keepers.keep_id;

DELETE product
FROM product
JOIN product_barcode_keepers AS keepers
    ON keepers.barcode = product.barcode
WHERE product.id <> keepers.keep_id;

DROP TEMPORARY TABLE product_barcode_keepers;

CREATE UNIQUE INDEX uk_product_barcode ON product (barcode);

COMMIT;
