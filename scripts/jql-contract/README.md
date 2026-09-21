# Public query code-generation inputs

These files are public-safe snapshots of the canonical JQL and SQL contracts in
`JudgmentLabs/judgment-mono`:

- `jql-ir.openapi.json` contains only the public JQL IR schema-reference closure.
- `public-openapi.json` is judgeval-server's public query transport contract, including SQL and schema discovery.
- `builder.ts` and `wire.ts` are the generated public builder sources. Private
  `Dal*` transport aliases are removed from `wire.ts` during synchronization.

`bun run build` regenerates the checked-in files under `src/jql` from these
snapshots. Pull-request CI separately regenerates from `judgment-mono/main` and
fails if the SDK output differs.

After an intentional upstream contract change, refresh the snapshots with:

```sh
bun run generate-query-contracts --sync \
  ../judgment-mono/services/data-access-service/openapi.json \
  ../judgment-mono/packages/dal-client/src/builder.ts \
  ../judgment-mono/services/judgeval-server/openapi.public-jql.json
```
