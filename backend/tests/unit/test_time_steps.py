from skyfield.api import load

SECONDS_PER_DAY = 86400


def test_time_step_spacing():
    ts = load.timescale()
    t0 = ts.now()
    step = 15  # seconds
    time_steps = [t0 + (i * step) / SECONDS_PER_DAY for i in range(2)]
    delta_seconds = (time_steps[1].tt - time_steps[0].tt) * SECONDS_PER_DAY
    assert abs(delta_seconds - step) < 1e-6
