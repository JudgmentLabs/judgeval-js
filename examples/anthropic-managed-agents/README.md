# anthropic-managed-agents

Traces a Claude Managed Agents session. The agent loop runs on Anthropic's infrastructure, so
`wrapAnthropicManagedAgents` observes the session event stream your app
already reads and exports one trace per turn.

Set `ANTHROPIC_API_KEY`, `JUDGMENT_API_KEY` and `JUDGMENT_ORG_ID`, then:

```bash
npm install
npm start
```
