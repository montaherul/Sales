# AGENTS.md

# Generic Software Development Rules

This document defines the default engineering rules for AI agents working on this project.

The agent MUST follow these rules when creating, modifying, refactoring, reviewing, or debugging code.

---

# 1. Core Objective

The agent must prioritize:

1. Correctness
2. Maintainability
3. Security
4. Simplicity
5. Reusability
6. Testability
7. Performance where it materially matters
8. Consistency with the existing project

Do not optimize for the number of classes, patterns, abstractions, or technologies used.

The goal is a clean solution, not maximum architecture.

---

# 2. Understand Before Changing

Before modifying code, the agent MUST:

1. Inspect the existing project structure.
2. Identify the application's architecture.
3. Identify existing conventions and patterns.
4. Locate reusable services, utilities, components, repositories, or abstractions.
5. Understand the data flow for the affected feature.
6. Check related implementations before creating new ones.
7. Preserve existing behavior unless a change is explicitly requested.

Do not redesign the project simply because another architecture is preferred.

---

# 3. Architecture Preservation

The agent MUST preserve the project's existing architecture unless the developer explicitly requests an architectural change.

Do NOT automatically introduce:

```text
CQRS
MediatR
Microservices
Event Sourcing
Repository Pattern
Unit of Work
Specification Pattern
Domain Events
Factories
Managers
Wrappers
Additional layers
Additional projects
Additional abstractions
```

unless there is a real requirement.

If the project already uses a pattern, follow the existing implementation consistently.

---

# 4. Separation of Responsibilities

Every major component must have a clear responsibility.

Use this general rule:

```text
UI / API
    ↓
Application / Service
    ↓
Domain / Business Logic
    ↓
Data Access
    ↓
Database / External System
```

The exact names may differ between projects.

The agent must determine responsibility based on the project's architecture rather than blindly applying these names.

---

# 5. Presentation / API Layer

Controllers, API endpoints, route handlers, pages, or UI components should remain focused.

They may:

- Receive requests.
- Validate request structure.
- Perform model binding.
- Call application services.
- Return responses.
- Handle presentation-specific concerns.

They MUST NOT normally:

- Contain complex business logic.
- Execute raw SQL.
- Directly manage database connections.
- Implement large workflows.
- Contain duplicated business rules.
- Perform unrelated data-access operations.

Bad:

```text
Controller
    → SQL
    → business validation
    → transaction
    → mapping
    → response
```

Prefer:

```text
Controller
    → Application Service
    → Data Access
```

---

# 6. Application / Service Layer

The application/service layer should coordinate application workflows and business use cases.

It may contain:

- Business rules.
- Application workflows.
- Validation that depends on business rules.
- Authorization decisions where appropriate.
- Entity/ViewModel/DTO mapping.
- Coordination of multiple data operations.
- Transaction orchestration when required.

It MUST NOT contain low-level database implementation when a data-access abstraction already exists.

Avoid turning one service into a "God Service".

Prefer focused responsibilities.

---

# 7. Domain / Business Logic

Business rules should have a clear home.

When the project uses domain entities:

- Keep entities independent of UI and infrastructure.
- Put domain rules close to the domain when appropriate.
- Do not put HTTP concerns into domain models.
- Do not put database connection logic into domain models.

When the project uses a service-oriented design, business rules may live in application services.

Follow the existing project architecture.

---

# 8. Data Access

Database access must remain in the project's established data-access layer.

Examples include:

```text
Repository
Data Access Service
Query Handler
DbContext
DAO
Gateway
ORM Layer
```

The exact implementation depends on the project.

Data-access code should be responsible for:

- Querying data.
- Persisting data.
- Calling stored procedures where applicable.
- Mapping database results.
- Managing database-specific concerns.

It should NOT contain unrelated business rules.

---

# 9. Database Rules

Use the project's established database technology and conventions.

Prefer:

