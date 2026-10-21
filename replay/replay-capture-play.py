#!/usr/bin/env python3
"""Replay the capture script's decisions against the recorded action lists (MANIFEST DL-18).

    python3 replay/replay-capture-play.py

Produces the figures the report quotes about how the 5 August 2026 capture was PLAYED:

  * 5,599 of 5,599 unsplit rounds follow the capture's strategy table;
  * 401 of 401 split rounds are reproduced when every split-round decision is taken from the
    MAIN hand's cards while the casino plays the SPLIT hand first;
  * 282 of 401 are reproduced when each decision is taken from the hand actually in play, so
    119 split rounds contain an action the phase strategy would not choose for that hand;
  * 28 unsplit rounds in the basic-strategy phases hit a soft 13, 14 or 15 where
    src/strategy.ts doubles (soft 13/14 against 5-6, soft 15 against 4-6).

Not a scored step and not part of `npm test`: no rule or payout check depends on which action was
chosen. It exists so these figures have a producing script in the package.

The strategy below is the capture rig's table as it ran (it hits soft 13-15), typed out here
because the rig's strategy module is not shipped. It is checked against the data by this script
itself: it must reproduce every recorded action list on the readings stated above.

Python standard library only. Reads data/blackjack-6000hands.json; writes nothing.
Exit code 0 when the figures equal the ones quoted in the report, 1 otherwise.
"""
import collections
import json
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get('REPO') or Path(__file__).resolve().parent.parent)
DATA = json.loads((ROOT / 'data' / 'blackjack-6000hands.json').read_text())
STRATEGY = {phase: spec['strategy'] for phase, spec in DATA['meta']['phases'].items()}

# The figures quoted in the report (MANIFEST DL-18 and the phase tables).
QUOTED = {'unsplit_reproduced': 5599, 'split_rounds': 401, 'split_main_hand_reading': 401,
          'split_hand_in_play_reading': 282, 'split_off_strategy': 119, 'soft_13_to_15_hits': 28}


def rank(card):
    return int(card.split(':')[1])


def value(card):
    r = rank(card)
    return 11 if r == 1 else 10 if r >= 10 else r


def label(card):
    r = rank(card)
    return 'A' if r == 1 else '10' if r >= 10 else str(r)


def hand_value(cards):
    total = sum(value(c) for c in cards)
    aces = sum(1 for c in cards if value(c) == 11)
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total, aces > 0


def decide(cards, upcard, can_double, can_split, strategy):
    """The capture rig's decision for one hand (the v1 table: soft 13-15 are hit, never doubled)."""
    total, soft = hand_value(cards)
    up = label(upcard)
    if strategy == 'aggressive':
        return 'split' if can_split else 'hit' if total < 17 else 'stand'
    if strategy == 'splitforce':
        return 'split' if can_split else 'double' if can_double else 'hit' if total < 17 else 'stand'
    if can_split and len(cards) == 2:
        r = label(cards[0])
        if (r in ('A', '8')
                or (r == '9' and up not in ('7', '10', 'A'))
                or (r == '7' and up in ('2', '3', '4', '5', '6', '7'))
                or (r == '6' and up in ('2', '3', '4', '5', '6'))
                or (r == '4' and up in ('5', '6'))
                or (r in ('3', '2') and up in ('2', '3', '4', '5', '6', '7'))):
            return 'split'
    if soft:
        if total >= 19:
            return 'stand'
        if total == 18:
            if up in ('3', '4', '5', '6'):
                return 'double' if can_double else 'stand'
            return 'stand' if up in ('2', '7', '8') else 'hit'
        if total == 17 and up in ('3', '4', '5', '6') and can_double:
            return 'double'
        if total == 16 and up in ('4', '5', '6') and can_double:
            return 'double'
        return 'hit'
    if total >= 17:
        return 'stand'
    if total >= 13 and up in ('2', '3', '4', '5', '6'):
        return 'stand'
    if total == 12 and up in ('4', '5', '6'):
        return 'stand'
    if total == 11 and up != 'A' and can_double:
        return 'double'
    if total == 10 and up not in ('10', 'A') and can_double:
        return 'double'
    if total == 9 and up in ('3', '4', '5', '6') and can_double:
        return 'double'
    return 'hit'


def audit_table_doubles_soft(total, upcard):
    """True where src/strategy.ts doubles a two-card soft 13, 14 or 15."""
    up = value(upcard)
    return (total in (13, 14) and up in (5, 6)) or (total == 15 and up in (4, 5, 6))


def player_actions(bet):
    return [a for a in bet['actions'] if a != 'no-ins']


