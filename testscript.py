"""
Pokémon Emerald (Gen III) Static Encounter Frame Generator
----------------------------------------------------------

Correctly simulates Method 1 frames as defined by
RNG Reporter / PokéFinder.

Each frame:
- Advances the RNG by N calls
- Executes exactly one Method 1 generation
"""

from dataclasses import dataclass
from typing import Dict


# =========================
# RNG IMPLEMENTATION
# =========================

class LCRNG:
    MULTIPLIER = 0x41C64E6D
    INCREMENT = 0x6073

    def __init__(self, seed: int):
        self.seed = seed & 0xFFFFFFFF

    def next(self) -> int:
        self.seed = (self.seed * self.MULTIPLIER + self.INCREMENT) & 0xFFFFFFFF
        return (self.seed >> 16) & 0xFFFF

    def advance(self, steps: int) -> None:
        for _ in range(steps):
            self.next()


# =========================
# DATA STRUCTURES
# =========================

@dataclass
class Trainer:
    name: str
    tid: int
    sid: int


# =========================
# METHOD 1 GENERATION
# =========================

def generate_method1(rng: LCRNG, trainer: Trainer) -> Dict:
    pid_high = rng.next()
    pid_low = rng.next()
    pid = (pid_high << 16) | pid_low

    iv1 = rng.next()
    iv2 = rng.next()

    ivs = {
        "HP": iv1 & 0x1F,
        "Attack": (iv1 >> 5) & 0x1F,
        "Defense": (iv1 >> 10) & 0x1F,
        "Speed": iv2 & 0x1F,
        "Sp. Attack": (iv2 >> 5) & 0x1F,
        "Sp. Defense": (iv2 >> 10) & 0x1F,
    }

    shiny_value = (
        trainer.tid
        ^ trainer.sid
        ^ pid_high
        ^ pid_low
    )

    return {
        "pid": pid,
        "ivs": ivs,
        "nature": pid % 25,
        "ability": pid & 1,
        "shiny": shiny_value < 8,
        "shiny_value": shiny_value,
    }


# =========================
# USER INTERFACE
# =========================

def main() -> None:
    print("Pokémon Emerald Static Encounter Frame Generator")
    print("------------------------------------------------")

    name = input("Trainer name: ").strip()
    tid = int(input("Trainer ID (TID): "))
    sid = int(input("Secret ID (SID): "))
    seed = int(input("Initial RNG seed (hex or decimal): "), 0)

    trainer = Trainer(name, tid, sid)

    print("\nResults:\n")

    for frame in range(5):
        rng = LCRNG(seed)
        rng.advance(frame)

        result = generate_method1(rng, trainer)

        print(f"Frame {frame}")
        print(f"  PID: 0x{result['pid']:08X}")
        print(f"  IVs:")
        for stat, value in result["ivs"].items():
            print(f"    {stat}: {value}")
        print(f"  Shiny: {result['shiny']}")
        print("-" * 40)


if __name__ == "__main__":
    main()
