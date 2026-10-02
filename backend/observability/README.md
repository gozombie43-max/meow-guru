# Service objectives

Initial 30-day availability objective: 99.9% of completed API requests return below 500. Health and scrape traffic are excluded. Aborted requests, ingress failures and a fully unreachable backend need a separate external synthetic probe; HTTP counters alone cannot detect them.

Targets: GET p95 300ms, training answer p95 350ms, training create p95 800ms, Mongo p95 100ms, Redis p95 10ms. Frontend targets remain LCP p75 2.5s, INP p75 200ms and CLS p75 0.10, measured through the existing frontend telemetry. Targets are objectives, not measured results.

Set a dedicated `METRICS_TOKEN` and scrape `/metrics` with its bearer token. Scrape every backend instance under job `meow-backend`; retain instance labels. Import `slo-rules.yml` into Prometheus and `dashboard.json` into Grafana, then configure alert routing. No messages or alerts are sent by local verification. Keep staging and production in separate monitoring tenants or add environment selectors before combining their metrics.

Dashboard queries: `meow:get_latency:p95`, `meow:mongo_latency:p95`, request rates grouped by route, 5xx rates, `meow_process_resident_memory_bytes`, `meow_nodejs_eventloop_lag_p99_seconds`, and `meow_dependency_errors_total`. Use histogram_quantile over dependency buckets for AI/storage. Request labels contain route templates, never user IDs, question IDs or prompts.

Follow the multiwindow burn-rate method from [Google SRE](https://sre.google/workbook/alerting-on-slos/). For low traffic, require synthetic probes and inspect request volume before paging solely on a ratio.

Staging load order is C1 → C5 → C10 → C25 → C50 → C100. Stop at the first latency/error regression. The manually invoked staging workflow verifies the isolated database and `/health` environment before creating temporary learners; cleanup always runs. Keep production probes at their existing small limits. Local fixtures and CI Redis recovery tests do not establish Azure/Atlas capacity.
