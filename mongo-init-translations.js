// MongoDB initialization script for translation mappings

db = db.getSiblingDB('transaction-categorizer');

// Create translation mappings collection with indexes
db.createCollection('translationmappings');
db.translationmappings.createIndex({ original: 1 }, { unique: true });
db.translationmappings.createIndex({ userId: 1 });
db.translationmappings.createIndex({ usageCount: -1 });

// Insert default translation mappings
const defaultMappings = [
    // Common grocery items
    { original: "BAG.PAIN GRIL.AI", translation: "Garlic Grilled Baguette", usageCount: 0 },
    { original: "SELECTION EPICE", translation: "Spice Selection", usageCount: 0 },
    { original: "SELECTION LEG.C", translation: "Canned Vegetable Selection", usageCount: 0 },
    { original: "RABAIS", translation: "Discount", usageCount: 0 },
    { original: "PAIN BLANC", translation: "White Bread", usageCount: 0 },
    { original: "PAIN COMPLET", translation: "Whole Wheat Bread", usageCount: 0 },
    { original: "LAIT 2%", translation: "2% Milk", usageCount: 0 },
    { original: "LAIT 3.25%", translation: "Whole Milk", usageCount: 0 },
    { original: "FROMAGE CHEDDAR", translation: "Cheddar Cheese", usageCount: 0 },
    { original: "FROMAGE MOZZA", translation: "Mozzarella Cheese", usageCount: 0 },
    { original: "POULET FRAIS", translation: "Fresh Chicken", usageCount: 0 },
    { original: "BOEUF HACHE", translation: "Ground Beef", usageCount: 0 },
    { original: "PORC COTELETTE", translation: "Pork Chops", usageCount: 0 },
    { original: "TOMATES CERISES", translation: "Cherry Tomatoes", usageCount: 0 },
    { original: "POMMES GALA", translation: "Gala Apples", usageCount: 0 },
    { original: "BANANES", translation: "Bananas", usageCount: 0 },
    { original: "CAROTTES", translation: "Carrots", usageCount: 0 },
    { original: "SALADE ICEBERG", translation: "Iceberg Lettuce", usageCount: 0 },
    { original: "SALADE ROMAINE", translation: "Romaine Lettuce", usageCount: 0 },
    { original: "RIZ BASMATI", translation: "Basmati Rice", usageCount: 0 },
    { original: "PATES SPAGHETTI", translation: "Spaghetti Pasta", usageCount: 0 },
    { original: "HUILE OLIVE", translation: "Olive Oil", usageCount: 0 },
    { original: "HUILE CANOLA", translation: "Canola Oil", usageCount: 0 },
    { original: "SEL DE TABLE", translation: "Table Salt", usageCount: 0 },
    { original: "POIVRE NOIR", translation: "Black Pepper", usageCount: 0 },
    { original: "SUCRE BLANC", translation: "White Sugar", usageCount: 0 },
    { original: "FARINE TOUT USAGE", translation: "All-Purpose Flour", usageCount: 0 },
    { original: "CAFE MOULU", translation: "Ground Coffee", usageCount: 0 },
    { original: "THE VERT", translation: "Green Tea", usageCount: 0 },
    { original: "THE NOIR", translation: "Black Tea", usageCount: 0 },
    { original: "JUS ORANGE", translation: "Orange Juice", usageCount: 0 },
    { original: "JUS POMME", translation: "Apple Juice", usageCount: 0 },
    { original: "EAU PETILLANTE", translation: "Sparkling Water", usageCount: 0 },
    { original: "GLACE VANILLE", translation: "Vanilla Ice Cream", usageCount: 0 },
    { original: "GLACE CHOCOLAT", translation: "Chocolate Ice Cream", usageCount: 0 },
    { original: "CHOCOLAT NOIR", translation: "Dark Chocolate", usageCount: 0 },
    { original: "CHOCOLAT LAIT", translation: "Milk Chocolate", usageCount: 0 },
    { original: "BISCUITS CHOCOLAT", translation: "Chocolate Cookies", usageCount: 0 },
    { original: "GATEAU CHOCOLAT", translation: "Chocolate Cake", usageCount: 0 },
    { original: "VIANDE HACHEE", translation: "Ground Meat", usageCount: 0 },
    { original: "POISSON FRAIS", translation: "Fresh Fish", usageCount: 0 },
    { original: "FRUITS FRAIS", translation: "Fresh Fruits", usageCount: 0 },
    { original: "LEGUMES FRAIS", translation: "Fresh Vegetables", usageCount: 0 },
    { original: "SURGELE LEGUMES", translation: "Frozen Vegetables", usageCount: 0 },
    { original: "BIO TOMATES", translation: "Organic Tomatoes", usageCount: 0 },
    { original: "BIO CAROTTES", translation: "Organic Carrots", usageCount: 0 },
    { original: "SANS GLUTEN", translation: "Gluten Free", usageCount: 0 },
    { original: "SANS LACTOSE", translation: "Lactose Free", usageCount: 0 },
    { original: "AVEC FIBRES", translation: "With Fiber", usageCount: 0 },
    
    // Common store abbreviations
    { original: "BAG.", translation: "Baguette", usageCount: 0 },
    { original: "LEG.C", translation: "Canned Vegetables", usageCount: 0 },
    { original: "LEG.", translation: "Vegetables", usageCount: 0 },
    { original: "GRIL.", translation: "Grilled", usageCount: 0 },
    { original: "AI", translation: "Garlic", usageCount: 0 },
    { original: "FR.", translation: "Fresh", usageCount: 0 },
    { original: "SURG.", translation: "Frozen", usageCount: 0 },
    { original: "BTE", translation: "Box", usageCount: 0 },
    { original: "PKG", translation: "Package", usageCount: 0 },
    { original: "SAC", translation: "Bag", usageCount: 0 },
    { original: "BTL", translation: "Bottle", usageCount: 0 },
    { original: "CAN", translation: "Can", usageCount: 0 },
    { original: "PC", translation: "Piece", usageCount: 0 },
    { original: "DZ", translation: "Dozen", usageCount: 0 },
    { original: "KG", translation: "Kilogram", usageCount: 0 },
    { original: "LB", translation: "Pound", usageCount: 0 },
    { original: "L", translation: "Liter", usageCount: 0 },
    { original: "ML", translation: "Milliliter", usageCount: 0 }
];

// Add creation timestamp to all default mappings
const now = new Date();
defaultMappings.forEach(mapping => {
    mapping.createdAt = now;
    mapping.updatedAt = now;
});

// Insert the default mappings
db.translationmappings.insertMany(defaultMappings);

print('Translation mappings collection initialized with ' + defaultMappings.length + ' default mappings');

// Create receipts collection
db.createCollection('receipts');
db.receipts.createIndex({ userId: 1, date: -1 });
db.receipts.createIndex({ createdAt: -1 });

print('Receipts collection created with indexes');
