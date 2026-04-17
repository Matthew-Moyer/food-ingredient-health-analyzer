package com.mattmoyer.foodhealth.backend.service;

import com.mattmoyer.foodhealth.backend.entity.Ingredient;
import com.mattmoyer.foodhealth.backend.entity.IngredientHealthStatus;
import com.mattmoyer.foodhealth.backend.entity.Product;
import com.mattmoyer.foodhealth.backend.repository.IngredientRepository;
import com.mattmoyer.foodhealth.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final IngredientRepository ingredientRepository;
    private final OpenFoodFactsService openFoodFactsService;

    public ProductService(
            ProductRepository productRepository,
            IngredientRepository ingredientRepository,
            OpenFoodFactsService openFoodFactsService) {
        this.productRepository = productRepository;
        this.ingredientRepository = ingredientRepository;
        this.openFoodFactsService = openFoodFactsService;
    }

    public Product getProductWithHealthScore(String barcode) {
        List<String> barcodeCandidates = generateBarcodeCandidates(barcode);
        Product product = null;
        String resolvedBarcode = barcode;

        for (String candidate : barcodeCandidates) {
            product = findLatestProductByBarcode(candidate);

            if (product != null) {
                resolvedBarcode = candidate;
                break;
            }
        }

        if (product != null) {
            refreshIngredientHealthStatuses(product);
            updateHealthScore(product);
            Product savedProduct = productRepository.save(product);
            savedProduct.setBarcode(resolvedBarcode);
            savedProduct.setHealthScore(product.getHealthScore());
            return savedProduct;
        }

        Map<String, Object> productData = openFoodFactsService.fetchProductByBarcode(barcodeCandidates);
        resolvedBarcode = resolveBarcodeFromProductData(productData, barcodeCandidates);

        Product newProduct = new Product();
        newProduct.setBarcode(resolvedBarcode);
        newProduct.setName(productData.getOrDefault("product_name", "Unknown Product").toString());
        newProduct.setBrand(productData.getOrDefault("brands", "Unknown Brand").toString());
        newProduct.setIngredients(new ArrayList<>());

        List<String> ingredientNames = openFoodFactsService.extractIngredients(productData);

        for (String rawIngredientName : ingredientNames) {
            String ingredientName = normalizeIngredientName(rawIngredientName);

            if (ingredientName.isEmpty()) {
                continue;
            }

            Ingredient ingredient = ingredientRepository
                    .findByName(ingredientName)
                    .orElseGet(() -> createIngredient(ingredientName));

            if (!newProduct.getIngredients().contains(ingredient)) {
                newProduct.getIngredients().add(ingredient);
            }
        }

        refreshIngredientHealthStatuses(newProduct);
        updateHealthScore(newProduct);
        return productRepository.save(newProduct);
    }

    public Product saveProduct(Product product) {
        Product existingProduct = findLatestProductByBarcode(product.getBarcode());

        if (existingProduct != null && !existingProduct.getId().equals(product.getId())) {
            throw new IllegalStateException("A product with barcode " + product.getBarcode() + " already exists.");
        }

        return productRepository.save(product);
    }

    public Product findLatestProductByBarcode(String barcode) {
        if (barcode == null || barcode.isBlank()) {
            return null;
        }

        return productRepository.findTopByBarcodeOrderByIdDesc(barcode).orElse(null);
    }

    public List<String> generateBarcodeCandidates(String barcode) {
        String normalizedBarcode = barcode == null ? "" : barcode.replaceAll("\\s+", "").trim();
        Set<String> candidates = new LinkedHashSet<>();

        if (normalizedBarcode.isEmpty()) {
            return List.of();
        }

        candidates.add(normalizedBarcode);

        if (normalizedBarcode.matches("\\d{12}")) {
            candidates.add("0" + normalizedBarcode);
        }

        if (normalizedBarcode.matches("\\d{13}") && normalizedBarcode.startsWith("0")) {
            candidates.add(normalizedBarcode.substring(1));
        }

        return new ArrayList<>(candidates);
    }

    private String resolveBarcodeFromProductData(Map<String, Object> productData, List<String> fallbackCandidates) {
        Object code = productData.get("code");

        if (code != null) {
            return code.toString();
        }

        if (fallbackCandidates != null && !fallbackCandidates.isEmpty()) {
            return fallbackCandidates.get(0);
        }

        return "";
    }

    public void updateHealthScore(Product product) {
        if (product.getIngredients() == null || product.getIngredients().isEmpty()) {
            product.setHealthScore(0);
            return;
        }

        int healthyCount = 0;
        int knownCount = 0;

        for (Ingredient ingredient : product.getIngredients()) {
            if (ingredient.getHealthStatus() == IngredientHealthStatus.HEALTHY) {
                healthyCount++;
                knownCount++;
            } else if (ingredient.getHealthStatus() == IngredientHealthStatus.UNHEALTHY) {
                knownCount++;
            }
        }

        if (knownCount == 0) {
            product.setHealthScore(0);
            return;
        }

        int score = (int) (((double) healthyCount / knownCount) * 100);
        product.setHealthScore(score);
    }

    public int calculateHealthScore(Product product) {
        refreshIngredientHealthStatuses(product);
        updateHealthScore(product);
        return product.getHealthScore();
    }

    public void refreshIngredientHealthStatuses(Product product) {
        if (product.getIngredients() == null || product.getIngredients().isEmpty()) {
            return;
        }

        for (Ingredient ingredient : product.getIngredients()) {
            String normalizedName = normalizeIngredientName(ingredient.getName());
            IngredientHealthStatus healthStatus = determineHealthStatus(normalizedName);
            boolean ingredientChanged = false;

            if (!normalizedName.equals(ingredient.getName())) {
                ingredient.setName(normalizedName);
                ingredientChanged = true;
            }

            if (ingredient.getHealthStatus() != healthStatus) {
                ingredient.setHealthStatus(healthStatus);
                ingredientChanged = true;
            }

            if (ingredientChanged) {
                ingredientRepository.save(ingredient);
            }
        }
    }

    public String normalizeIngredientName(String ingredientName) {
        return ingredientName
                .toLowerCase(Locale.ROOT)
                .trim()
                .replaceAll("\\([^)]*\\)", "")
                .replaceAll("\\[[^\\]]*\\]", "")
                .replace(",", "")
                .replace(".", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private Ingredient createIngredient(String ingredientName) {
        Ingredient ingredient = new Ingredient();
        ingredient.setName(ingredientName);
        ingredient.setHealthStatus(determineHealthStatus(ingredientName));
        ingredient.setNotes("Auto-added from barcode scan");
        return ingredientRepository.save(ingredient);
    }

    public IngredientHealthStatus determineHealthStatus(String ingredientName) {

        // Healthy ingredients
        List<String> healthyIngredients = List.of(
                "water", "rice", "brown rice", "quinoa", "oats", "steel cut oats", "barley", "bulgur", "millet",
                "farro", "whole wheat", "whole grain flour", "sweet potato", "potato", "carrot", "broccoli", "spinach",
                "kale", "arugula", "lettuce", "cabbage", "red cabbage", "cauliflower", "brussels sprouts", "zucchini",
                "eggplant", "bell pepper", "red pepper", "green pepper", "yellow pepper", "onion", "red onion",
                "green onion", "garlic", "ginger", "tomato", "cherry tomato", "cucumber", "celery", "beet", "beetroot",
                "radish", "turnip", "parsnip", "pumpkin", "butternut squash", "acorn squash", "spaghetti squash",
                "corn", "peas", "green beans", "snap peas", "asparagus", "artichoke", "leek", "shallot", "mushroom",
                "portobello", "shiitake", "button mushroom", "avocado", "apple", "banana", "orange", "lemon", "lime",
                "grapefruit", "strawberry", "blueberry", "raspberry", "blackberry", "cranberry", "grape", "pineapple",
                "mango", "papaya", "peach", "pear", "plum", "cherry", "kiwi", "pomegranate", "watermelon", "cantaloupe",
                "honeydew", "fig", "date", "raisin", "apricot", "coconut", "coconut milk", "coconut water", "almond",
                "walnut", "cashew", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut", "pine nut",
                "chia seeds", "flax seeds", "pumpkin seeds", "sunflower seeds", "sesame seeds", "hemp seeds", "lentils",
                "green lentils", "red lentils", "black beans", "kidney beans", "pinto beans", "navy beans", "chickpeas",
                "garbanzo beans", "soybeans", "edamame", "tofu", "tempeh", "black-eyed peas", "split peas",
                "white beans", "great northern beans", "yogurt", "greek yogurt", "plain yogurt", "milk", "skim milk",
                "low fat milk", "almond milk", "soy milk", "oat milk", "egg", "egg white", "chicken breast", "turkey",
                "beef", "salmon", "tuna", "cod", "halibut", "tilapia", "shrimp", "sardines", "anchovies",
                "olive oil", "extra virgin olive oil", "avocado oil", "coconut oil", "vinegar", "apple cider vinegar",
                "balsamic vinegar", "red wine vinegar",
                "white vinegar", "honey", "maple syrup", "cinnamon", "turmeric", "cumin", "paprika", "black pepper",
                "white pepper", "chili powder", "oregano", "basil", "thyme", "rosemary", "parsley", "cilantro", "dill",
                "mint", "sage", "bay leaf", "nutmeg", "clove", "cardamom", "ginger powder", "garlic powder",
                "onion powder", "mustard seeds", "fennel seeds", "coriander", "matcha", "green tea", "black tea",
                "herbal tea", "coffee", "dark chocolate", "cacao", "cocoa powder", "whole grain pasta",
                "brown rice pasta", "quinoa pasta", "whole grain bread", "sprouted grain bread", "sourdough", "hummus",
                "guacamole", "salsa", "kimchi", "sauerkraut", "miso", "kombucha", "bone broth", "vegetable broth",
                "chicken broth", "cane sugar", "brown sugar", "yeast extract", "lard", "beef tallow", "bleached flour",
                "enriched flour", "refined wheat flour", "white flour", "gluten", "bacon", "tortilla chips",
                "crackers",
                "whole grain oats", "rolled oats", "buckwheat", "amaranth", "teff", "wild rice", "freekeh",
                "sprouted oats", "cauliflower rice", "yam", "rutabaga", "collard greens", "mustard greens",
                "bok choy", "swiss chard", "okra", "fennel", "jicama", "watercress", "seaweed", "nori", "wakame",
                "lentil pasta", "chickpea pasta", "black bean pasta", "berries", "goji berries", "mulberries",
                "guava", "passion fruit", "dragon fruit", "lychee", "persimmon", "nectarine", "tangerine",
                "clementine", "mandarin", "artichoke hearts", "hearts of palm", "olives", "capers", "pickles",
                "fermented vegetables", "plain kefir", "kefir", "cottage cheese", "ricotta", "goat cheese",
                "mozzarella", "plain skyr", "unsweetened yogurt", "unsweetened greek yogurt", "plain oatmeal",
                "steel cut oatmeal", "unsweetened almond milk", "unsweetened soy milk", "unsweetened oat milk",
                "pea protein", "hemp protein", "pumpkin seed protein", "chicken thigh", "chicken", "turkey breast",
                "ground turkey", "ground chicken", "lean beef", "grass fed beef", "pork tenderloin", "pork loin",
                "bison", "venison", "trout", "mackerel", "herring", "anchovy", "scallops", "mussels", "clams",
                "crab", "lobster", "octopus", "squid", "edamame pasta", "tahini", "almond butter", "peanut butter",
                "cashew butter", "sunflower seed butter", "extra virgin coconut oil", "ghee", "chia", "flax",
                "sesame", "pistachios", "pecans", "macadamia nuts", "walnuts", "almonds", "cashews", "hazelnuts",
                "black rice", "red rice", "forbidden rice", "sorghum", "spelt", "kamut", "rye berries",
                "wheat berries", "sprouted wheat", "sprouted quinoa", "sprouted brown rice", "cassava",
                "plantain", "green plantain", "purple sweet potato", "red potato", "fingerling potato",
                "new potato", "yucca", "celeriac", "daikon", "turnip greens", "beet greens", "dandelion greens",
                "romaine", "endive", "escarole", "radicchio", "microgreens", "sprouts", "alfalfa sprouts",
                "broccoli sprouts", "pea shoots", "snap peas", "snow peas", "sugar snap peas", "pattypan squash",
                "delicata squash", "kabocha squash", "chayote", "tomatillo", "green cabbage", "savoy cabbage",
                "portabella mushrooms", "cremini mushrooms", "oyster mushrooms", "enoki mushrooms",
                "maitake mushrooms", "chanterelle mushrooms", "green olives", "black olives", "dates",
                "medjool dates", "prunes", "currants", "golden raisins", "red grapes", "green grapes",
                "blood orange", "applesauce unsweetened", "unsweetened applesauce", "blackberries", "boysenberries",
                "elderberries", "acai", "starfruit", "jackfruit", "durian", "sapote", "soursop", "cherimoya",
                "camu camu", "acerola", "kiwifruit", "ground cherries", "gooseberries", "cranberries unsweetened",
                "pomegranate seeds", "sun dried tomatoes", "dried figs", "dried apricots unsweetened",
                "chestnuts", "filberts", "tigernuts", "water chestnuts", "cannellini beans", "borlotti beans",
                "adzuki beans", "mung beans", "lima beans", "butter beans", "fava beans", "cranberry beans",
                "pink beans", "roman beans", "soybeans whole", "black lentils", "french lentils", "beluga lentils",
                "yellow split peas", "green split peas", "moong dal", "urad dal", "masoor dal", "whole peas",
                "plain kefir cheese", "farmers cheese", "paneer", "egg yolk", "duck egg", "quail egg",
                "sardine", "salmon fillet", "cod fillet", "pollock", "arctic char", "sea bass", "perch",
                "halibut fillet", "yellowfin tuna", "skipjack tuna", "sole", "flounder", "snapper",
                "chicken liver", "beef liver", "turkey breast roast", "rotisserie chicken plain",
                "extra virgin avocado oil", "raw honey", "cacao nibs", "unsweetened coconut flakes",
                "pumpkin puree", "plain salsa", "plain hummus",
                "wheat", "whole grain corn", "cornmeal", "corn meal", "rye", "bran", "wheat bran", "oat bran",
                "folic acid", "minerals", "vitamins", "sugar", "vitamin a", "vitamin b1", "vitamin b2",
                "vitamin b3", "vitamin b5", "vitamin b6", "vitamin b7", "vitamin b9", "vitamin b12",
                "vitamin c", "vitamin d", "vitamin e", "vitamin k", "thiamin", "thiamine", "riboflavin",
                "niacin", "pantothenic acid", "biotin", "folate", "cyanocobalamin", "methylcobalamin",
                "pyridoxine", "pyridoxine hydrochloride", "ascorbic acid", "cholecalciferol", "ergocalciferol",
                "tocopherols", "mixed tocopherols", "phylloquinone", "retinol", "beta carotene", "beta-carotene",
                "calcium", "iron", "magnesium", "zinc", "potassium", "phosphorus", "iodine", "selenium",
                "copper", "manganese", "chromium", "molybdenum", "chloride", "boron", "silicon", "fluoride",
                "calcium carbonate", "calcium citrate", "calcium phosphate", "tricalcium phosphate",
                "magnesium oxide", "magnesium citrate", "zinc oxide", "zinc sulfate", "ferrous sulfate",
                "ferrous fumarate", "ferrous gluconate", "potassium iodide", "sodium selenite",
                "manganese sulfate", "cupric sulfate", "chromium picolinate", "potassium phosphate");

        // Unhealthy additives
        List<String> unhealthyIngredients = List.of(
                "high fructose corn syrup", "corn syrup", "glucose syrup", "fructose syrup", "invert sugar",
                "malt syrup", "dextrose", "maltodextrin", "sucrose", "refined sugar",
                "powdered sugar", "confectioners sugar", "artificial sweetener", "aspartame", "sucralose", "saccharin",
                "acesulfame potassium", "neotame", "advantame", "cyclamate", "caramel color", "artificial color",
                "red 40", "yellow 5", "yellow 6", "blue 1", "blue 2", "green 3", "red 3", "titanium dioxide", "msg",
                "monosodium glutamate", "disodium inosinate", "disodium guanylate",
                "hydrolyzed protein", "hydrolyzed vegetable protein", "hydrolyzed corn protein",
                "hydrolyzed wheat protein", "hydrolyzed soy protein", "textured vegetable protein", "artificial flavor",
                "natural flavor", "imitation flavor", "smoke flavor", "butter flavor", "vanillin", "ethyl vanillin",
                "diacetyl", "propylene glycol", "polysorbate 80", "polysorbate 60", "mono and diglycerides",
                "diglycerides", "monoglycerides", "partially hydrogenated oil", "hydrogenated oil", "trans fat",
                "vegetable shortening", "interesterified fat", "palm kernel oil", "palm oil", "refined vegetable oil",
                "soybean oil", "corn oil", "cottonseed oil", "canola oil", "grapeseed oil", "rice bran oil",
                "safflower oil", "sunflower oil refined", "shortening", "preservative",
                "sodium benzoate", "potassium benzoate", "calcium propionate", "sodium nitrate", "sodium nitrite",
                "potassium nitrate", "potassium nitrite", "bht", "bha", "tbhq", "ethoxyquin", "sulfur dioxide",
                "sodium sulfite", "sodium bisulfite", "potassium sorbate", "calcium sorbate", "propyl gallate",
                "tert butylhydroquinone", "phosphoric acid", "lactic acid additive", "acetic acid additive",
                "citric acid", "fumaric acid", "malic acid", "tartaric acid", "ammonium chloride", "ammonium sulfate",
                "sodium phosphate", "disodium phosphate", "trisodium phosphate", "monosodium phosphate",
                "dipotassium phosphate", "sodium aluminum phosphate", "aluminum sulfate", "aluminum hydroxide",
                "aluminum silicate", "calcium chloride", "magnesium chloride", "potassium chloride",
                "ammonium bicarbonate", "sodium bicarbonate processed", "baking powder with aluminum",
                "degermed cornmeal", "instant flour",
                "self rising flour", "modified food starch", "pregelatinized starch", "oxidized starch",
                "acetylated starch", "crosslinked starch", "food starch modified", "cornstarch refined",
                "gelatinized starch", "dextrin", "polydextrose", "cellulose gum", "carboxymethyl cellulose",
                "methylcellulose", "microcrystalline cellulose", "hydroxypropyl cellulose", "guar gum", "xanthan gum",
                "locust bean gum", "tara gum", "gellan gum", "arabic gum", "tragacanth gum", "carrageenan",
                "agar additive", "pectin low quality", "gelatin processed", "gelatin", "caseinate", "sodium caseinate",
                "calcium caseinate", "potassium caseinate", "whey protein isolate", "whey protein concentrate",
                "milk protein isolate", "milk protein concentrate", "soy protein isolate", "soy protein concentrate",
                "pea protein isolate", "corn protein", "vital wheat gluten", "seitan processed",
                "imitation cheese", "processed cheese", "cheese product", "cheese food", "cheese spread",
                "non dairy creamer", "coffee creamer powder", "whipped topping", "aerosol whipped cream",
                "icing stabilizer", "frosting mix", "cake mix", "pancake mix", "waffle mix",
                "instant noodles seasoning", "ramen flavor packet", "bouillon cube", "bouillon powder", "stock cube",
                "gravy mix", "gravy powder", "soup base", "instant soup mix", "flavor enhancer", "seasoning blend",
                "spice extract", "meat tenderizer", "liquid smoke", "barbecue sauce", "ketchup", "mustard processed",
                "salad dressing", "mayonnaise", "reduced fat mayonnaise", "sandwich spread", "cheese sauce",
                "nacho cheese", "pizza sauce processed", "tomato paste processed", "canned tomato sauce",
                "fruit concentrate", "juice concentrate", "fruit cocktail syrup", "sweetened condensed milk",
                "evaporated milk", "flavored milk", "chocolate syrup", "caramel syrup", "pancake syrup",
                "dessert topping", "marshmallow fluff", "marshmallow", "gel candy", "gummy candy", "hard candy",
                "chewing gum", "bubble gum", "licorice candy", "chocolate candy", "white chocolate", "milk chocolate",
                "candy coating", "candy glaze", "shellac", "confectionery glaze", "food wax", "paraffin wax",
                "beeswax additive", "mineral oil food grade", "petroleum jelly food grade", "antifoaming agent",
                "dimethylpolysiloxane", "silicone dioxide", "calcium silicate", "magnesium silicate",
                "tricalcium phosphate", "anticaking agent", "emulsifier", "lecithin processed", "soy lecithin",
                "sunflower lecithin refined", "monoesters", "diesters", "ester gum", "propylene glycol alginate",
                "sorbitan monostearate", "sorbitan tristearate", "polyglycerol esters", "sucrose esters",
                "fat replacer", "olestra", "salatrim", "z trim", "synthetic fat", "artificial butter", "fake cheese",
                "imitation meat", "plant based processed meat", "vegan cheese processed", "fake bacon",
                "fake chicken nuggets", "processed deli meat", "bologna", "salami", "pepperoni", "hot dog",
                "sausage processed", "spam", "canned meat", "cured meat", "jerky processed",
                "ham processed", "turkey deli meat", "chicken nuggets", "chicken patties", "fish sticks",
                "breaded shrimp", "breaded fish", "frozen pizza", "frozen dinner", "tv dinner", "microwave meal",
                "flavored rice mix", "mac and cheese box", "cheese powder", "snack chips",
                "potato chips", "corn chips", "cheese puffs", "cheese balls",
                "flavored crackers", "sandwich cookies", "cream filled cookies", "chocolate chip cookies processed",
                "biscuits", "shortbread cookies", "granola bar processed", "protein bar processed",
                "energy bar processed", "breakfast cereal", "sweetened cereal", "frosted cereal",
                "instant oatmeal flavored", "toaster pastries", "pop tarts", "donuts", "pastries",
                "croissants processed", "cake", "cupcakes", "brownies", "ice cream", "frozen yogurt sweetened",
                "gelato sweetened", "sherbet", "sorbet sweetened", "milkshake", "smoothie mix",
                "protein shake processed", "sports drink", "energy drink", "soda", "diet soda", "cola", "root beer",
                "fruit punch drink", "lemonade processed", "iced tea sweetened", "coffee drink bottled",
                "flavored latte", "frappuccino", "alcohol flavoring", "beer additive", "wine additive", "liquor flavor",
                "food dye", "color additive", "synthetic pigment", "flavor chemical", "processing aid",
                "anti caking compound", "bleaching agent", "chlorine dioxide", "benzoyl peroxide", "azodicarbonamide",
                "potassium bromate", "brominated flour", "brominated vegetable oil", "emulsifying salt", "stabilizer",
                "thickener", "gelling agent", "foaming agent", "firming agent", "glazing agent", "humectant",
                "sequestrant", "buffering agent", "acid regulator", "raising agent", "leavening agent",
                "flour treatment agent", "enzyme modified", "enzyme treated", "protein hydrolysate",
                "synthetic vitamin", "fortified mineral", "iron filings", "reduced iron", "niacinamide",
                "riboflavin additive", "thiamine mononitrate", "folic acid synthetic", "cyanocobalamin",
                "pyridoxine hydrochloride", "ascorbic acid additive", "vitamin e acetate", "retinyl palmitate",
                "cholecalciferol additive", "tocopherol additive", "flavor packet", "seasoning powder",
                "instant sauce mix", "ready made frosting", "dessert mix", "instant pudding", "gelatin dessert",
                "powdered drink mix", "flavored powder", "artificial broth", "fake stock", "synthetic seasoning",
                "processed topping", "food additive blend", "ultra processed food", "ready to eat meal",
                "heat and serve meal", "canola oil", "sunflower oil",
                "flaxseed oil",
                "margarine", "corn sweetener", "glucose fructose syrup", "fructose", "liquid sugar",
                "cane juice concentrate", "evaporated cane juice", "brown rice syrup", "rice syrup", "agave syrup",
                "agave nectar", "molasses", "trehalose", "maltose", "synthetic flavor", "artificial vanilla",
                "butter extract", "coloring", "annatto color", "tartrazine", "allura red", "sunset yellow",
                "brilliant blue", "preserved with sodium benzoate", "preserved with potassium sorbate",
                "preserved with calcium propionate", "nitrates", "nitrites", "sulfites", "phosphate additive",
                "tripolyphosphate", "sodium acid pyrophosphate", "disodium edta", "calcium disodium edta",
                "propylene glycol ester", "datem", "sodium stearoyl lactylate", "malt extract", "barley malt extract",
                "corn solids", "milk solids", "nonfat dry milk", "shortening blend", "hydrogenated vegetable oil",
                "partially hydrogenated soybean oil", "partially hydrogenated cottonseed oil",
                "interesterified soybean oil", "palm olein", "fractionated palm oil", "refined palm oil",
                "refined sunflower oil", "refined canola oil", "refined soybean oil", "vegetable oil",
                "soybean shortening", "wheat starch", "modified corn starch", "modified tapioca starch",
                "modified potato starch", "isolated soy protein", "isolated pea protein", "flavored syrup",
                "vanilla syrup", "sweetened dried cranberries", "sweetened dried cherries", "candied fruit",
                "fruit filling", "pie filling", "frosting", "icing", "brownie mix", "cookie dough",
                "processed snack cake", "muffin mix", "sweet roll", "breakfast bar", "cereal bar",
                "sweetened granola", "instant grits", "instant mashed potatoes", "flavored noodles", "boxed rice mix",
                "stuffing mix", "processed soup", "canned soup", "condensed soup", "frozen burrito",
                "frozen sandwich", "breakfast sandwich", "sausage link", "sausage patty", "deli turkey",
                "deli ham", "processed chicken", "processed beef", "meatballs frozen", "imitation crab",
                "cheese dip", "processed yogurt drink", "sweetened yogurt", "low fat flavored yogurt",
                "meal replacement shake", "protein powder flavored", "electrolyte drink", "sweetened coconut water",
                "sweet tea", "bottled smoothie", "sweetened coffee", "coffee creamer", "whitening agent",
                "anti-foaming agent", "anti-caking agent", "clarifying agent", "coating agent",
                "sugar", "cane sugar", "beet sugar", "table sugar, gelatin");

        String name = normalizeIngredientName(ingredientName);

        if (containsAnyIngredient(name, unhealthyIngredients)) {
            return IngredientHealthStatus.UNHEALTHY;
        }

        if (containsAnyIngredient(name, healthyIngredients)) {
            return IngredientHealthStatus.HEALTHY;
        }

        return IngredientHealthStatus.UNKNOWN;
    }

    private boolean containsAnyIngredient(String ingredientName, List<String> ingredientList) {
        return ingredientList.stream()
                .map(item -> item.toLowerCase(Locale.ROOT).trim())
                .anyMatch(ingredientName::contains);
    }

    public boolean determineIfHealthy(String ingredientName) {
        return determineHealthStatus(ingredientName) == IngredientHealthStatus.HEALTHY;
    }
}
