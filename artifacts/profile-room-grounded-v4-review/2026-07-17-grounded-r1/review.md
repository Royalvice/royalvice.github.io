# Profile room grounded-v4 visual review

All candidates below were opened with `view_image` at original resolution before selection.

| Asset | Accepted | Rejected | Review |
|---|---|---|---|
| Blackboard | blackboard-b | blackboard-a | Both level; B has the cleanest single continuous tray. |
| Desk | desk-a | desk-b | A has the most readable horizontal front/rear axes and grounded shared baseline. |
| Chair | chair-b | chair-a | B has clearer seat depth and matching walnut highlights. |
| North-facing sofa | sofa-d (TV component removed) | sofa-a, sofa-b, sofa-c | A/B face south; C/D fixed the rear view, D has cleaner proportions. |
| CRT cabinet | tv-cabinet-a | tv-cabinet-b | A has a clearer 4:3 transparent aperture and classic cabinet silhouette. |
| Bulkhead lamp | bulkhead-lamp-a | bulkhead-lamp-b | A has rear plate, hook and cage; B still reads as a floor/table lantern. |

Furniture SHA-256: `522951d925e568b1e6b2b19d8de17bdb3f7dfc85dd1a4e0eb9cf3850c600ce71`
Bulkhead lamps SHA-256: `08d02be16564322a05572b12a7d3b0e52efaad9620571feb8c29277ddd14e5f9`
TV screen rect: `[39, 43, 87, 75]` in the 128x128 cell.

The sofa-d source contained a separate TV above the accepted sofa. The packer crops that disconnected rejected component and keeps the single north-facing sofa instance only.
