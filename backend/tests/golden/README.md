# Golden-file test

`test_2009_reconstruction.py` reconstructs the 2009 Iridium 33 / Cosmos 2251
collision from real Space-Track element sets
(`data/sample/iridium33_cosmos2251_2009_spacetrack.tle`).

Two separate claims, verified separately:

1. **Kinematics** — exact. Real elements, real SGP4, no tuning. Reproduces
   the paper's Table I altitude/latitude/longitude.
2. **Classification** — an honest independent reconstruction, not a
   reproduction of D_M = 1.84 / P_c = 4.2 × 10⁻³. The paper's own covariance
   matrices for this event were hand-picked for the demo — there is no
   second real incident to calibrate a covariance-construction formula
   against — confirmed directly, not assumed. This test uses its own
   explicit, order-of-magnitude-realistic covariance and checks it reaches
   the same CRITICAL classification. See `data/sample/README.md` and
   `ORCAS Vault/00 - Meta/memory.md` issue #18 for the full story.
