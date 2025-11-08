import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

export function loadEnv(): void {
  const cwd = process.cwd();
  const envPath = resolve(cwd, ".env");
  const envLocalPath = resolve(cwd, ".env.local");

  if (existsSync(envPath)) {
    config({ path: envPath });
  }

  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true });
  }
}
