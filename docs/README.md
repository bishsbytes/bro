# Documentation

Each maintained document has one job. Keeping implementation history separate
from current guidance prevents old route names, migration numbers, and delivery
assumptions from looking like present-day contracts.

| Concern | Authority |
| --- | --- |
| Product behaviour and domain language | [Product](product.md) |
| Package boundaries, dependencies, storage, and request boundaries | [Architecture](architecture.md) |
| Local setup, commands, code conventions, and verification | [Development](development.md) |
| Work that has not shipped | [Roadmap](roadmap.md) |
| Visual design | [`design/DESIGN.md`](../design/DESIGN.md) |
| Expo/React Native design mapping | [`design/REACT_NATIVE.md`](../design/REACT_NATIVE.md) |
| Shared app component rules | [`apps/app/src/components/README.md`](../apps/app/src/components/README.md) |
| On-device repository recipe | [`packages/database/app/src/repositories/README.md`](../packages/database/app/src/repositories/README.md) |
| Completed and superseded plans | [Archive](archive/README.md) |

## Authority order

1. Source code and tests describe what the system does.
2. `DESIGN.md` and `REACT_NATIVE.md` govern UI work.
3. Maintained docs describe the current system and intended future work.
4. Archived plans explain historical decisions only.
5. `openwiki/` is generated evidence and may lag the source between refreshes.

Update the document that owns a concern rather than copying the same explanation
into several places. A delivery plan should move to the archive when its work
lands or is superseded; any surviving future work belongs in `roadmap.md`.
