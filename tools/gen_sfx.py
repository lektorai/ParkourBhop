#!/usr/bin/env python3
"""Generate the tiny UI sound effects (16-bit mono WAV) used by the game.

Run from the repository root:  python3 tools/gen_sfx.py
"""
import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")


def tone(freq, dur, vol=0.5, attack=0.004, decay=0.6, shape="sine"):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / attack) * math.exp(-t / (dur * decay))
        if shape == "sine":
            v = math.sin(2 * math.pi * freq * t)
        elif shape == "tri":
            v = 2 * abs(2 * ((t * freq) % 1) - 1) - 1
        else:
            v = 1.0 if (t * freq) % 1 < 0.5 else -1.0
        out.append(v * env * vol)
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    out = [0.0] * n
    for p in parts:
        for i, v in enumerate(p):
            out[i] += v
    return out


def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out.extend(p)
        out.extend([0.0] * int(RATE * gap))
    return out


def noise(dur, vol=0.3):
    import random
    rnd = random.Random(7)
    n = int(RATE * dur)
    return [(rnd.random() * 2 - 1) * vol * math.exp(-i / (n * 0.25)) for i in range(n)]


def save(name, samples):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples)
        w.writeframes(frames)
    print("wrote", path, len(samples) / RATE, "s")


save("tap.wav", mix(tone(880, 0.06, 0.35), tone(1320, 0.05, 0.15)))
save("cross.wav", mix(tone(420, 0.05, 0.25, shape="tri"), noise(0.03, 0.08)))
save("click.wav", tone(660, 0.04, 0.3))
save("error.wav", seq(tone(220, 0.12, 0.4, shape="square"), tone(180, 0.16, 0.35, shape="square")))
save("line.wav", seq(tone(784, 0.07, 0.3), tone(1046, 0.1, 0.3)))
save("win.wav", seq(tone(523, 0.12, 0.35), tone(659, 0.12, 0.35), tone(784, 0.12, 0.35), tone(1046, 0.3, 0.4), gap=0.01))
