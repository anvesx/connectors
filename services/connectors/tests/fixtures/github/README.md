# github fixtures

Replies for the GitHub REST v3 endpoints of the `acme/handbook` private repository that the adapter reads when it lists
and fetches documents.

- `repo.json` repository record: `full_name`, `private: true`, `default_branch: main`, `pushed_at` and `updated_at`
- `tree.json` recursive git tree of the default branch: blobs (`README.md`, `docs/guide.md`, a binary `docs/video.bin`) and a `docs` tree entry
- `content.json` one base64 encoded file (`docs/guide.md`) as returned by the contents endpoint

Collaborators and teams live in `../github-members/`; branch and compare replies live in `../github-changes/`.
