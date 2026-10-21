#!/usr/bin/env python3
"""Replay the 6,000 served rounds under the declared strategy, in both split orders.

    python3 replay/replay-served-split-order.py

Step 19 publishes the pooled net of the served windows (nonces 0-49 of each of the 120 revealed
seeds) played under src/strategy.ts: -95.5 initial bets, z = -0.746 against the exact mean. The
replay engine (src/round-engine.ts) plays split hands one after the other: the first hand takes its
second card and is played out, then the second hand takes its card and is played out.

The casino deals differently (Step 6 shows it on all 401 captured split rounds): after a split the
main hand takes shoe[4] and the split hand shoe[5], then the SPLIT hand is played out, then the
main hand. Under that order the same 6,000 shoes give -112.5 and z = -0.94.

This script re-deals every served shoe from the revealed seeds and settles it both ways, with
nothing imported from the repository's code. It reproduces the published -95.5 (which checks the
script against Step 19) and produces the -112.5 the report quotes beside it.

Not a scored step and not part of `npm test`. Python standard library only. Reads
data/blackjack-6000hands.json and outputs/exact-rtp.json; writes nothing. About 10 seconds.
Exit code 0 when the figures equal the ones quoted in the report, 1 otherwise.
"""
import hashlib
import hmac
import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get('REPO') or Path(__file__).resolve().parent.parent)
DATA = json.loads((ROOT / 'data' / 'blackjack-6000hands.json').read_text())
EXACT = json.loads((ROOT / 'outputs' / 'exact-rtp.json').read_text())

QUOTED = {'engine_order_net': -95.5, 'casino_order_net': -112.5,
          'engine_order_z': '-0.746', 'casino_order_z': '-0.94'}
SERVED_WINDOW = 50                                       # nonces 0..49 of every epoch
SUITS = 4
DECKS = 8


