interface AppConfig {
  port: number;
  mongoUri: string;
  dbName: string;
  ingestToken: string;
  readToken: string;
  corsOrigin: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return 8081;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("PORT must be a valid TCP port.");
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
    mongoUri: getRequiredEnv("MONGODB_URI"),
    dbName: process.env.DB_NAME?.trim() || "nightscout_integrations",
    ingestToken: getRequiredEnv("INGEST_TOKEN"),
    readToken: getRequiredEnv("READ_TOKEN"),
    corsOrigin: process.env.CORS_ORIGIN?.trim() || "*"
  };
}
