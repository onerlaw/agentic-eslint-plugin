# Test fixtures

`app/` is a miniature workspace package used by the `workspace-runtime-imports`
tests. The rule walks up from the linted file to the nearest `package.json`, so
these tests need a real manifest on disk rather than a synthetic filename.

It declares `@acme/config` and `@acme/contract` but deliberately NOT
`@acme/database` — the undeclared-runtime-import shape the rule exists to catch.
