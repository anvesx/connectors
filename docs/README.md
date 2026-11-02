# Company Brain Connectors

This repository contains the connector ecosystem for Company Brain.

## Structure

- `services/` - One folder per connector adapter
- `tools/` - Development tooling (fake-guard; the strict structure-lint is company-brain/tools/structure-lint)

## Adding a Connector

Tenants can add custom connectors by creating a new package under `services/`.