- Parameterized queries.
- ORM features where appropriate.
- Transactions for multi-step atomic operations.
- Server-side filtering for large datasets.
- Server-side pagination for large datasets.
- Proper indexes where justified.
- Explicit database constraints for important invariants.

Never concatenate untrusted user input into SQL.

Bad:

```csharp
$"SELECT * FROM Users WHERE Name = '{name}'"
```

Prefer parameterized execution.

Do not move business logic into SQL unless the project intentionally uses database-side business logic.

---

# 10. Generic vs Specific Components

Before creating a new class, ask:

```text
Can an existing reusable component handle this?
```

Prefer generic infrastructure for genuinely generic behavior.

However, do NOT force unrelated business workflows into generic abstractions.

Good:

```text
Generic CRUD
    → Generic Repository / Service
```

Good:

```text
Complex business workflow
    → Dedicated Service
```

Avoid:

```text
One Entity
    → Repository
    → Service
    → Manager
    → Factory
    → Helper
    → Wrapper
```

when the extra layers provide no real value.

---

# 11. No Duplicate Abstractions

Before creating a:

```text
Interface
Service
Repository
Helper
Manager
Factory
Wrapper
Base Class
Utility
```

the agent MUST search for an existing implementation that can be reused or extended.

Do not create two abstractions that solve essentially the same problem.

Prefer:

```text
Reuse > Extend > Refactor > Create New
```

when appropriate.

---

# 12. SOLID Principles

The project should follow SOLID pragmatically.

## SRP — Single Responsibility

Each class should have one clear responsibility.

Ask:

```text
What is this class responsible for?
```

If the answer contains several unrelated responsibilities, consider splitting it.

## OCP — Open/Closed

Prefer reusable abstractions and extension points where they provide real value.

Do not modify generic infrastructure for every new entity when it can already support the requirement.

## LSP — Liskov Substitution

Implementations must honor their interfaces and base-class contracts.

Do not create implementations that unexpectedly change behavior.

## ISP — Interface Segregation

Keep interfaces focused.

Avoid large interfaces such as:

```text
IApplicationManager
```

containing unrelated operations.

## DIP — Dependency Inversion

High-level application code should depend on abstractions where the project architecture benefits from them.

Prefer dependency injection over manually constructing infrastructure dependencies.

---

# 13. Dependency Injection

Use the project's dependency injection mechanism.

Prefer:

```text
Class
    ↓
Interface
    ↓
DI Container
    ↓
Implementation
```

Avoid manually creating infrastructure dependencies inside application code:

```csharp
new DbContext()
new Repository()
new Service()
```

unless the project specifically requires it.

Do not introduce dependency injection abstractions solely for classes that have no meaningful dependency or testability benefit.

---

# 14. Async Programming

When the platform supports asynchronous I/O, use asynchronous APIs for:

- Database operations.
- HTTP calls.
- File I/O.
- External service calls.

Prefer:

```text
Async
Await
CancellationToken
```

when appropriate.

Avoid:

```csharp
.Result
.Wait()
```

for asynchronous operations.

Do not make CPU-bound code asynchronous merely to appear modern.

---

# 15. Validation

Separate input validation from business validation.

General rule:

```text
Input / Format Validation
    → Request Model / DTO / ViewModel

Business Validation
    → Application / Domain Layer
```

Examples:

```text
Required field
    → Request validation

Email format
    → Request validation

User cannot approve their own request
    → Business validation

User cannot access another tenant
    → Business authorization/business rule
```

Never rely only on client-side validation for security.

---

# 16. Authorization and Security

Security rules must be enforced server-side.

The UI may hide unauthorized actions for better UX, but UI hiding is NOT security.

Always verify authorization at the appropriate backend boundary.

Never trust:

```text
Client-side flags
Hidden fields
JavaScript variables
Request parameters
Browser state
```

for security decisions.

Never expose:

- Passwords.
- Access tokens.
- API secrets.
- Connection strings.
- Private keys.
- Sensitive personal information.

in logs, responses, source control, or client-side code.

---

# 17. Multi-Tenant / Scope Rules

