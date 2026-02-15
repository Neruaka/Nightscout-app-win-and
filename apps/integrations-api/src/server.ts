import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { requireIngestToken, requireReadToken } from "./auth";
import { loadConfig } from "./config";
import { connectDatabase } from "./db";
import { normalizeMealForApi, parseIngestPayload, parseMealsQuery } from "./validation";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const database = await connectDatabase(config.mongoUri, config.dbName);

  const app = express();
  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((x) => x.trim())
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "integrations-api", at: new Date().toISOString() });
  });

  app.post(
    "/ingest/health-connect",
    requireIngestToken(config.ingestToken),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payload = parseIngestPayload(req.body);
        const now = new Date();

        await database.summary.updateOne(
          { _id: "latest" },
          {
            $set: {
              stepsLast24h: payload.summary.stepsLast24h,
              weightKgLatest: payload.summary.weightKgLatest,
              weightUpdatedAt: payload.summary.weightUpdatedAt,
              syncedAt: payload.syncedAt,
              source: "health-connect",
              deviceId: payload.deviceId,
              updatedAt: now
            }
          },
          { upsert: true }
        );

        if (payload.meals.length > 0) {
          await database.meals.bulkWrite(
            payload.meals.map((meal) => ({
              updateOne: {
                filter: { _id: `${payload.deviceId}:${meal.id}` },
                update: {
                  $set: {
                    deviceId: payload.deviceId,
                    mealId: meal.id,
                    name: meal.name,
                    carbsGrams: meal.carbsGrams,
                    calories: meal.calories,
                    eatenAt: new Date(meal.eatenAt),
                    source: meal.source ?? "health-connect",
                    updatedAt: now
                  },
                  $setOnInsert: {
                    createdAt: now
                  }
                },
                upsert: true
              }
            })),
            { ordered: false }
          );
        }

        await database.syncCursor.updateOne(
          { _id: payload.deviceId },
          {
            $set: {
              syncedAt: new Date(payload.syncedAt),
              updatedAt: now
            }
          },
          { upsert: true }
        );

        res.status(200).json({
          ok: true,
          syncedAt: payload.syncedAt,
          mealsReceived: payload.meals.length
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/v1/summary",
    requireReadToken(config.readToken),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const summary = await database.summary.findOne({ _id: "latest" });

        if (!summary) {
          res.json(null);
          return;
        }

        res.json({
          stepsLast24h: summary.stepsLast24h,
          weightKgLatest: summary.weightKgLatest,
          weightUpdatedAt: summary.weightUpdatedAt,
          syncedAt: summary.syncedAt,
          source: "health-connect"
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/v1/meals",
    requireReadToken(config.readToken),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsedQuery = parseMealsQuery({
          from: typeof req.query.from === "string" ? req.query.from : undefined,
          to: typeof req.query.to === "string" ? req.query.to : undefined,
          limit: typeof req.query.limit === "string" ? req.query.limit : undefined
        });

        const meals = await database.meals
          .find({
            eatenAt: {
              $gte: parsedQuery.from,
              $lte: parsedQuery.to
            }
          })
          .sort({ eatenAt: -1 })
          .limit(parsedQuery.limit)
          .toArray();

        res.json(
          meals.map((meal) =>
            normalizeMealForApi({
              mealId: meal.mealId,
              name: meal.name,
              carbsGrams: meal.carbsGrams,
              eatenAt: meal.eatenAt,
              source: meal.source,
              calories: meal.calories
            })
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = /required|invalid|must|expected/i.test(message) ? 400 : 500;
    res.status(status).json({ status, message });
  });

  const server = app.listen(config.port, () => {
    console.log(`[integrations-api] listening on ${config.port}`);
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`[integrations-api] shutting down (${signal})`);
    server.close();
    await database.client.close();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  console.error("[integrations-api] startup failed", error);
  process.exit(1);
});
