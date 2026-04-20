import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore root-level diagnostic and scratch files
    "diag_*.ts",
    "scratch_*.ts",
    "verify_*.ts",
    "find_*.ts",
    "check_*.ts",
    "test_*.ts",
    "final_*.ts",
    "*.js",
    "scratch/*.js",
    "scratch/*.ts",
  ]),
]);

export default eslintConfig;
