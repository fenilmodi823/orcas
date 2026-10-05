# Ephemeris sources

`planets-de421.bin` is baked from JPL's planetary ephemeris DE421 (`data/ephemeris/de421.bsp`,
not committed) by `scripts/data/bake_planets.py`, with the numpy-only reader in
`scripts/data/de421_reference.py`. Rerun the script to rebuild it; its docstring gives the
binary layout. Baked 2026-10-05.

| | |
| --- | --- |
| Bodies | The Sun, Mercury, Venus, the Earth and Mars as bodies; Jupiter, Saturn, Uranus and Neptune as **system barycentres** (planet plus moons), because DE421 has no planet-centre segment for them |
| Frame and units | ICRF, relative to the Solar System barycentre; km and km/s |
| Span | DE421's own, read from its segment headers: 1899-07-29 to 2053-10-09 (TDB) |
| Steps | Mercury 1 day; Venus and the Earth 4 days; Mars 8 days; the Sun and the outer planets 32 days |
| Interpolation | Cubic Hermite on position and velocity, the satellites' method (M1.1) |
| Storage | float32 |

**What the positions are worth.** Interpolation error, as seen from the Earth, is at most
0.24″ (Venus, at the worst interval midpoint, measured by the bake). With float32 storage, the
worst at the five test epochs is 0.044″. The time scale costs more than either: the client takes
TDB = UTC + 69.184 s, which is exact since 2017 and about 72 s off in 1900 (TT − UT was then
about −2.7 s). Measured over 1899–1902 for a 72 s error, that moves Mercury up to 6.6″ as seen
from the Earth, the Sun 3.1″, Venus 3.8″, Mars 2.4″ and the outer planets under 1″. All of this
is far inside the Solar regime's 1 arcminute budget (`Cosmic-Scales-Brief` §3.4).

**Credit.** On `/` the credit line names the source (S4): "Sun and planets: JPL DE421, interpolated to within 1″;
Jupiter to Neptune at their system barycentres." The `/points` debug route does not yet.
