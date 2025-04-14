## Run the initial sync

1. Start server

```bash
pnpm remix:dev
```

2. Run initial sync

```bash
curl -X POST "http://localhost:5173/api/initial-sync?username=zachxbt" -H "Content-Type: application/json" -H "Authorization: Bearer $CRON_SECRET"
```
