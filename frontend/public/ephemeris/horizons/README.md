# Spacecraft and moons: JPL Horizons

Baked by `scripts/data/bake_horizons.py` (S6a) from one export made by hand through the
[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) web form: 194 requests, exported
2026-10-06 between 19:44 and 20:36 UTC. The raw export stays in `data/horizons/raw/`
(gitignored, like `de421.bsp`). NASA states no licence for Horizons; the data is committed
with attribution (B.17).

| File | What it holds |
| --- | --- |
| `spacecraft.bin` | 25 spacecraft (the B.17 list) |
| `moons-mars.bin` … `moons-neptune.bin` | 19 major moons, plus Jupiter, Saturn, Uranus and Neptune relative to their system barycentres |
| `manifest.json` | Every object (name, designator, Horizons trajectory source, the fit/prediction boundary its data sheet states, with the quote), every series with its error, every request |
| `headers.txt` | Each request's Horizons header and the exact web-form settings, so the export can be repeated by hand |

**Frame and units.** ICRF, km and km/s, each segment relative to its own centre (a NAIF id:
the Solar System barycentre, the Earth, the Moon, a planet or a planet's system barycentre).
Keyframes sit on a TDB grid. The client takes TDB = UTC + 69.184 s, as the planets do: exact
since 2017, about 18 s off in 1980.

**Interpolation.** The Hermite polynomial through four neighbouring states, as NASA's SPK
type 13 does (B.27), or the satellites' two-state cubic where that measured better, across a
burn. The binary layout is in the script's docstring.

## What the positions are worth

The target (B.26) is within 1/10,000 of the distance from the centre: a planet's radius,
for a planet centre's offset from its barycentre.

- **Thinned stretches**, 16,143 of the 17,920 segments: within 1 × 10⁻⁴, measured at every
  sample the bake dropped, with float32 keyframes. Worst 9.997 × 10⁻⁵.
- **Stretches kept at the export step**, 1,777 segments: nothing exported lies between the
  samples, so their error is extrapolated from the error measured at two and four times the
  step. Eleven series are estimated above 1 × 10⁻⁴:

  | Series | Estimated worst |
  | --- | --- |
  | JWST, Earth-centred, hourly: its first stretch, from launch (the 2-minute launch series is drawn for the first two days) | 1.15 × 10⁻³ |
  | Chandrayaan-2 at the Moon, latest year | 5.74 × 10⁻⁴ |
  | Mangalyaan at Mars, 2021–2022 | 3.91 × 10⁻⁴ |
  | Europa Clipper, launch | 3.64 × 10⁻⁴ |
  | LRO at the Moon, arrival (2009) | 2.90 × 10⁻⁴ |
  | Mangalyaan at Mars, arrival (2014) | 2.59 × 10⁻⁴ |
  | BepiColombo at Mercury | 2.11 × 10⁻⁴ |
  | OSIRIS-REx, launch | 1.61 × 10⁻⁴ |
  | Artemis II, Earth-centred | 1.26 × 10⁻⁴ |
  | LRO at the Moon, latest year | 1.24 × 10⁻⁴ |
  | MAVEN at Mars, arrival (2014) | 1.14 × 10⁻⁴ |

- **Jumps in the data**, 95 segments (`jumpsInTheData` in the manifest): no curve fits them,
  because the data itself jumps at a burn or at a joint between Horizons' trajectory files.
  The data sheets name several: Cassini's 2004-07-01 14:00 joint (430 km), SOHO's
  1998-08-19 ballistic filler, LRO's 2026-09-02 switch to prediction. Within one export
  step of a jump, the drawn path is wrong by up to the jump.

The export's own accuracy is a separate matter. Horizons' data sheets say Voyager 1 before
1981 and Voyager 2 before 1989-08-29 follow "a patched conic mission-design type trajectory
… providing a rough accuracy", and that the Pioneer trajectories are "suitable for general
historical purposes". The cross-check below measures what that means.

## Cross-check against an independent product (S6a done-when)

`scripts/data/crosscheck_horizons_pds.py` compares the export with mission-era ephemerides in
NASA's Planetary Data System (PPI node), independent of Horizons' files, at three Saturn
flybys. HelioWeb, the plan's first choice, was unreachable on 2026-10-07. Only frame-free
quantities are compared. The PDS files do not state the Saturn radius they use, so it is
fitted.

| | Voyager 1, 1980 | Voyager 2, 1981 | Pioneer 11, 1979 |
| --- | --- | --- | --- |
| PDS product | SEDR, MAG team (VG_1601), 96 s | SEDR, MAG team (VG_1601), 96 s | Encounter trajectory (PN_6001), 1 min; "not part of an official PDS data set" |
| Saturn radius the file implies | 60,338.0 km | 60,347.4 km | 59,995.6 km |
| Distance from Saturn, median difference (95th percentile), within 20 radii | 160 km (776 km) | 296 km (732 km) | 969 km (1,050 km) |
| Closest approach, ORCAS | 184,030 km | 160,691 km | 80,860 km |
| Closest-approach time, ORCAS − PDS | +42.7 s, or −8.5 s if the PDS times are ET | +47.9 s, or −4.3 s if ET | −60.1 s |
| Heliocentric range, ORCAS − PDS | 43,587 to 46,656 km | 38,859 to 42,032 km | — |
| Earth range from the one-way light time, ORCAS − PDS, within 20 radii | — | — | −1,987 to 1,928 km |

The Voyager files do not say whether their times are UTC or ET, and the two readings differ
by 51–52 s. Pioneer 11's are ET: its ground-received times equal them plus the light time
minus 50.18 s. One Voyager 1 row (1980-11-13T09:36:35) carries a position about 30 minutes
later than its time tag. It is a fault in the PDS file, and the median and 95th percentile
are robust to it.

*Plainly:* close to Saturn, where a flyby is drawn, ORCAS and the missions' own records agree
to a few hundred kilometres and about a minute. Measured from the Sun, the Voyagers' 1980–81
positions sit 38,859 to 46,656 km from the mission record: the "rough accuracy" the data
sheet warns of.