def unsplit_round_follows_table(bet):
    """Walk an unsplit round: every recorded action must be the table's decision for the cards held,
    every drawn card must be accounted for, and the list must end where the hand ends: on a stand
    or a double, on a total of 21 or more (the casino ends such a hand itself), or with no action
    at all when the dealer's natural settled the round at the peek."""
    actions = player_actions(bet)
    full = bet['playerHands'][0]['cards']
    upcard = bet['dealerHand'][0]
    cards, drawn = full[:2], 2
    is_pair = value(full[0]) == value(full[1])
    for i, action in enumerate(actions):
        two = len(cards) == 2
        if hand_value(cards)[0] >= 21:                  # the hand had already ended
            return False
        if decide(cards, upcard, two, is_pair and two, STRATEGY[bet['phase']]) != action:
            return False
        if action in ('hit', 'double'):
            if drawn >= len(full):
                return False
            cards = cards + [full[drawn]]
            drawn += 1
        if action in ('stand', 'double') and i != len(actions) - 1:
            return False                                # nothing follows a stand or a double
    if drawn != len(full):
        return False
    dealer = bet['dealerHand']
    dealer_natural = len(dealer) == 2 and hand_value(dealer)[0] == 21
    ended = (bool(actions) and actions[-1] in ('stand', 'double')) or hand_value(cards)[0] >= 21
    return ended or (not actions and dealer_natural)


def split_round_follows_table(bet, decide_from_main_hand):
    """Walk a split round in the casino's order: the split hand is played first, then the main hand.
    decide_from_main_hand=True : every decision made while the split hand is in play is taken from
                                 the MAIN hand's cards (what the capture rig did);
    decide_from_main_hand=False: each decision is taken from the hand actually in play.
    A two-card 21 on a split hand is not ended by the casino: it waits for an action."""
    actions = player_actions(bet)
    if not actions or actions[0] != 'split':
        return False
    actions = actions[1:]
    main_full = bet['playerHands'][0]['cards']
    split_full = bet['playerHands'][1]['cards']
    upcard = bet['dealerHand'][0]
    strategy = STRATEGY[bet['phase']]
    main, split = main_full[:2], split_full[:2]
    main_drawn = split_drawn = 2
    k = 0
    if value(main_full[0]) == 11:                       # split aces: one card each, no action
        return not actions and len(main_full) == 2 and len(split_full) == 2
    done = False
    while not done:                                     # the split hand
        if k >= len(actions):
            return False
        seen = main if decide_from_main_hand else split
        if decide(seen, upcard, len(split) == 2, False, strategy) != actions[k]:
            return False
        action = actions[k]
        k += 1
        if action == 'stand':
            done = True
        else:
            if split_drawn >= len(split_full):
                return False
            split = split + [split_full[split_drawn]]
            split_drawn += 1
            done = action == 'double' or hand_value(split)[0] >= 21
    done = False
    while not done:                                     # the main hand
        if k >= len(actions):
            return False
        if decide(main, upcard, len(main) == 2, False, strategy) != actions[k]:
            return False
        action = actions[k]
        k += 1
        if action == 'stand':
            done = True
        else:
            if main_drawn >= len(main_full):
                return False
            main = main + [main_full[main_drawn]]
            main_drawn += 1
            done = action == 'double' or hand_value(main)[0] >= 21
    return k == len(actions) and split_drawn == len(split_full) and main_drawn == len(main_full)


def main():
    got = collections.Counter()
    by_phase = collections.defaultdict(collections.Counter)
    for bet in DATA['bets']:
        phase = bet['phase']
        if not bet['split']:
            if unsplit_round_follows_table(bet):
                got['unsplit_reproduced'] += 1
            else:
                got['unsplit_not_reproduced'] += 1
            actions = player_actions(bet)
            cards = bet['playerHands'][0]['cards'][:2]
            total, soft = hand_value(cards)
            if (STRATEGY[phase] == 'basic' and actions and soft
                    and audit_table_doubles_soft(total, bet['dealerHand'][0]) and actions[0] == 'hit'):
                got['soft_13_to_15_hits'] += 1
                by_phase[phase]['soft hits'] += 1
            continue
        got['split_rounds'] += 1
        by_phase[phase]['split rounds'] += 1
        if split_round_follows_table(bet, True):
            got['split_main_hand_reading'] += 1
        if split_round_follows_table(bet, False):
            got['split_hand_in_play_reading'] += 1
        else:
            got['split_off_strategy'] += 1
            by_phase[phase]['off strategy'] += 1

    print(f"unsplit rounds following the capture's table: {got['unsplit_reproduced']} of "
          f"{got['unsplit_reproduced'] + got['unsplit_not_reproduced']}")
    print(f"split rounds: {got['split_rounds']}")
    print(f"  reproduced when decisions are taken from the MAIN hand (the capture's rule): "
          f"{got['split_main_hand_reading']}")
    print(f"  reproduced when decisions are taken from the hand in play: {got['split_hand_in_play_reading']}")
    print(f"  containing an action the phase strategy would not choose for the hand in play: "
          f"{got['split_off_strategy']}  "
          + ', '.join(f"{p} {by_phase[p]['off strategy']}/{by_phase[p]['split rounds']}" for p in 'ABCDEF'))
    print(f"unsplit basic-phase rounds that hit a soft 13-15 where src/strategy.ts doubles: "
          f"{got['soft_13_to_15_hits']}  "
          + ', '.join(f"{p} {by_phase[p]['soft hits']}" for p in 'ADE'))

    wrong = {k: (got[k], v) for k, v in QUOTED.items() if got[k] != v}
    if wrong:
        print('MISMATCH with the figures quoted in the report (got, quoted):', wrong)
        return 1
    print('PASS: every figure equals the one quoted in the report.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
