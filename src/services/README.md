# Services

Add shared infrastructure adapters here, including the HTTP client, local database connection, transaction manager, backup provider and synchronization client.

Keep feature-specific application services and API calls inside each feature folder. Implement the repository contracts in `src/domain/repositories.ts` with SQLite or a remote API adapter instead of importing infrastructure directly into React components.
