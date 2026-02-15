import { MongoClient, type Collection, type Db } from "mongodb";
import type { HealthConnectSummary, MealEntry } from "@nightscout/shared-types";

interface HealthSummaryDocument extends HealthConnectSummary {
  _id: "latest";
  deviceId: string;
  updatedAt: Date;
}

interface MealDocument {
  _id: string;
  deviceId: string;
  mealId: string;
  name: string;
  carbsGrams: number;
  calories?: number;
  eatenAt: Date;
  source: MealEntry["source"];
  createdAt: Date;
  updatedAt: Date;
}

interface SyncCursorDocument {
  _id: string;
  syncedAt: Date;
  updatedAt: Date;
}

export interface IntegrationsDatabase {
  client: MongoClient;
  db: Db;
  summary: Collection<HealthSummaryDocument>;
  meals: Collection<MealDocument>;
  syncCursor: Collection<SyncCursorDocument>;
}

export async function connectDatabase(
  mongoUri: string,
  dbName: string
): Promise<IntegrationsDatabase> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  const summary = db.collection<HealthSummaryDocument>("health_summary");
  const meals = db.collection<MealDocument>("meals");
  const syncCursor = db.collection<SyncCursorDocument>("sync_cursor");

  await Promise.all([
    meals.createIndex({ eatenAt: -1 }),
    meals.createIndex({ mealId: 1 }),
    meals.createIndex({ source: 1 }),
    syncCursor.createIndex({ updatedAt: -1 })
  ]);

  return { client, db, summary, meals, syncCursor };
}
