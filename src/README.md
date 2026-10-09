# Frontend structure

- `app/`: application-wide routing and providers.
- `features/`: one folder per POS tab. Each feature owns its page, local mock data, and later its API/service files.
- `shared/layout/`: reusable application shell and navigation.
- `shared/ui/`: reusable visual primitives and product renderers.
- `services/`: shared HTTP client and cross-feature integrations for the backend phase.
- `domain/`: framework-independent entities, money/quantity conventions and repository contracts.
- `types/`: domain types shared by multiple features.
- `styles/`: ordered global, feature, responsive, theme, and override styles.

When backend work starts, keep requests close to their feature (for example `features/products/products.api.ts`) and put only common HTTP configuration in `services/`.

Architecture decisions, module gaps and the implementation sequence are documented in `../docs/architecture`.
