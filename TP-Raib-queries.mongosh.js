// TP MongoDB CRUD - Corrigé complet
// Base: shop

use shop;

// =====================
// NIVEAU 1
// =====================

// 1. Produits catégorie Livres
db.products.find({ category: "Livres" });

// 2. Stock > 100
db.products.find({ stock: { $gt: 100 } });

// 3. SKU-1042
db.products.findOne({ sku: "SKU-1042" });

// 4. Prix entre 20 et 50
db.products.find({ price: { $gte: 20, $lte: 50 } });

// =====================
// NIVEAU 2
// =====================

// 5. paid OU shipped
db.orders.find({ status: { $in: ["paid", "shipped"] } });

// 6. pas Jouets ni Sport
db.products.find({ category: { $nin: ["Jouets", "Sport"] } });

// 7. paid et total > 200
db.orders.find({ status: "paid", total: { $gt: 200 } });

// 8. cancelled OU total > 1000
db.orders.find({
  $or: [
    { status: "cancelled" },
    { total: { $gt: 1000 } }
  ]
});

// =====================
// NIVEAU 3
// =====================

// 9. shipped_at existe
db.orders.find({ shipped_at: { $exists: true } });

// 10. tag promo
db.products.find({ tags: "promo" });

// 11. electronique ET nouveauté
db.products.find({ tags: { $all: ["electronique", "nouveauté"] } });

// 12. SKU-1042 dans items
db.orders.find({ "items.sku": "SKU-1042" });

// 13. elemMatch
db.orders.find({
  items: {
    $elemMatch: {
      sku: "SKU-1042",
      quantity: { $gte: 3 }
    }
  }
});

// =====================
// NIVEAU 4
// =====================

// 14. regex nom
db.products.find({ name: { $regex: /^(Casque|Clavier)/ } });

// 15. email
db.customers.find({ email: /@example\.com$/ });

// 16. projection
db.products.find({}, { name: 1, price: 1, _id: 0 });

// 17. delivered sans items
db.orders.find({ status: "delivered" }, { items: 0 });

// =====================
// NIVEAU 5
// =====================

// 18. top 10 prix
db.products.find({ stock: { $gt: 0 } })
  .sort({ price: -1 })
  .limit(10);

// 19. page 3
db.products.find()
  .sort({ price: 1 })
  .skip(20)
  .limit(10);

// 20. distinct villes
db.customers.distinct("city");

// BONUS
db.orders.countDocuments({
  created_at: {
    $gte: new Date("2026-05-01"),
    $lt: new Date("2026-06-01")
  }
});

// =====================
// UPDATES / DELETE
// =====================

// 4.1 stock -2 si >=2
db.products.updateOne(
  { sku: "SKU-1042", stock: { $gte: 2 } },
  { $inc: { stock: -2 } }
);

// 4.2 discount livres
db.products.updateMany(
  { category: "Livres" },
  { $set: { discount: 0.10 } }
);

// 4.3 add promo
db.products.updateOne(
  { sku: "SKU-1042" },
  { $addToSet: { tags: "promo" } }
);

// remove nouveauté
db.products.updateMany(
  {},
  { $pull: { tags: "nouveauté" } }
);

// 4.4 update quantity
db.orders.updateOne(
  { "items.sku": "SKU-1042" },
  { $set: { "items.$.quantity": 5 } }
);

// 4.5 upsert
db.products.updateOne(
  { sku: "SKU-9999" },
  {
    $set: {
      name: "Cadeau surprise",
      category: "Maison",
      price: 19.99,
      stock: 50
    }
  },
  { upsert: true }
);

// 4.6 soft delete
db.products.updateMany(
  { stock: 0 },
  {
    $set: {
      archived: true,
      archived_at: new Date()
    }
  }
);

// 4.7 delete orders
db.orders.deleteMany({
  status: "cancelled",
  created_at: { $lt: new Date("2026-01-01") }
});

// 4.8 bulkWrite
db.products.bulkWrite([
  {
    insertOne: {
      document: {
        sku: "SKU-9990",
        name: "Produit bulk",
        category: "Test",
        price: 10,
        stock: 5
      }
    }
  },
  {
    updateOne: {
      filter: { sku: "SKU-1043" },
      update: { $set: { stock: 0 } }
    }
  },
  {
    deleteOne: {
      filter: { sku: "SKU-9991" }
    }
  }
], { ordered: false });