If the project is multi-tenant, organization-based, branch-based, or scope-based:

1. Enforce scope on the server.
2. Apply scope consistently to reads and writes.
3. Never trust a client-supplied tenant/company ID without authorization checks.
4. Prevent cross-tenant data access.
5. Keep scope resolution centralized where possible.

General flow:

```text
Authenticated User
    ↓
Current Scope
    ↓
Authorization
    ↓
Data Query
```

---

# 18. Transactions

Use transactions when multiple operations must succeed or fail together.

Example:

```text
Create Order
    +
Create Order Items
    +
Update Inventory
    +
Create Payment Record
```

should use a transaction when atomicity is required.

Do NOT use transactions for every database operation automatically.

Transactions should be managed at the appropriate application/data boundary, not inside UI controllers.

---

# 19. Error Handling

Never silently swallow exceptions.

Bad:

```csharp
try
{
    ...
}
catch
{
}
```

Handle errors meaningfully.

Rules:

- Catch exceptions only when you can handle or enrich them.
- Log unexpected failures.
- Return appropriate application responses.
- Do not expose internal exception details to users.
- Avoid duplicated try/catch blocks when centralized error handling exists.

Prefer centralized exception handling for global failures.

---

# 20. Logging

Use the project's configured logging system.

Do not use permanent:

```csharp
Console.WriteLine(...)
```

as application logging when a logging framework exists.

Do not log:

```text
Passwords
Tokens
API Keys
Connection Strings
Private Keys
Sensitive Personal Data
```

Logs should provide enough context to diagnose failures without exposing secrets.

---

# 21. Configuration

Never hardcode environment-specific values.

Avoid hardcoding:

```text
Connection Strings
API Keys
Passwords
Tokens
URLs
Environment-specific settings
```

Use the project's configuration system and environment variables/secrets management.

Keep development, staging, and production configuration separated appropriately.

---

# 22. API / DTO / ViewModel Rules

Do not expose internal database entities directly when the application benefits from a dedicated contract.

Prefer:

```text
Entity
    ↓
DTO / ViewModel
    ↓
API / UI
```

Use separate models when:

- The UI needs different fields.
- Sensitive fields must be hidden.
- Input and output structures differ.
- Database structure should remain internal.
- Validation differs from persistence.

Do not create DTOs mechanically when direct models are already appropriate and safe.

---

# 23. Mapping

Mapping should have a consistent location.

Do not duplicate the same mapping logic across multiple controllers or services.

Prefer:

```text
Central Mapper
```

or:

```text
Application Service
```

or the project's established mapping mechanism.

Follow the existing convention.

---

# 24. Frontend Rules

Frontend code must remain separated from backend concerns.

Frontend responsibilities include:

- UI behavior.
- Client-side validation.
- AJAX/fetch calls.
- Rendering.
- User interaction.

Frontend MUST NOT contain secrets or security decisions.

For large datasets, prefer server-side:

```text
Pagination
Filtering
Sorting
Searching
```

instead of loading unnecessary records into the browser.

---

# 25. API Response Consistency

Follow the project's existing response format.

If the project uses a standard response structure, reuse it.

Do not introduce a new response format for one endpoint without a strong reason.

Maintain consistency for:

```text
Success
Validation Errors
Authorization Errors
Not Found
Server Errors
Pagination
```

---

# 26. Naming Conventions

Follow the language and framework's standard naming conventions.

Names must be:

- Clear.
- Consistent.
- Meaningful.
- Domain-appropriate.

Avoid meaningless names:

```text
Manager
Helper
Processor
Handler
Util
Data
Thing
Temp
```

unless the name accurately describes the responsibility.

Async methods should use the established `Async` naming convention where applicable.

---

# 27. Code Quality

When modifying code:

1. Keep methods focused.
2. Keep classes focused.
3. Reuse existing abstractions.
4. Avoid duplication.
5. Prefer readable code.
6. Avoid clever code when simple code is clearer.
7. Preserve existing conventions.
8. Remove dead code only when safe.
9. Keep changes localized.
10. Do not introduce unrelated refactoring.

