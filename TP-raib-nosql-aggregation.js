use shop;

// EXO 1
db.orders.aggregate([
  { $match: { status: { $in: ["paid", "shipped", "delivered"] } } },
  { $unwind: "$items" },
  { $lookup: { from: "products", localField: "items.sku", foreignField: "sku", as: "product" } },
  { $unwind: "$product" },
  { $addFields: { line_total: { $multiply: ["$items.quantity", "$items.price_at_purchase"] } } },
  {
    $group: {
      _id: "$product.category",
      ca: { $sum: "$line_total" },
      units_sold: { $sum: "$items.quantity" },
      orders_count: { $sum: 1 }
    }
  },
  { $project: { _id: 0, category: "$_id", ca: 1, units_sold: 1, orders_count: 1 } },
  { $sort: { ca: -1 } }
]);

// EXO 2
db.orders.aggregate([
  { $match: { status: { $in: ["paid", "shipped", "delivered"] } } },
  {
    $group: {
      _id: "$customer_id",
      total_spent: { $sum: "$total" },
      orders_count: { $sum: 1 }
    }
  },
  { $sort: { total_spent: -1 } },
  { $limit: 5 },
  { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "c" } },
  { $unwind: "$c" },
  {
    $project: {
      _id: 0,
      customer_id: "$_id",
      customer_email: "$c.email",
      total_spent: 1,
      orders_count: 1
    }
  }
]);

// EXO 3
db.reviews.aggregate([
  {
    $bucket: {
      groupBy: "$rating",
      boundaries: [1, 2, 3, 4, 5, 6],
      output: { count: { $sum: 1 } }
    }
  }
]);

// EXO 4
db.products.aggregate([
  { $lookup: { from: "orders", localField: "sku", foreignField: "items.sku", as: "orders" } },
  { $match: { orders: { $size: 0 } } },
  { $project: { _id: 0, sku: 1, name: 1, category: 1 } }
]);

