Development Workflow
Golden rule

Build small, testable pieces.

Do not ask the Agent to build an entire domain in one task unless explicitly necessary.

Workflow
1. Read

Read:

AGENTS.md
applicable Cursor rules
relevant docs
roadmap
2. Inspect

Inspect the current implementation.

Search before creating new files.

3. Plan

Identify:

files to create
files to modify
database changes
API changes
tests
4. Implement

Make the smallest safe change.

5. Validate

Run:

tests
type checking
linting

as appropriate.

6. Review

Inspect git diff.

Remove unrelated changes.

7. Document

Update documentation when behavior or architecture changes.

8. Roadmap

Mark roadmap items complete only after validation.

Task sizing

Good:

Create Product entity.


Good:

Implement Product repository.


Good:

Add Product CRUD API.


Bad:

Build the complete e-commerce platform.

Refactoring

Refactoring should be separate from feature work.

Dependencies

Before adding a dependency, check whether an existing dependency solves the problem.

Database

Never edit an applied migration.

Production

Do not make production infrastructure changes as a side effect of application feature development.