---

# 28. Refactoring Rules

Do not refactor unrelated code while implementing a feature.

Prefer:

```text
Small
Focused
Reviewable
Low-risk
```

changes.

If a refactor is necessary to safely implement the requested feature:

1. Explain why.
2. Keep the refactor minimal.
3. Preserve behavior.
4. Verify affected functionality.

---

# 29. Testing

Before completing a change, determine the appropriate tests.

Depending on the project, consider:

```text
Unit Tests
Integration Tests
API Tests
Database Tests
UI Tests
End-to-End Tests
```

At minimum, verify:

- The changed feature works.
- Existing related behavior still works.
- Validation works.
- Error paths are handled.
- Authorization is enforced where relevant.

Do not claim tests passed unless they were actually run.

---

# 30. Build and Verification

After meaningful code changes, verify the project using the appropriate tools.

Examples:

```text
Build
Compile
Lint
Format
Unit Tests
Integration Tests
Migration Validation
Type Checking
```

If a check cannot be run, clearly state that it was not run.

Never fabricate successful test/build results.

---

# 31. Database Migration Rules

When the project uses migrations:

1. Inspect the current model and migration state.
2. Avoid destructive changes unless explicitly requested.
3. Review generated migrations.
4. Verify foreign keys and indexes.
5. Consider existing production data.
6. Never assume a migration is safe merely because it compiles.

Do not delete or recreate databases as a shortcut unless explicitly authorized.

---

# 32. External Services

When integrating external APIs/services:

- Keep credentials outside source code.
- Use timeouts.
- Handle transient failures appropriately.
- Validate external responses.
- Avoid leaking external errors directly to users.
- Follow the project's existing integration abstraction.

Do not create a new HTTP client abstraction if the project already has one.

---

# 33. Performance

Do not optimize prematurely.

First ensure correctness and clarity.

When performance is actually relevant:

- Avoid N+1 database queries.
- Avoid unnecessary database round trips.
- Use pagination for large datasets.
- Select only required fields.
- Use appropriate indexes.
- Avoid loading large datasets into memory.
- Use caching only when justified.
- Measure before and after optimization when possible.

Prefer evidence-based optimization.

---

# 34. Security Review Before Completion

For security-sensitive changes, verify:

```text
[ ] Authentication is correct
[ ] Authorization is enforced server-side
[ ] Input is validated
[ ] SQL is parameterized
[ ] Secrets are not exposed
[ ] Sensitive data is not logged
[ ] Tenant/scope isolation is enforced
[ ] Error messages do not leak internals
[ ] File uploads are validated if applicable
[ ] External requests are protected against abuse
```

---

# 35. New Feature Workflow

When implementing a new feature:

```text
1. Understand the requirement
2. Inspect existing architecture
3. Find reusable components
4. Identify affected layers
5. Design the smallest appropriate change
6. Implement using existing conventions
7. Add or update tests
8. Build/compile
9. Run relevant tests
10. Review security and authorization
11. Review duplication
12. Report what changed and what was verified
```

---

# 36. New Module Workflow

When adding a new module:

```text
1. Define the domain/data model
2. Define input/output contracts
3. Determine whether generic infrastructure is sufficient
4. Reuse existing services/repositories/components
5. Add dedicated business logic only when required
6. Add data-access logic only where required
7. Add API/controller/UI layer
8. Add validation
9. Add authorization
10. Add tests
11. Verify integration
```

Do NOT automatically create:

```text
NewRepository
NewService
NewManager
NewHelper
NewFactory
NewHandler
```

for every module.

Create them only when they provide meaningful responsibility.

---

# 37. AI Agent Behavior

The AI agent MUST:

- Read before editing.
- Search before creating.
- Reuse before duplicating.
- Follow existing conventions.
- Make minimal changes.
- Explain architectural decisions when relevant.
- Preserve unrelated functionality.
- Verify changes when possible.
- Ask for clarification when requirements are genuinely ambiguous.

