# tests

Tests live in a `tests/` folder beside the code they cover, under `src/`. This folder holds only the shared `fixtures/`: recorded-shape JSON responses that the replay servers answer with.
Live API tests skip themselves unless their token variables are set (see the package README).
