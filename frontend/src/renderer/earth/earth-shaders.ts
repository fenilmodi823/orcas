/**
 * Earth surface and atmosphere shaders (brief §F.1, §F.2, §F.8). Everything
 * is in scene space: J2000, km. `uSunDir` is a unit vector toward the Sun.
 *
 * The colour constants here are physical (sodium-lamp city light, twilight
 * reddening), not UI palette, the same standing StarSky's star colours have.
 */

export const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosW;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const SURFACE_FRAGMENT = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform float uReady;        // 0 until all three maps have loaded
  uniform vec3 uFallback;      // --deep, shown until then (or if they never load)
  uniform vec3 uSunDir;
  uniform float uSunIntensity;
  uniform float uNightGain;

  varying vec2 vUv;
  varying vec3 vPosW;

  void main() {
    // Geocentric normal: within 0.19 deg of the ellipsoid's, invisible in shading.
    vec3 n = normalize(vPosW);
    float ndl = dot(n, uSunDir);

    vec3 albedo = mix(uFallback, texture2D(uDay, vUv).rgb, uReady);
    float cloud = texture2D(uClouds, vUv).r * uReady;
    float lights = texture2D(uNight, vUv).r * uReady;
    vec3 surface = mix(albedo, vec3(0.92), cloud * 0.85);

    // §F.8: an asymmetric band, because scattering lights the ground a little
    // past the geometric terminator. No fill light on the night side (§F.1).
    float day = smoothstep(-0.08, 0.12, ndl);
    float twilight = day * (1.0 - smoothstep(0.0, 0.12, ndl));
    vec3 lit = surface * (max(ndl, 0.0) + vec3(1.0, 0.45, 0.25) * 0.05 * twilight) * uSunIntensity;
    // Night lights sit under the clouds, so cloud cover masks them.
    vec3 night = vec3(1.0, 0.78, 0.52) * lights * (1.0 - day) * (1.0 - cloud * 0.85) * uNightGain;

    gl_FragColor = vec4(lit + night, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vPosW;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * §F.2: single scattering, 8 view samples x 4 light samples, Rayleigh plus a
 * Mie forward lobe. Ray-sphere intersections are analytic, so the shell needs
 * no depth test: it clips itself at the planet and never depends on depth
 * precision, which is poor at planetary range with a metre-scale near plane.
 * The ellipsoid is handled by stretching z by a/b, which makes it a sphere.
 */
export const ATMOSPHERE_FRAGMENT = /* glsl */ `
  #define PI 3.141592653589793
  uniform vec3 uCamPos;
  uniform vec3 uSunDir;
  uniform float uRe;          // equatorial radius, km
  uniform float uRa;          // top of atmosphere, km
  uniform float uPolarStretch; // a / b
  uniform float uSunIntensity;

  varying vec3 vPosW;

  const vec3 BETA_R = vec3(5.8e-3, 13.5e-3, 33.1e-3); // Rayleigh, km^-1 at sea level
  const float BETA_M = 21e-3;                          // Mie, km^-1
  const float H_R = 8.0;                               // scale heights, km
  const float H_M = 1.2;
  const float G = 0.76;

  vec2 raySphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(1e9, -1e9);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  void main() {
    vec3 stretch = vec3(1.0, 1.0, uPolarStretch);
    vec3 ro = uCamPos * stretch;
    vec3 rd = normalize((vPosW - uCamPos) * stretch);
    vec3 sun = normalize(uSunDir * stretch);

    vec2 ta = raySphere(ro, rd, uRa);
    float t0 = max(ta.x, 0.0);
    float t1 = ta.y;
    vec2 te = raySphere(ro, rd, uRe);
    if (te.x > 0.0 && te.x < te.y) t1 = min(t1, te.x);
    if (t1 <= t0) discard;

    float ds = (t1 - t0) / 8.0;
    vec3 sumR = vec3(0.0);
    vec3 sumM = vec3(0.0);
    float depthR = 0.0;
    float depthM = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds);
      float h = length(p) - uRe;
      float dR = exp(-h / H_R) * ds;
      float dM = exp(-h / H_M) * ds;
      depthR += dR;
      depthM += dM;
      vec2 ts = raySphere(p, sun, uRe);
      if (ts.x > 0.0 && ts.x < ts.y) continue; // in Earth's shadow
      float dl = raySphere(p, sun, uRa).y / 4.0;
      float lightR = 0.0;
      float lightM = 0.0;
      for (int j = 0; j < 4; j++) {
        float hq = length(p + sun * ((float(j) + 0.5) * dl)) - uRe;
        lightR += exp(-hq / H_R) * dl;
        lightM += exp(-hq / H_M) * dl;
      }
      vec3 tau = BETA_R * (depthR + lightR) + BETA_M * 1.1 * (depthM + lightM);
      vec3 attenuation = exp(-tau);
      sumR += dR * attenuation;
      sumM += dM * attenuation;
    }

    float mu = dot(rd, sun);
    float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
    float g2 = G * G;
    float phaseM = 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * G * mu, 1.5));
    vec3 colour = uSunIntensity * (sumR * BETA_R * phaseR + sumM * BETA_M * phaseM);

    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
