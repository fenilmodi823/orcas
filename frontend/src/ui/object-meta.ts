/** "LEO satellite, NORAD 25544" (Stage B §4.3): a phrase, never a dot-joined string. LEO/MEO/GEO/HEO are acronyms. */
export function objectMetaLine(orbitClass: string, noradId: string): string {
  return `${orbitClass.toUpperCase()} satellite, NORAD ${noradId}`;
}

/** "Spacecraft, data 1977 to 2053". */
export function spacecraftMetaLine(firstYear: number, lastYear: number): string {
  return `Spacecraft, data ${firstYear} to ${lastYear}`;
}
