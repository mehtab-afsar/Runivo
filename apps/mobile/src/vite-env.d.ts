// Provides ImportMeta.env type for packages/shared files that still use import.meta.env.
// Metro picks .native.ts files over .ts, so these lines never run on mobile —
// but TypeScript still type-checks them. This stub prevents compile errors.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
