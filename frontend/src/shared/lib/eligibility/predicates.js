// Re-exports the shared eligibility/pattern logic (single source: server/shared,
// resolved via the @shared Vite alias) so the frontend and server compute
// eligibility identically.
export * from '@shared/eligibility/predicates'
