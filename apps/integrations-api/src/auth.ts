import type { Request, Response, NextFunction } from "express";

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export function requireIngestToken(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.header("x-ingest-token");

    if (!token || !constantTimeEquals(token, expectedToken)) {
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    next();
  };
}

function extractBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  return match[1];
}

export function requireReadToken(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const bearer = extractBearerToken(req.header("authorization"));

    if (!bearer || !constantTimeEquals(bearer, expectedToken)) {
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    next();
  };
}