// EXO 5
db.reviews.aggregate([
  {
    $group: {
      _id: "$product_id",
      avg_rating: { $avg: "$rating" },
      reviews_count: { $sum: 1 }
    }
  },
  { $match: { reviews_count: { $gte: 3 } } },
  { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
  { $unwind: "$p" },
  {
    $project: {
      _id: 0,
      sku: "$p.sku",
      name: "$p.name",
      avg_rating: 1,
      reviews_count: 1
    }
  },
  { $sort: { avg_rating: -1, reviews_count: -1 } }
]);

// EXO 6
db.orders.aggregate([
  { $match: { status: { $in: ["paid", "shipped", "delivered"] } } },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$placed_at" } },
      avg_basket: { $avg: "$total" },
      orders: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]);

// EXO 7
db.orders.aggregate([
  {
    $facet: {
      total: [{ $count: "count" }],
      by_status: [{ $group: { _id: "$status", count: { $sum: 1 } } }]
    }
  },
  { $unwind: "$total" },
  { $unwind: "$by_status" },
  {
    $project: {
      status: "$by_status._id",
      count: "$by_status.count",
      percent: {
        $round: [
          { $multiply: [{ $divide: ["$by_status.count", "$total.count"] }, 100] },
          1
        ]
      }
    }
  }
]);

// EXO 8
db.products.aggregate([
  { $match: { stock: { $gt: 0 } } },
  { $sort: { price: -1 } },
  {
    $group: {
      _id: "$category",
      products: { $push: { name: "$name", price: "$price" } },
      avg_price: { $avg: "$price" }
    }
  },
  { $addFields: { top3: { $slice: ["$products", 3] } } },
  { $project: { _id: 0, category: "$_id", top3: 1, avg_price: 1 } }
]);



// TP3 — Étape 2 : indexes & performance (5 exercices)
// Base "shop"

use("shop");

// =========================================================
// 9. Baseline — find sur sku SANS index
// =========================================================
print("\n=== 9. Baseline find sku SANS index ===");

db.products.dropIndexes();

const before = db.products.find({ sku: "SKU-1042" })
                          .explain("executionStats");

printjson({
  stage:               before.executionStats.executionStages.stage,
  totalDocsExamined:   before.executionStats.totalDocsExamined,
  nReturned:           before.executionStats.nReturned,
  executionTimeMillis: before.executionStats.executionTimeMillis
});

/*
RÉPONSE :
- stage = COLLSCAN → MongoDB parcourt toute la collection
- totalDocsExamined ≈ nombre total de documents
- nReturned = 1

CONCLUSION :
Sans index → scan complet → inefficace (scalable mauvais)
*/


// =========================================================
// 10. Création de l'index unique sur sku + re-mesure
// =========================================================
print("\n=== 10. Avec index sur sku ===");

db.products.createIndex({ sku: 1 }, { unique: true });

const after = db.products.find({ sku: "SKU-1042" })
                         .explain("executionStats");

printjson({
  stage:               after.executionStats.executionStages.stage,
  inputStage:          after.executionStats.executionStages.inputStage?.stage,
  indexName:           after.queryPlanner.winningPlan.inputStage?.indexName,
  totalDocsExamined:   after.executionStats.totalDocsExamined,
  nReturned:           after.executionStats.nReturned,
  executionTimeMillis: after.executionStats.executionTimeMillis
});

/*
RÉPONSE :
- inputStage = IXSCAN → utilisation de l’index
- totalDocsExamined = 1

CONCLUSION :
Accès direct grâce à l’index → performance optimale
*/


// =========================================================
// 11. Index composé — règle ESR
// =========================================================
print("\n=== 11. Index composé ESR ===");

const topCustomer = db.orders.aggregate([
  { $group: { _id: "$customer_id", n: { $sum: 1 } } },
  { $sort: { n: -1 } },
  { $limit: 1 }
]).toArray()[0];

print(`Customer choisi : ${topCustomer._id} (${topCustomer.n} commandes)`);

const queryFilter = {
  customer_id: topCustomer._id,
  placed_at: { $gte: ISODate("2026-01-01T00:00:00Z") }
};

const querySort = { placed_at: -1 };

db.orders.dropIndexes();

const noIdx = db.orders.find(queryFilter).sort(querySort)
                        .explain("executionStats");

print("\n→ SANS index :");
printjson({
  stage:               noIdx.executionStats.executionStages.stage,
  totalDocsExamined:   noIdx.executionStats.totalDocsExamined,
  nReturned:           noIdx.executionStats.nReturned
});

/*
RÉPONSE :
- COLLSCAN → scan complet
- tri en mémoire

CONCLUSION :
Très coûteux sans index
*/


// Index optimal
db.orders.createIndex({ customer_id: 1, placed_at: -1 },
                      { name: "idx_customer_date" });

const withIdx = db.orders.find(queryFilter).sort(querySort)
                          .explain("executionStats");

print("\n→ AVEC index ESR optimal :");
printjson({
  indexName:           withIdx.queryPlanner.winningPlan.inputStage?.indexName,
  totalDocsExamined:   withIdx.executionStats.totalDocsExamined,
  nReturned:           withIdx.executionStats.nReturned
});

/*
RÉPONSE :
- index utilisé : idx_customer_date
- filtre + tri couverts par index

CONCLUSION :
Respect règle ESR :
E = customer_id (égalité)
S = placed_at (tri)
R = placed_at (range)
*/


// Index inversé
db.orders.dropIndex("idx_customer_date");

db.orders.createIndex({ placed_at: -1, customer_id: 1 },
                      { name: "idx_date_customer" });

const inverted = db.orders.find(queryFilter).sort(querySort)
                           .explain("executionStats");

print("\n→ AVEC index ordre inversé :");
printjson({
  indexName:           inverted.queryPlanner.winningPlan.inputStage?.indexName,
  totalDocsExamined:   inverted.executionStats.totalDocsExamined
});

/*
RÉPONSE :
- index moins efficace
- MongoDB filtre après lecture

CONCLUSION :
Ordre des champs critique → mauvais ordre = perte de performance
*/


// Remise index optimal
db.orders.dropIndex("idx_date_customer");
db.orders.createIndex({ customer_id: 1, placed_at: -1 },
                      { name: "idx_customer_date" });


// =========================================================
// 12. Index multikey sur tags
// =========================================================
print("\n=== 12. Index multikey sur tags ===");

db.products.createIndex({ tags: 1 });

const tagsExplain = db.products.find({ tags: "promo" })
                               .explain("executionStats");

printjson({
  isMultiKey:          tagsExplain.queryPlanner.winningPlan.inputStage?.isMultiKey,
  indexName:           tagsExplain.queryPlanner.winningPlan.inputStage?.indexName,
  totalDocsExamined:   tagsExplain.executionStats.totalDocsExamined,
  nReturned:           tagsExplain.executionStats.nReturned
});

/*
RÉPONSE :
- isMultiKey = true → champ tableau
- index utilisé

CONCLUSION :
MongoDB indexe chaque élément du tableau
*/


// =========================================================
// 13. $lookup avec index
// =========================================================
print("\n=== 13. Aggregation avec $lookup indexé ===");

const lookupExplain = db.orders.explain("executionStats").aggregate([
  { $match: { status: "paid" } },
  { $unwind: "$items" },
  { $lookup: {
      from: "products",
      localField: "items.sku",
      foreignField: "sku",
      as: "p"
  }},
  { $unwind: "$p" }
]);

print("Stages du pipeline :");
const stages = lookupExplain.stages ?? [];
stages.forEach((s, i) => print(`  [${i}] ${Object.keys(s).join(", ")}`));

/*
RÉPONSE :
- grâce à l’index sur products.sku :
  → lookup utilise IXSCAN

- sans index :
  → COLLSCAN pour chaque jointure

CONCLUSION :
Index sur champ de jointure = gain énorme
*/


// =========================================================
// RÉCAP FINAL
// =========================================================
print("\n=== RÉCAP ===");

print(`
✔ COLLSCAN = mauvais (scan complet)
✔ IXSCAN = bon (index utilisé)
✔ Index unique → accès direct
✔ Index composé → respecter ESR
✔ Ordre des champs important
✔ Multikey → pour tableaux
✔ Lookup + index → très performant
`);