def draw(key, client_seed, nonce, cursor, size):
    """One index in [0, size): HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor"), eight big-endian
    32-bit chunks, the first one below the largest multiple of `size` taken modulo `size`."""
    while True:
        digest = hmac.new(key, f'{client_seed}:{nonce}:{cursor}'.encode(), hashlib.sha256).digest()
        limit = (2 ** 32 // size) * size
        for offset in range(0, 32, 4):
            chunk = int.from_bytes(digest[offset:offset + 4], 'big')
            if chunk < limit:
                return chunk % size
        cursor += 1_000_000


def shoe_ranks(server_seed, client_seed, nonce):
    """The 416-card shoe as ranks 1..13, shuffled by the backward Fisher-Yates the casino uses."""
    key = bytes.fromhex(server_seed)
    cards = [rank for _ in range(DECKS) for _ in range(SUITS) for rank in range(1, 14)]
    for i in range(len(cards) - 1, 0, -1):
        j = draw(key, client_seed, nonce, i, i + 1)
        cards[i], cards[j] = cards[j], cards[i]
    return cards


def card_value(rank):
    return 11 if rank == 1 else 10 if rank >= 10 else rank


def total(values):
    t = sum(values)
    aces = values.count(11)
    while t > 21 and aces:
        t -= 10
        aces -= 1
    return t, aces > 0


def splits(value, up):
    """src/strategy.ts pairAction: True where the table splits the pair."""
    return {11: True, 10: False, 9: up not in (7, 10, 11), 8: True, 7: 2 <= up <= 7,
            6: 2 <= up <= 6, 5: False, 4: up in (5, 6), 3: 2 <= up <= 7, 2: 2 <= up <= 7}[value]


def action(t, soft, up):
    """src/strategy.ts softAction / hardAction: H, S, D (double, else hit) or Ds (double, else stand)."""
    if soft:
        if t >= 19:
            return 'S'
        if t == 18:
            return 'Ds' if 3 <= up <= 6 else 'S' if up in (2, 7, 8) else 'H'
        if t == 17:
            return 'D' if 3 <= up <= 6 else 'H'
        if t in (15, 16):
            return 'D' if 4 <= up <= 6 else 'H'
        if t in (13, 14):
            return 'D' if 5 <= up <= 6 else 'H'
        return 'H'
    if t >= 17:
        return 'S'
    if t >= 13:
        return 'S' if 2 <= up <= 6 else 'H'
    if t == 12:
        return 'S' if 4 <= up <= 6 else 'H'
    if t == 11:
        return 'H' if up == 11 else 'D'
    if t == 10:
        return 'D' if 2 <= up <= 9 else 'H'
    if t == 9:
        return 'D' if 3 <= up <= 6 else 'H'
    return 'H'


def play_hand(cards, up, next_card):
    """Play one hand to its end under the table. Returns (final total, stake in initial bets)."""
    while True:
        t, soft = total(cards)
        if t > 21:
            return t, 1
        a = action(t, soft, up)
        if a in ('D', 'Ds'):
            if len(cards) == 2:
                cards.append(next_card())
                return total(cards)[0], 2
            if a == 'Ds':
                return t, 1
            cards.append(next_card())
            continue
        if a == 'S':
            return t, 1
        cards.append(next_card())


def settle(ranks, casino_order):
    """Wagered and returned for one shoe, in initial bets, and whether the round split."""
    values = [card_value(r) for r in ranks]
    position = [4]

    def next_card():
        position[0] += 1
        return values[position[0] - 1]

    first, up, second, hole = values[0], values[1], values[2], values[3]
    player_natural = first + second == 21
    dealer_natural = up + hole == 21
    if dealer_natural:
        return 1, (1 if player_natural else 0), False
    if player_natural:
        return 1, 2.5, False
    split = ranks[0] == ranks[2] and splits(first, up)
    if not split:
        hands = [play_hand([first, second], up, next_card)]
    elif first == 11:                                    # split aces: one card each
        hands = [(total([11, next_card()])[0], 1), (total([11, next_card()])[0], 1)]
    elif casino_order:
        main = [first, next_card()]
        other = [second, next_card()]
        split_result = play_hand(other, up, next_card)   # the split hand is played first
        hands = [play_hand(main, up, next_card), split_result]
    else:
        hands = [play_hand([first, next_card()], up, next_card),
                 play_hand([second, next_card()], up, next_card)]
    wagered = sum(stake for _, stake in hands)
    dealer_total = 0
    if any(t <= 21 for t, _ in hands):
        dealer = [up, hole]
        while total(dealer)[0] < 17:                     # stands on every 17, soft included
            dealer.append(next_card())
        dealer_total = total(dealer)[0]
    returned = 0
    for t, stake in hands:
        if t > 21:
            continue
        if dealer_total > 21 or t > dealer_total:
            returned += 2 * stake
        elif t == dealer_total:
            returned += stake
    return wagered, returned, split


def main():
    net = {False: 0.0, True: 0.0}
    split_rounds = differing = rounds = 0
    for seed in DATA['seeds']:
        for nonce in range(SERVED_WINDOW):
            ranks = shoe_ranks(seed['serverSeed'], seed['clientSeed'], nonce)
            engine = settle(ranks, False)
            casino = settle(ranks, True)
            net[False] += engine[1] - engine[0]
            net[True] += casino[1] - casino[0]
            rounds += 1
            if engine[2]:
                split_rounds += 1
                differing += engine[:2] != casino[:2]

    mean = -EXACT['finite8TD']['edgePerInitialBet'] * rounds
    sd = EXACT['finite8TDMoments']['sd'] * math.sqrt(rounds)
    z_engine = (net[False] - mean) / sd
    z_casino = (net[True] - mean) / sd
    print(f'served rounds re-dealt: {rounds}; exact mean {mean:.4f}, SD {sd:.3f} (outputs/exact-rtp.json)')
    print(f'split hands one after the other (src/round-engine.ts): net {net[False]:+.1f}, z = {z_engine:.3f}')
    print(f"the casino's order (split hand first, Step 6):          net {net[True]:+.1f}, z = {z_casino:.3f}")
    print(f'split rounds under the table: {split_rounds}; settling differently under the two orders: {differing}')

    got = {'engine_order_net': net[False], 'casino_order_net': net[True],
           'engine_order_z': f'{z_engine:.3f}', 'casino_order_z': f'{z_casino:.2f}'}
    wrong = {k: (got[k], v) for k, v in QUOTED.items() if got[k] != v}
    if wrong:
        print('MISMATCH with the figures quoted in the report (got, quoted):', wrong)
        return 1
    print('PASS: both figures equal the ones quoted in the report.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
