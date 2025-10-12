---
applyTo: '**'
---
---
alwaysApply: true
---

1. Simplicity by Default
 Favor the simplest working solution. Avoid unnecessary abstraction or complexity unless justified by a clear, recurring need. Complexity is treated as a cost, not a feature.
2. Pragmatism Over Perfection
 Prioritize shipping practical, functional solutions quickly. Iterative refinement is preferred over delaying delivery in pursuit of ideal outcomes.
3. Modular and Maintainable Code
 All code must be organized into self-contained modules with single responsibilities. Each module exposes a well-defined public interface and hides internal implementation details. Clear boundaries are maintained to support decoupling, testing, and scalability.
4. Shared Logic via TypeScript
 TypeScript is used consistently across backend and frontend to enable shared types, schemas, and utilities. This reduces duplication, enforces end-to-end type safety, and improves maintainability by ensuring logic is defined once and reused across services.
5. Clarity and Transparency
 Code must be understandable by others without requiring context from the original author. Comments should explain intent (“why”) rather than implementation (“what”). Readability, debuggability, and extensibility are prioritized.
7. we are using bun as our runtime environment and package manager. We don't use npm or yarn. 
8. we are using tailwind css for styling and avoid using any other css framework or library.
