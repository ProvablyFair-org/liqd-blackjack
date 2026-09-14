"""
Independent exact-rational blackjack oracle for the LIQD 8-deck audit.

PURPOSE. This is the external anchor `src/exact-play.ts` never had. It shares the
POLICY with the repo (exported to policy.json — policy is an input to the question,
not the thing under test) and derives every probability itself, physically:

  - the hole is a CONCRETE card dealt from the shoe, never a posterior
  - both split hands are played SEQUENTIALLY, so hand 1's consumption really does
    deplete the shoe hand 2 draws from
  - there is no conditioning anywhere, so it cannot be wrong the way the solver is
  - exact Fractions throughout: no floating point, no tolerance

Deal order: p1, up, p2, hole.  Rules: S17, DAS, peek/OBO, BJ 3:2, split aces get
one card, no resplit.
"""
from fractions import Fraction as F
from functools import lru_cache
import json, sys

VAL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]   # index 9 = Ace (11, soft)
A, T = 9, 8
S17, DAS, BJ_PAYS, SPLIT_ACES_ONE_CARD = True, True, F(3, 2), True

POLICY = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'policy.json'))

def add_card(total, soft, i):
    t, s = total, soft
    if i == A:
        if t + 11 <= 21: t, s = t + 11, True
        else:            t += 1
    else:
        t += VAL[i]
        if t > 21 and s: t, s = t - 10, False
    return t, s

def resolved(total, soft, up_val, can_double):
    return POLICY['resolved'][f"{total}|{1 if soft else 0}|{up_val}|{1 if can_double else 0}"]

def pair_act(rank_val, up_val):
    return POLICY['pair'][f"{rank_val}|{up_val}"]

def dec(c, i):
    l = list(c); l[i] -= 1; return tuple(l)

# ── dealer ───────────────────────────────────────────────────────────────────
@lru_cache(maxsize=None)
def dealer_dist(c, total, soft):
    """Final-total distribution: {17..21: p, 22: bust}. Physical draws, S17."""
    if total > 21: return {22: F(1)}
    stands = total >= 18 or (total == 17 and (not soft or S17))
    if stands and total >= 17: return {total: F(1)}
    n = sum(c)
    if n == 0: return {min(total, 22) if total >= 17 else 22: F(1)}
    out = {}
    for i in range(10):
        if c[i] == 0: continue
        p = F(c[i], n)
        t2, s2 = add_card(total, soft, i)
        for k, v in dealer_dist(dec(c, i), t2, s2).items():
            out[k] = out.get(k, F(0)) + p * v
    return out

def settle_one(c, player_total, d_total, d_soft):
    """EV of one settled hand (1 unit) vs a dealer playing out from (d_total,d_soft)."""
    if player_total > 21: return F(-1)
    ev = F(0)
    for j, p in dealer_dist(c, d_total, d_soft).items():
        if j == 22 or player_total > j: ev += p
        elif player_total < j:          ev -= p
    return ev

# ── player ───────────────────────────────────────────────────────────────────
@lru_cache(maxsize=None)
def play(c, total, soft, can_double, one_card, up_val):
    """
    Play one hand to completion under the TD policy.
    Returns tuple of (prob, final_total, counts_after, units) — units = 1 or 2.
    `final_total` > 21 means bust.
    """
    if total > 21:  return ((F(1), total, c, 1),)
    if one_card:    return ((F(1), total, c, 1),)
    act = resolved(total, soft, up_val, can_double)
    if act == 'S':  return ((F(1), total, c, 1),)
    n = sum(c)
    if n == 0:      return ((F(1), total, c, 1),)
    out = []
    if act == 'D':
        for i in range(10):
            if c[i] == 0: continue
            t2, _ = add_card(total, soft, i)
            out.append((F(c[i], n), t2, dec(c, i), 2))
        return tuple(out)
    for i in range(10):                       # hit
        if c[i] == 0: continue
        p = F(c[i], n)
        t2, s2 = add_card(total, soft, i)
        for (q, ft, ca, u) in play(dec(c, i), t2, s2, False, False, up_val):
            out.append((p * q, ft, ca, u))
    return tuple(out)

def hand_ev(c, total, soft, can_double, one_card, up_val, d_total, d_soft):
    ev = wag = F(0)
    for (p, ft, ca, u) in play(c, total, soft, can_double, one_card, up_val):
        ev  += p * (F(-u) if ft > 21 else u * settle_one(ca, ft, d_total, d_soft))
        wag += p * u
    return ev, wag

