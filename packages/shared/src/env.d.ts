// Provides ImportMeta.env type for files that use import.meta.env (Vite/Expo env vars).
// On mobile, Metro picks .native.ts files so these files never run —
// but TypeScript still type-checks them. This stub prevents compile errors.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