The AI agent MUST NOT:

- Invent project structure.
- Invent APIs.
- Invent database tables.
- Invent existing methods.
- Claim tests passed when they were not run.
- Rewrite large portions of the project unnecessarily.
- Introduce architecture without justification.
- Remove working functionality without approval.

---

# 38. When Requirements Are Ambiguous

If ambiguity materially affects implementation:

```text
Ask a clarification question.
```

If the ambiguity is minor and a safe convention exists:

```text
Use the existing project convention.
```

Do not make major architectural decisions silently.

---

# 39. Decision Rules

When deciding where code belongs, ask:

```text
Is it UI/HTTP?
    → Presentation/API layer

Is it an application workflow?
    → Application/Service layer

Is it a business rule?
    → Domain/Application layer according to project architecture

Is it database access?
    → Data-access/Infrastructure layer

Is it an external integration?
    → Integration/Infrastructure layer

Is it a reusable contract?
    → Interface/Contract layer

Is it configuration?
    → Configuration system

Is it generic behavior?
    → Existing generic abstraction, if one exists

Is it unique business behavior?
    → Focused specific component
```

---

# 40. Architecture Decision Priority

When multiple solutions are possible, prefer them in this order:

```text
1. Existing project convention
2. Existing reusable component
3. Simple implementation
4. Focused abstraction
5. New architectural pattern only when justified
```

Do not choose a more complicated solution simply because it is theoretically more scalable.

---

# 41. Final Review Checklist

Before completing a change:

### Architecture

- [ ] Existing architecture was preserved.
- [ ] Correct layer owns the new code.
- [ ] No unnecessary project/layer was introduced.
- [ ] No circular dependency was introduced.

### Code Quality

- [ ] Existing abstractions were reused.
- [ ] No unnecessary duplicate class/interface was created.
- [ ] Classes have focused responsibilities.
- [ ] Methods are reasonably focused.
- [ ] Naming follows project conventions.

### Data

- [ ] Database access is in the correct layer.
- [ ] Queries are parameterized.
- [ ] Large data operations use appropriate pagination/filtering.
- [ ] Transactions are used only when necessary.

### Security

- [ ] Authorization is enforced server-side.
- [ ] Sensitive data is protected.
- [ ] Secrets are not hardcoded.
- [ ] Sensitive information is not logged.
- [ ] Tenant/scope boundaries are respected where applicable.

### Reliability

- [ ] Exceptions are not silently swallowed.
- [ ] Relevant error paths are handled.
- [ ] Async operations are used appropriately.
- [ ] External failures are handled where relevant.

### Testing

- [ ] Relevant tests were added or updated.
- [ ] Build/compile was verified.
- [ ] Relevant tests were run.
- [ ] No unverified claims were made.

### Scope

- [ ] No unrelated files were changed unnecessarily.
- [ ] No unrelated refactoring was introduced.
- [ ] Existing behavior was preserved where possible.

---

# 42. Golden Rules

These rules have the highest priority:

1. **Understand the existing project before changing it.**
2. **Preserve the existing architecture unless explicitly asked to change it.**
3. **Keep each layer responsible for its own concern.**
4. **Keep controllers/endpoints thin.**
5. **Keep business logic out of data-access classes.**
6. **Keep database logic out of presentation classes.**
7. **Reuse existing abstractions before creating new ones.**
8. **Do not create duplicate repositories/services/helpers.**
9. **Use SOLID pragmatically, not dogmatically.**
10. **Do not over-engineer.**
11. **Enforce security on the server.**
12. **Never hardcode secrets.**
13. **Never fabricate test/build results.**
14. **Make small, focused, reviewable changes.**
15. **Follow the project's existing naming and implementation conventions.**
16. **Ask before making a major architectural decision when requirements are unclear.**
17. **Prefer simple, maintainable, testable solutions.**

---

# END OF AGENTS.md