def split_ev(c, rank, up_val, d_total, d_soft):
    """Two hands played SEQUENTIALLY from the same shoe."""
    aces_one = (rank == A and SPLIT_ACES_ONE_CARD)
    can_dbl  = DAS and not aces_one
    ev = wag = F(0)
    n1 = sum(c)
    for i in range(10):                                   # first card, hand 1
        if c[i] == 0: continue
        p1 = F(c[i], n1)
        t1, s1 = add_card(*add_card(0, False, rank), i)
        for (q1, ft1, ca1, u1) in play(dec(c, i), t1, s1, can_dbl, aces_one, up_val):
            n2 = sum(ca1)
            if n2 == 0: continue
            for j in range(10):                           # first card, hand 2
                if ca1[j] == 0: continue
                p2 = F(ca1[j], n2)
                t2, s2 = add_card(*add_card(0, False, rank), j)
                for (q2, ft2, ca2, u2) in play(dec(ca1, j), t2, s2, can_dbl, aces_one, up_val):
                    w = p1 * q1 * p2 * q2
                    e1 = F(-u1) if ft1 > 21 else u1 * settle_one(ca2, ft1, d_total, d_soft)
                    e2 = F(-u2) if ft2 > 21 else u2 * settle_one(ca2, ft2, d_total, d_soft)
                    ev  += w * (e1 + e2)
                    wag += w * (u1 + u2)
    return ev, wag

def initial(c, p1, p2, up_val, d_total, d_soft):
    t, s = add_card(*add_card(0, False, p1), p2)
    if p1 == p2:
        rv = 11 if p1 == A else VAL[p1]
        if pair_act(rv, up_val) == 'P':
            return split_ev(c, p1, up_val, d_total, d_soft)
    return hand_ev(c, t, s, True, False, up_val, d_total, d_soft)

# ── top level ────────────────────────────────────────────────────────────────
def solve(shoe):
    ev_sum = wag_sum = p_sum = F(0)
    N = sum(shoe)
    for p1 in range(10):
        if shoe[p1] == 0: continue
        c1 = dec(shoe, p1); pp1 = F(shoe[p1], N)
        for up in range(10):
            if c1[up] == 0: continue
            c2 = dec(c1, up); pup = F(c1[up], sum(c1))
            for p2 in range(10):
                if c2[p2] == 0: continue
                c3 = dec(c2, p2); pp2 = F(c2[p2], sum(c2))
                for hole in range(10):
                    if c3[hole] == 0: continue
                    c4 = dec(c3, hole); ph = F(c3[hole], sum(c3))
                    w = pp1 * pup * pp2 * ph
                    p_sum += w
                    player_bj = {p1, p2} == {T, A}
                    dealer_bj = {up, hole} == {T, A}
                    peeks = up in (A, T)
                    d_total, d_soft = add_card(*add_card(0, False, up), hole)
                    if dealer_bj and peeks:
                        ev, wag = (F(0), F(1)) if player_bj else (F(-1), F(1))
                    elif player_bj:
                        ev, wag = BJ_PAYS, F(1)
                    else:
                        ev, wag = initial(c4, p1, p2, VAL[up], d_total, d_soft)
                    ev_sum  += w * ev
                    wag_sum += w * wag
    return ev_sum / p_sum, wag_sum / p_sum, p_sum

if __name__ == '__main__':
    SHOES = {
        'control [3,0,0,0,0,3,3,3,0,0]': (3,0,0,0,0,3,3,3,0,0),
        'peekA   [0,0,0,0,0,2,2,2,5,3]': (0,0,0,0,0,2,2,2,5,3),
        'peekB   [2,0,0,0,0,0,2,2,4,3]': (2,0,0,0,0,0,2,2,4,3),
    }
    for name, shoe in SHOES.items():
        play.cache_clear(); dealer_dist.cache_clear()
        ev, wag, psum = solve(shoe)
        assert psum == 1, f"deal probabilities must sum to 1, got {psum}"
        print(f"{name}")
        print(f"   EV/initial bet = {ev}  = {float(ev):+.15f}")
        print(f"   E[wager]       = {wag}  = {float(wag):.15f}")
