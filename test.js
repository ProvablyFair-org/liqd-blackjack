/**
 * STANDALONE UNIT SUITE — generated, do not edit.
 *
 *     node test.js
 *
 * Runs the package's own unit tests with no `npm install` and no mocha. The test sources are
 * unchanged; `describe`/`it` are bound to Node's built-in `node:test` runner instead of mocha's.
 *
 * It is a BUILD PRODUCT of every unit-test file under `tests/` (the *Tests.ts spec set).
 * Rebuild with `audit-framework/tools/build-standalone-verifier.mjs <package> --tests`.
 *
 * Linked modules: 23
 */
'use strict';

var __nodeTest = require('node:test');
function __mochaCtx() {
  return { timeout: function () {}, slow: function () {}, retries: function () {} };
}
function __wrap(fn) {
  if (typeof fn !== 'function') return fn;
  return function () { return fn.call(__mochaCtx()); };
}
function __bind(name) {
  var orig = __nodeTest[name];
  var bound = function (desc, fn) { return orig(desc, __wrap(fn)); };
  // carry .skip / .only / .todo through so a suite can still disable a case
  for (var k in orig) { if (typeof orig[k] === 'function') bound[k] = orig[k]; }
  bound.skip = orig.skip; bound.only = orig.only; bound.todo = orig.todo;
  return bound;
}
// HOOKS NEED THE SHIM TOO, and leaving them out is not a cosmetic miss. mines' QA-01 suite calls
// this.timeout(600_000) inside a before(...) hook for a million-round replay. Unwrapped, that hook
// threw, Node cancelled every test in the suite, and the run reported "38 pass, 0 fail" while
// SEVEN tests had silently never executed — a green result over a hole. Caught 2026-09-11 by the
// unit-count parity check (mocha 45 vs standalone 38), which is the entire reason that check exists.
function __bindHook(name) {
  var orig = __nodeTest[name];
  return function (fn) { return orig(__wrap(fn)); };
}
globalThis.describe   = __bind('describe');
globalThis.it         = __bind('it');
globalThis.before     = __bindHook('before');
globalThis.after      = __bindHook('after');
globalThis.beforeEach = __bindHook('beforeEach');
globalThis.afterEach  = __bindHook('afterEach');


var __PF_ROOT__ = __dirname;
var __nodeRequire = require;
var __modules = {
  "outputs/simulation-results.json": function (module) { module.exports = {
    "audit": "LIQD Blackjack",
    "generatedAt": "2026-09-02T19:05:06.913Z",
    "algorithm": "HMAC-SHA256 (key = hex-decoded serverSeed); backward in-place Fisher-Yates over 416 cards; deal PDPD; optimal basic strategy S17/DAS/SPA1/no-resplit/dealer-peek; blackjack 3:2",
    "baseGame": {
        "rtp": 0.9951141166666667,
        "edge": 0.004885883333333334,
        "rtpInitial": 0.9951141166666667,
        "edgeInitial": 0.004885883333333334,
        "rtpPerTotalWagered": 0.995667659776964,
        "edgePerTotalWagered": 0.004332340223036021,
        "avgWager": 1.12777,
        "rounds": 30000000,
        "standardError": 0.00020996031371031364,
        "sdPerRound": 1.146718922176392,
        "sdPerRoundNote": "Measured per-round SD of the per-initial-bet loss. standardError/gate use the constant 1.15 (this value rounded up).",
        "convergence": [
            {
                "rounds": 1000,
                "rtp": 0.991,
                "se": 0.03636619309193636
            },
            {
                "rounds": 3000,
                "rtp": 0.9961666666666666,
                "se": 0.020996031371031364
            },
            {
                "rounds": 10000,
                "rtp": 0.99195,
                "se": 0.0115
            },
            {
                "rounds": 30000,
                "rtp": 0.9971833333333333,
                "se": 0.006639528095680696
            },
            {
                "rounds": 100000,
                "rtp": 0.994095,
                "se": 0.0036366193091936358
            },
            {
                "rounds": 300000,
                "rtp": 0.9961383333333333,
                "se": 0.0020996031371031364
            },
            {
                "rounds": 1000000,
                "rtp": 0.995364,
                "se": 0.00115
            },
            {
                "rounds": 3000000,
                "rtp": 0.995395,
                "se": 0.0006639528095680696
            },
            {
                "rounds": 10000000,
                "rtp": 0.9957592,
                "se": 0.00036366193091936355
            },
            {
                "rounds": 30000000,
                "rtp": 0.9951141166666667,
                "se": 0.00020996031371031364
            }
        ],
        "method": "Fair-shuffle consistency simulation for the declared rules and strategy. Fresh-run estimates vary with Monte Carlo sampling error. Results use per-initial-bet and per-total-wager conventions; the verifier compares the estimates with the exact finite eight-deck model. Pass 1 separately checks first-card rank uniformity and the specified serial statistics of blackjackShoe.",
        "note": "Finite 8-deck RTP under optimal basic strategy (S17/DAS/SPA1/no-resplit/peek, blackjack 3:2). Per initial bet the finite figure sits just above the analytical infinite-deck limit, as card removal predicts."
    },
    "realShoeConsistency": {
        "rtp": 0.997429,
        "edge": 0.002571,
        "rtpPerTotalWagered": 0.9977198107735615,
        "rounds": 500000,
        "standardError": 0.0016263455967290591,
        "deviationSigma": 1.4233649588310369,
        "playerBJFreq": 0.047628,
        "dealerBJFreq": 0.047774,
        "note": "RTP (per initial bet) over the actual blackjackShoe RNG algorithm — a consistency check. Fewer rounds (the real shoe is HMAC-hashed per card), so the Monte-Carlo error is wide here; baseGame is the fair-shuffle consistency estimate and the analytical engine is the deterministic anchor."
    },
    "exactFiguresSource": "outputs/exact-rtp.json (regenerate with `npm run rtp`) — deterministic exact 8-deck EV of record: finite-8 TD headline (anchored to the tiny-shoe oracle + Wizard of Odds), finite-8 CD is a demoted internal diagnostic (cdPeekIsApproximate, never published), finite-1 deck-sensitivity, infinite-deck regression value, card-removal lift, WoO anchor.",
    "analyticalInfiniteDeck": 0.994296119877263,
    "analyticalInfiniteDeckEdge": 0.005703880122737037,
    "cardRemovalLiftPP": 0.08271318994897969,
    "pass1_fresh_seeds": {
        "description": "One freshly generated server/client seed pair drives a 500,000-nonce stream of the reference blackjackShoe algorithm. The retained results cover first-card rank uniformity (df=12), lag-1 correlation and the runs test. These are specified statistical checks; the finite eight-deck RTP is evaluated separately by the deterministic model and a simulation consistency check.",
        "rounds": 500000,
        "firstCardChi2": 9.514263999999999,
        "firstCardDf": 12,
        "firstCardPValue": 0.6584903353498054,
        "serialR1": 0.0019370587263448362,
        "serialR1Z": 1.3697073609550106,
        "serialRunsZ": -0.23749697219479843,
        "serialRunsPValue": 0.812271365774238,
        "firstCardUniformFail": false,
        "serialFail": false
    },
    "pass2_casino_seeds": {
        "description": "Casino seeds (revealed serverSeeds). Cherry-pick test on first-card rank uniformity over the 0..49 served window vs a parametric bootstrap null. Gross-bias check only; the primary cherry-pick defence is the client-seed-after-commitment mitigation (see AUDIT_CONTEXT.md#seed-selection-and-server-operations).",
        "noncesPerSeed": 1000,
        "earlyWindow": [
            0,
            49
        ],
        "lateWindow": [
            50,
            999
        ],
        "bootstrapReps": 2000,
        "seeds_tested": 120,
        "cherryPickFlags": 5,
        "expectedFlagsByChance": 5.699999999999999,
        "cherryPickSurvivalP": 0.6788813797720822,
        "results": [
            {
                "epoch": 0,
                "hashedServerSeed": "948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42",
                "earlyChi2": 6.03,
                "earlyBootstrapP": 0.8325837081459271,
                "lateChi2": 8.934736842105263,
                "latePValue": 0.7084944471544968,
                "cherryPickFlag": false
            },
            {
                "epoch": 1,
                "hashedServerSeed": "5112cebbec8745b056100e4cb9234a70fab55dc54c3b3b6a0573a74c071e1d43",
                "earlyChi2": 5.8999999999999995,
                "earlyBootstrapP": 0.8435782108945528,
                "lateChi2": 15.50315789473684,
                "latePValue": 0.2150660899683483,
                "cherryPickFlag": false
            },
            {
                "epoch": 2,
                "hashedServerSeed": "9e7871e9e10b395a061d187faaab96c7d2f7516d3699b525fc956f513bfbbd73",
                "earlyChi2": 13.830000000000004,
                "earlyBootstrapP": 0.18290854572713644,
                "lateChi2": 13.368421052631579,
                "latePValue": 0.34284051546128114,
                "cherryPickFlag": false
            },
            {
                "epoch": 3,
                "hashedServerSeed": "a5dd969e1a8cb2e87dc84f2067cb042a9501a570b840ecb5636f84ffc562574a",
                "earlyChi2": 11.1,
                "earlyBootstrapP": 0.3523238380809595,
                "lateChi2": 8.223157894736843,
                "latePValue": 0.7674572038280058,
                "cherryPickFlag": false
            },
            {
                "epoch": 4,
                "hashedServerSeed": "f11e19d58373b3d8a583409ffc99d9e251c2556e873a38fff493ec349bbf5f86",
                "earlyChi2": 7.459999999999999,
                "earlyBootstrapP": 0.7186406796601699,
                "lateChi2": 13.368421052631579,
                "latePValue": 0.34284051546128114,
                "cherryPickFlag": false
            },
            {
                "epoch": 5,
                "hashedServerSeed": "6c39d30ae34a2e4105dcfd0b19788629f5f6ef7b52893ba9044786d23f4c7296",
                "earlyChi2": 20.59,
                "earlyBootstrapP": 0.02798600699650175,
                "lateChi2": 10.877894736842103,
                "latePValue": 0.5394111583378465,
                "cherryPickFlag": true
            },
            {
                "epoch": 6,
                "hashedServerSeed": "3de4f77ede381e0904fdd35e8a911920cc28ba84c883035b874babed98ec84d0",
                "earlyChi2": 13.829999999999998,
                "earlyBootstrapP": 0.191904047976012,
                "lateChi2": 18.212631578947367,
                "latePValue": 0.10938517377390722,
                "cherryPickFlag": false
            },
            {
                "epoch": 7,
                "hashedServerSeed": "54b92801fe50cabcc7af8c4a02048a5eee6c4083b34c5c9a7aeae9947362a0d1",
                "earlyChi2": 10.06,
                "earlyBootstrapP": 0.44427786106946526,
                "lateChi2": 9.098947368421053,
                "latePValue": 0.6944565791509114,
                "cherryPickFlag": false
            },
            {
                "epoch": 8,
                "hashedServerSeed": "754f046b1e83fda0994b7226d20873af8809bcea0e810ec7f88643e13ddb23d2",
                "earlyChi2": 19.549999999999997,
                "earlyBootstrapP": 0.037481259370314844,
                "lateChi2": 16.78947368421052,
                "latePValue": 0.15768968834202668,
                "cherryPickFlag": true
            },
            {
                "epoch": 9,
                "hashedServerSeed": "838fb3e9f0e73d5f30da7f85e6df4dcaa97acd779d72920a99838643008d74dd",
                "earlyChi2": 9.280000000000001,
                "earlyBootstrapP": 0.5062468765617192,
                "lateChi2": 31.787368421052633,
                "latePValue": 0.0014922418327989462,
                "cherryPickFlag": false
            },
            {
                "epoch": 10,
                "hashedServerSeed": "5ce41cbb8bbd822f1b20575ec47919fa242267900604c21e53abbe2eb3009cb7",
                "earlyChi2": 10.71,
                "earlyBootstrapP": 0.375312343828086,
                "lateChi2": 11.014736842105265,
                "latePValue": 0.5276561589074724,
                "cherryPickFlag": false
            },
            {
                "epoch": 11,
                "hashedServerSeed": "41f186b9c02ce992e6d7c3a68f433046b1372c40ebad7f418281cba2e156e7a3",
                "earlyChi2": 6.03,
                "earlyBootstrapP": 0.8325837081459271,
                "lateChi2": 23.056842105263158,
                "latePValue": 0.02724722858191775,
                "cherryPickFlag": false
            },
            {
                "epoch": 12,
                "hashedServerSeed": "8f668b432453262c6ce3cf1aee4feede101f090f19606d31e527cbbab075454d",
                "earlyChi2": 11.879999999999999,
                "earlyBootstrapP": 0.2928535732133933,
                "lateChi2": 9.865263157894736,
                "latePValue": 0.6277798142660383,
                "cherryPickFlag": false
            },
            {
                "epoch": 13,
                "hashedServerSeed": "0dafa6145786c84c8ad18f5230ad0893d0e4ba3c2f1f035d4b285d157c94a9e3",
                "earlyChi2": 12.14,
                "earlyBootstrapP": 0.2848575712143928,
                "lateChi2": 18.157894736842106,
                "latePValue": 0.1109797257287034,
                "cherryPickFlag": false
            },
            {
                "epoch": 14,
                "hashedServerSeed": "6f66d3782b00b2cf5d2b0d734eed3d5dec2bab70328aa26ace15936d73aa7497",
                "earlyChi2": 11.88,
                "earlyBootstrapP": 0.29185407296351823,
                "lateChi2": 6.9915789473684224,
                "latePValue": 0.8581695499898423,
                "cherryPickFlag": false
            },
            {
                "epoch": 15,
                "hashedServerSeed": "f9129d6569191eb2cca049c0d64bd91e481ad0f8eeba8da8b872ef6c251f5697",
                "earlyChi2": 4.340000000000001,
                "earlyBootstrapP": 0.9325337331334332,
                "lateChi2": 15.941052631578946,
                "latePValue": 0.19395090423212402,
                "cherryPickFlag": false
            },
            {
                "epoch": 16,
                "hashedServerSeed": "f8ff2945e82822fe35714698b3ac5806faf15c508a99ad687966991435bd8a38",
                "earlyChi2": 12.399999999999997,
                "earlyBootstrapP": 0.2588705647176412,
                "lateChi2": 8.852631578947367,
                "latePValue": 0.715463472981631,
                "cherryPickFlag": false
            },
            {
                "epoch": 17,
                "hashedServerSeed": "62516b54607d363e5f66fe162dbcbf4cbfdbd74ad554a1ca1d156d408871e026",
                "earlyChi2": 10.84,
                "earlyBootstrapP": 0.36281859070464767,
                "lateChi2": 11.644210526315788,
                "latePValue": 0.47465975551368733,
                "cherryPickFlag": false
            },
            {
                "epoch": 18,
                "hashedServerSeed": "73fdbaee7e0c27be83645b0d732405aa73dccbc09d6750a38e279e50d8f5089c",
                "earlyChi2": 14.739999999999998,
                "earlyBootstrapP": 0.15442278860569716,
                "lateChi2": 17.17263157894737,
                "latePValue": 0.14321807228965777,
                "cherryPickFlag": false
            },
            {
                "epoch": 19,
                "hashedServerSeed": "37d0763bf0594d8cf97b3df31baca7674e2db1cb0c30f85f42a41636748eb0f1",
                "earlyChi2": 5.9,
                "earlyBootstrapP": 0.841079460269865,
                "lateChi2": 10.357894736842105,
                "latePValue": 0.5845941285683177,
                "cherryPickFlag": false
            },
            {
                "epoch": 20,
                "hashedServerSeed": "200124157f9d51189109d8e64bcd4952ce1b1637178ea2b1243651acf43907b8",
                "earlyChi2": 7.720000000000001,
                "earlyBootstrapP": 0.670664667666167,
                "lateChi2": 19.58105263157895,
                "latePValue": 0.07543777122405737,
                "cherryPickFlag": false
            },
            {
                "epoch": 21,
                "hashedServerSeed": "199fd1d2fa45a48f5ff7d0edfd37177c6fee7918259bb01b19f7d56d2c0f4169",
                "earlyChi2": 5.51,
                "earlyBootstrapP": 0.8650674662668666,
                "lateChi2": 24.452631578947365,
                "latePValue": 0.017640612526776067,
                "cherryPickFlag": false
            },
            {
                "epoch": 22,
                "hashedServerSeed": "1be184b5e4a4c14e4c41de78ef943fd3fa277e8bc1c2b0e79e2fd788680dd43b",
                "earlyChi2": 6.679999999999998,
                "earlyBootstrapP": 0.7806096951524237,
                "lateChi2": 7.922105263157896,
                "latePValue": 0.7911875867631828,
                "cherryPickFlag": false
            },
            {
                "epoch": 23,
                "hashedServerSeed": "6422a380ae080ef04ce185dbb5f2667da3ebbd0d64ee665583efab37b3e8e541",
                "earlyChi2": 11.23,
                "earlyBootstrapP": 0.34182908545727136,
                "lateChi2": 21.907368421052634,
                "latePValue": 0.03857120170938377,
                "cherryPickFlag": false
            },
            {
                "epoch": 24,
                "hashedServerSeed": "0a27d971dac6e22a5c7de0328a7a3798c480840c69c4d8bbc7738ff03086ab14",
                "earlyChi2": 8.11,
                "earlyBootstrapP": 0.6526736631684158,
                "lateChi2": 15.202105263157893,
                "latePValue": 0.23056955593519257,
                "cherryPickFlag": false
            },
            {
                "epoch": 25,
                "hashedServerSeed": "2f06e6c5c52974d0bbc80fe1ea0b2451a042ca60854fea16e233503ad525eaf3",
                "earlyChi2": 11.23,
                "earlyBootstrapP": 0.34182908545727136,
                "lateChi2": 16.16,
                "latePValue": 0.18401719660384286,
                "cherryPickFlag": false
            },
            {
                "epoch": 26,
                "hashedServerSeed": "6b3a1522fa168ca3e7ddcaa1e4823a8424633c0435643bcc000291cc97d0f6b1",
                "earlyChi2": 15.52,
                "earlyBootstrapP": 0.12643678160919541,
                "lateChi2": 7.566315789473686,
                "latePValue": 0.8180374034757972,
                "cherryPickFlag": false
            },
            {
                "epoch": 27,
                "hashedServerSeed": "f918584d7e905acdfd9a6c005368e819891f706f84b443d6cfe7d4cb4d141545",
                "earlyChi2": 14.739999999999998,
                "earlyBootstrapP": 0.15442278860569716,
                "lateChi2": 7.894736842105264,
                "latePValue": 0.7933012937452222,
                "cherryPickFlag": false
            },
            {
                "epoch": 28,
                "hashedServerSeed": "dfc83694af6b07341c09eed2332634bb28c9fae4b1700da47854c7be96abba47",
                "earlyChi2": 8.629999999999999,
                "earlyBootstrapP": 0.592703648175912,
                "lateChi2": 8.442105263157895,
                "latePValue": 0.749697829066009,
                "cherryPickFlag": false
            },
            {
                "epoch": 29,
                "hashedServerSeed": "0fad61276161250dbd30530b5c89b71834376eb29ef284c71b93412835108d5c",
                "earlyChi2": 15.909999999999998,
                "earlyBootstrapP": 0.11894052973513243,
                "lateChi2": 15.421052631578947,
                "latePValue": 0.21921372622622481,
                "cherryPickFlag": false
            },
            {
                "epoch": 30,
                "hashedServerSeed": "e25f3492f5f6f70075c8a7e3cab042c6184bef0587538e9a632e9e98653780c5",
                "earlyChi2": 10.71,
                "earlyBootstrapP": 0.375312343828086,
                "lateChi2": 17.063157894736843,
                "latePValue": 0.1472369272392906,
                "cherryPickFlag": false
            },
            {
                "epoch": 31,
                "hashedServerSeed": "23bab476de4769b7cbb421618b26ac3bb3b48619bfdf5d9cd1596b1eaa1c7374",
                "earlyChi2": 9.15,
                "earlyBootstrapP": 0.5337331334332833,
                "lateChi2": 11.534736842105263,
                "latePValue": 0.48373039266723394,
                "cherryPickFlag": false
            },
            {
                "epoch": 32,
                "hashedServerSeed": "d8b2a83c9f67dfb84aaa026e0dfe03b0cb940ba0f3d8e17b9006f147b2269415",
                "earlyChi2": 20.59,
                "earlyBootstrapP": 0.02798600699650175,
                "lateChi2": 13.505263157894737,
                "latePValue": 0.3334093022327177,
                "cherryPickFlag": true
            },
            {
                "epoch": 33,
                "hashedServerSeed": "4b522d5cb3eb63c67fa80958f67b8f12f4b222963632a95a1fe7b22afbdb20f8",
                "earlyChi2": 14.870000000000001,
                "earlyBootstrapP": 0.1469265367316342,
                "lateChi2": 8.770526315789475,
                "latePValue": 0.7223955136658755,
                "cherryPickFlag": false
            },
            {
                "epoch": 34,
                "hashedServerSeed": "30db6b20833dd2f985c9807517500f7edc3ee2ca7a3d5fff159579b4ee69a481",
                "earlyChi2": 11.750000000000002,
                "earlyBootstrapP": 0.29685157421289354,
                "lateChi2": 12.109473684210526,
                "latePValue": 0.4369282228806889,
                "cherryPickFlag": false
            },
            {
                "epoch": 35,
                "hashedServerSeed": "abc53d2685de9078e0009b290a7a54711c0dd5c115ab39ffeeaa3df0e622bd3d",
                "earlyChi2": 16.43,
                "earlyBootstrapP": 0.10444777611194403,
                "lateChi2": 5.486315789473685,
                "latePValue": 0.939736356910566,
                "cherryPickFlag": false
            },
            {
                "epoch": 36,
                "hashedServerSeed": "0c2c92bfd48cbcb327e166973c4d240616cef0a571344650164c4c60905c80ff",
                "earlyChi2": 12.66,
                "earlyBootstrapP": 0.25337331334332835,
                "lateChi2": 8.661052631578945,
                "latePValue": 0.7315758678648367,
                "cherryPickFlag": false
            },
            {
                "epoch": 37,
                "hashedServerSeed": "e9a8a115a2b35279b31f5f6c27d7f6f253dce139649922c7cc9f308129450d05",
                "earlyChi2": 5.51,
                "earlyBootstrapP": 0.8650674662668666,
                "lateChi2": 9.317894736842105,
                "latePValue": 0.6755648555493825,
                "cherryPickFlag": false
            },
            {
                "epoch": 38,
                "hashedServerSeed": "e55c0ab23f5afb02db8a092f7bb152b27b101b3817b85476c28e0f0870a3793b",
                "earlyChi2": 5.9,
                "earlyBootstrapP": 0.841079460269865,
                "lateChi2": 7.210526315789475,
                "latePValue": 0.8433931610282805,
                "cherryPickFlag": false
            },
            {
                "epoch": 39,
                "hashedServerSeed": "b6b3f151360f476e395aebbbd3a7f20ec35a6dfed9ee0398ad4502e6cdd51d3e",
                "earlyChi2": 19.419999999999998,
                "earlyBootstrapP": 0.03798100949525238,
                "lateChi2": 15.475789473684209,
                "latePValue": 0.21644195393626298,
                "cherryPickFlag": true
            },
            {
                "epoch": 40,
                "hashedServerSeed": "c4e2a077899144e5c2492a73d82acc2fcb53f7df48ef63d6efb3b1a3de16231f",
                "earlyChi2": 11.750000000000002,
                "earlyBootstrapP": 0.29685157421289354,
                "lateChi2": 13.094736842105265,
                "latePValue": 0.362192589700163,
                "cherryPickFlag": false
            },
            {
                "epoch": 41,
                "hashedServerSeed": "5d84546255d10d0c1123f22c2794f67ebb11ace12e4eb5153dc4f9a73cd6c7ce",
                "earlyChi2": 5.64,
                "earlyBootstrapP": 0.8495752123938031,
                "lateChi2": 7.757894736842106,
                "latePValue": 0.8037523782355894,
                "cherryPickFlag": false
            },
            {
                "epoch": 42,
                "hashedServerSeed": "7ac9dc39918e9317d061cf2422f336278970c8e3185afd5b333453f324fecc4b",
                "earlyChi2": 19.419999999999998,
                "earlyBootstrapP": 0.03798100949525238,
                "lateChi2": 11.096842105263155,
                "latePValue": 0.5206380567499208,
                "cherryPickFlag": true
            },
            {
                "epoch": 43,
                "hashedServerSeed": "4fe5f8f98e9ba5a1071935bfaa571c906c9bea8264748f4be1c1290f622e3237",
                "earlyChi2": 13.310000000000002,
                "earlyBootstrapP": 0.2048975512243878,
                "lateChi2": 8.168421052631578,
                "latePValue": 0.771834198704938,
                "cherryPickFlag": false
            },
            {
                "epoch": 44,
                "hashedServerSeed": "003ea8780bae8cb57f8a8ef3ab7366eebd1b5fdd1c534922e04159c07379c058",
                "earlyChi2": 4.99,
                "earlyBootstrapP": 0.894552723638181,
                "lateChi2": 11.479999999999997,
                "latePValue": 0.48829079846512047,
                "cherryPickFlag": false
            },
            {
                "epoch": 45,
                "hashedServerSeed": "45fb83b6af146bbcd2db52ef465b08ada9cc9aa097b581ef7e2cb6438b261550",
                "earlyChi2": 11.229999999999999,
                "earlyBootstrapP": 0.3453273363318341,
                "lateChi2": 12.54736842105263,
                "latePValue": 0.40277906856339996,
                "cherryPickFlag": false
            },
            {
                "epoch": 46,
                "hashedServerSeed": "7dad9134ed94c9b9ae34c77b855ec37959cfb134ee5583890ef3e828c5abfadd",
                "earlyChi2": 9.149999999999999,
                "earlyBootstrapP": 0.5367316341829086,
                "lateChi2": 10.412631578947368,
                "latePValue": 0.5798092346768005,
                "cherryPickFlag": false
            },
            {
                "epoch": 47,
                "hashedServerSeed": "40f39ad6d65bbb52fc9126b95c29a51c63e2d04d9f33d619562df22b53753ae8",
                "earlyChi2": 2.9100000000000006,
                "earlyBootstrapP": 0.9790104947526237,
                "lateChi2": 16.816842105263152,
                "latePValue": 0.15661796175730203,
                "cherryPickFlag": false
            },
            {
                "epoch": 48,
                "hashedServerSeed": "14a1eb1739855834997ffb18517e8ead2484fa8f74099f6b561ca7a14fbf6b4b",
                "earlyChi2": 11.75,
                "earlyBootstrapP": 0.30634682658670664,
                "lateChi2": 15.202105263157897,
                "latePValue": 0.2305695559351929,
                "cherryPickFlag": false
            },
            {
                "epoch": 49,
                "hashedServerSeed": "afd860138e7a7975220a4c4653162f963302a58502f497309d86c567c1c58fd6",
                "earlyChi2": 7.199999999999999,
                "earlyBootstrapP": 0.7326336831584208,
                "lateChi2": 10.412631578947368,
                "latePValue": 0.5798092346768005,
                "cherryPickFlag": false
            },
            {
                "epoch": 50,
                "hashedServerSeed": "814ffe65662f6b13d14b91a7dbdf2dccb2b766715677913a5e17907d021b58e6",
                "earlyChi2": 9.67,
                "earlyBootstrapP": 0.47876061969015493,
                "lateChi2": 14.62736842105263,
                "latePValue": 0.26244965392324204,
                "cherryPickFlag": false
            },
            {
                "epoch": 51,
                "hashedServerSeed": "75b50e02e08ef3fe51973297de954a3ae43c527041bfdb579726b9ad27617b3f",
                "earlyChi2": 12.790000000000001,
                "earlyBootstrapP": 0.23938030984507747,
                "lateChi2": 9.783157894736842,
                "latePValue": 0.6349774781132871,
                "cherryPickFlag": false
            },
            {
                "epoch": 52,
                "hashedServerSeed": "6968cad6bbbb54b8e3c001af086df974f0adc1857ee85aaa404e4e8e771aa46e",
                "earlyChi2": 3.8200000000000003,
                "earlyBootstrapP": 0.953023488255872,
                "lateChi2": 22.618947368421054,
                "latePValue": 0.031140761023918273,
                "cherryPickFlag": false
            },
            {
                "epoch": 53,
                "hashedServerSeed": "f4a4131c7eb60abf462e7d14619a7ec5991c5398761dbac43c1399a4ad7382bc",
                "earlyChi2": 11.230000000000002,
                "earlyBootstrapP": 0.3313343328335832,
                "lateChi2": 10.193684210526316,
                "latePValue": 0.5989732851424192,
                "cherryPickFlag": false
            },
            {
                "epoch": 54,
                "hashedServerSeed": "8b4ec8d540dbaa1b9fd43df395ade19ac39102b3ce72ac0a4aafa219b9cec969",
                "earlyChi2": 6.03,
                "earlyBootstrapP": 0.8325837081459271,
                "lateChi2": 8.989473684210529,
                "latePValue": 0.7038292597244313,
                "cherryPickFlag": false
            },
            {
                "epoch": 55,
                "hashedServerSeed": "2fdb3ecebc762aa42039e4d91fa08966e228af78517c535d14d4f52f167cee1a",
                "earlyChi2": 9.02,
                "earlyBootstrapP": 0.5517241379310345,
                "lateChi2": 12.793684210526317,
                "latePValue": 0.384213319566832,
                "cherryPickFlag": false
            },
            {
                "epoch": 56,
                "hashedServerSeed": "0e54f40e3207674ba4f9d3530cd54abe2c574e206b15c019bef0bc828423eb55",
                "earlyChi2": 15.910000000000004,
                "earlyBootstrapP": 0.111944027986007,
                "lateChi2": 21.22315789473684,
                "latePValue": 0.047206605533550605,
                "cherryPickFlag": false
            },
            {
                "epoch": 57,
                "hashedServerSeed": "151e4391f3a1568c444c9c063b737f89d196a549a7737694394ea332984477ba",
                "earlyChi2": 10.580000000000002,
                "earlyBootstrapP": 0.38580709645177413,
                "lateChi2": 10.11157894736842,
                "latePValue": 0.606172432524396,
                "cherryPickFlag": false
            },
            {
                "epoch": 58,
                "hashedServerSeed": "47fec3b2d030093341f5153103e9164e59fe08442495dcc093e92723158fba70",
                "earlyChi2": 3.4299999999999997,
                "earlyBootstrapP": 0.9735132433783108,
                "lateChi2": 6.690526315789475,
                "latePValue": 0.8773691593539961,
                "cherryPickFlag": false
            },
            {
                "epoch": 59,
                "hashedServerSeed": "08db609f024a1f4ce68d2ecd76be507b1519b9673e02a46b9051702090b83352",
                "earlyChi2": 2.39,
                "earlyBootstrapP": 0.992503748125937,
                "lateChi2": 20.922105263157892,
                "latePValue": 0.0515327996045879,
                "cherryPickFlag": false
            },
            {
                "epoch": 60,
                "hashedServerSeed": "0ba5a51eb66e4c3a236075de3c56b1712708e32f9b87fc78888865ca06763acc",
                "earlyChi2": 7.07,
                "earlyBootstrapP": 0.7481259370314842,
                "lateChi2": 13.313684210526317,
                "latePValue": 0.34665903979467183,
                "cherryPickFlag": false
            },
            {
                "epoch": 61,
                "hashedServerSeed": "5c8f278e2f0831970d5da11a1f5369546ccf7d00c783126986c143f9b2b914b8",
                "earlyChi2": 8.11,
                "earlyBootstrapP": 0.6526736631684158,
                "lateChi2": 10.056842105263158,
                "latePValue": 0.6109738213733372,
                "cherryPickFlag": false
            },
            {
                "epoch": 62,
                "hashedServerSeed": "acc917c9191fd93f2eb96714658904605908c77677f49a55c86334f2f7ed062f",
                "earlyChi2": 19.03,
                "earlyBootstrapP": 0.044977511244377814,
                "lateChi2": 22.427368421052627,
                "latePValue": 0.03300000403580716,
                "cherryPickFlag": false
            },
            {
                "epoch": 63,
                "hashedServerSeed": "28ce46a4d9a072f3abbaf09df8fecb3814bae632bb97eb3df10c725fabbc03f1",
                "earlyChi2": 10.19,
                "earlyBootstrapP": 0.42978510744627685,
                "lateChi2": 8.907368421052631,
                "latePValue": 0.710821392930888,
                "cherryPickFlag": false
            },
            {
                "epoch": 64,
                "hashedServerSeed": "94d111739be44186a87c3510d7b31930b0d38a91faf357797a039887ef1ee7a4",
                "earlyChi2": 15.520000000000001,
                "earlyBootstrapP": 0.12493753123438281,
                "lateChi2": 12.32842105263158,
                "latePValue": 0.41967719917877055,
                "cherryPickFlag": false
            },
            {
                "epoch": 65,
                "hashedServerSeed": "99910c890ca8346a7290b133f22413b1c9869e9fea66939306e21843eb9e0174",
                "earlyChi2": 8.24,
                "earlyBootstrapP": 0.6216891554222889,
                "lateChi2": 9.317894736842105,
                "latePValue": 0.6755648555493825,
                "cherryPickFlag": false
            },
            {
                "epoch": 66,
                "hashedServerSeed": "c07052ba6f25c914baa8e6c06ddc367e906cca7f97215c88b25ef2d41ebc7769",
                "earlyChi2": 2.9099999999999997,
                "earlyBootstrapP": 0.984007996001999,
                "lateChi2": 28.147368421052626,
                "latePValue": 0.005263851769081063,
                "cherryPickFlag": false
            },
            {
                "epoch": 67,
                "hashedServerSeed": "e78dbec859c3d1e405193841a719bd873b272e273f5d9c47716eeaa15014ebd6",
                "earlyChi2": 17.47,
                "earlyBootstrapP": 0.07446276861569215,
                "lateChi2": 10.795789473684211,
                "latePValue": 0.5464959670681514,
                "cherryPickFlag": false
            },
            {
                "epoch": 68,
                "hashedServerSeed": "daa6095da68822c16c33f87520e3ae7f4965c2161c60b745a57f6a3335425e15",
                "earlyChi2": 9.28,
                "earlyBootstrapP": 0.5122438780609695,
                "lateChi2": 23.138947368421054,
                "latePValue": 0.02656921824408298,
                "cherryPickFlag": false
            },
            {
                "epoch": 69,
                "hashedServerSeed": "108d74eae235332bb011dcaed05df5505ca67c842f2a32016e6c9c4e55726be9",
                "earlyChi2": 7.069999999999999,
                "earlyBootstrapP": 0.7531234382808596,
                "lateChi2": 6.115789473684212,
                "latePValue": 0.9101329209058524,
                "cherryPickFlag": false
            },
            {
                "epoch": 70,
                "hashedServerSeed": "03e7edc01e9d350f9468ac2d031b6b69fe7fa7a748eeb3e826eb05914d1a2647",
                "earlyChi2": 15.520000000000001,
                "earlyBootstrapP": 0.12493753123438281,
                "lateChi2": 8.962105263157893,
                "latePValue": 0.7061637017581192,
                "cherryPickFlag": false
            },
            {
                "epoch": 71,
                "hashedServerSeed": "a4668c491432adadf5c5a239472ab19f2e45b1c328cfb2c1ba99d0e98baaa784",
                "earlyChi2": 4.859999999999999,
                "earlyBootstrapP": 0.9090454772613693,
                "lateChi2": 9.153684210526317,
                "latePValue": 0.6897507240017624,
                "cherryPickFlag": false
            },
            {
                "epoch": 72,
                "hashedServerSeed": "b5da66c62ae579960d52021744fbb2a800974ce2b59f12270c554bdfb39f9b81",
                "earlyChi2": 18.64,
                "earlyBootstrapP": 0.05247376311844078,
                "lateChi2": 3.1052631578947367,
                "latePValue": 0.9947541255727843,
                "cherryPickFlag": false
            },
            {
                "epoch": 73,
                "hashedServerSeed": "a5e5149e95df7453adad38ce4ee2457678c07f8fe7c47915cadd59549b355471",
                "earlyChi2": 7.98,
                "earlyBootstrapP": 0.6586706646676662,
                "lateChi2": 10.303157894736843,
                "latePValue": 0.5893835488258516,
                "cherryPickFlag": false
            },
            {
                "epoch": 74,
                "hashedServerSeed": "0ceac80719616dc100bab73ba0ab45a4a33b00eb12271988cd848577e044b346",
                "earlyChi2": 8.500000000000002,
                "earlyBootstrapP": 0.5982008995502249,
                "lateChi2": 7.48421052631579,
                "latePValue": 0.824028697478812,
                "cherryPickFlag": false
            },
            {
                "epoch": 75,
                "hashedServerSeed": "11412a75c7a577f66c9030dfc2c476be2b85d3fdaf3fb4c0921160e1ec12fefd",
                "earlyChi2": 13.31,
                "earlyBootstrapP": 0.21239380309845077,
                "lateChi2": 5.07578947368421,
                "latePValue": 0.9553994774007851,
                "cherryPickFlag": false
            },
            {
                "epoch": 76,
                "hashedServerSeed": "d8835fc49bf278565fce1f9f4438d93c4b9f8b621cf6054fd95075cee196f3ec",
                "earlyChi2": 6.03,
                "earlyBootstrapP": 0.8325837081459271,
                "lateChi2": 6.745263157894739,
                "latePValue": 0.8739783028407989,
                "cherryPickFlag": false
            },
            {
                "epoch": 77,
                "hashedServerSeed": "8b8e55e4f6828ce6e916980b5d8447c9da7aa9fa786d16b5bc4aefa27cd34337",
                "earlyChi2": 8.24,
                "earlyBootstrapP": 0.6216891554222889,
                "lateChi2": 7.210526315789473,
                "latePValue": 0.8433931610282808,
                "cherryPickFlag": false
            },
            {
                "epoch": 78,
                "hashedServerSeed": "71fd83c5023106c38505f4bcc086be1e1d8e1ba012b1faf5123d53ebdbb23ab8",
                "earlyChi2": 12.4,
                "earlyBootstrapP": 0.25837081459270367,
                "lateChi2": 9.56421052631579,
                "latePValue": 0.6541322993154927,
                "cherryPickFlag": false
            },
            {
                "epoch": 79,
                "hashedServerSeed": "c3926929e2cb52c5cfd88d8a77851484bb231b745a4f72307ab33493f49500f2",
                "earlyChi2": 3.56,
                "earlyBootstrapP": 0.9590204897551224,
                "lateChi2": 15.338947368421051,
                "latePValue": 0.22342165172450312,
                "cherryPickFlag": false
            },
            {
                "epoch": 80,
                "hashedServerSeed": "fbfb2ff41c5284ccd5ec0b48cf9b5ac9d594ec555d79cd4990ae4312b8847bc0",
                "earlyChi2": 13.830000000000002,
                "earlyBootstrapP": 0.1854072963518241,
                "lateChi2": 4.008421052631578,
                "latePValue": 0.9832839558059524,
                "cherryPickFlag": false
            },
            {
                "epoch": 81,
                "hashedServerSeed": "16a6723eb87d14459fd661f460ce1dcb92eeed3d07dad502e8736353345ed1e0",
                "earlyChi2": 12.4,
                "earlyBootstrapP": 0.25837081459270367,
                "lateChi2": 12.465263157894736,
                "latePValue": 0.40907329100825407,
                "cherryPickFlag": false
            },
            {
                "epoch": 82,
                "hashedServerSeed": "d2a32747368505cb40c14e55afa75ab25e772ec023a185b47fc275c1a75f9ef0",
                "earlyChi2": 6.550000000000001,
                "earlyBootstrapP": 0.7871064467766117,
                "lateChi2": 9.974736842105266,
                "latePValue": 0.6181770729639016,
                "cherryPickFlag": false
            },
            {
                "epoch": 83,
                "hashedServerSeed": "e6f1e8e9babdea45a12396778636dd7e89447559203616bbfc790b15f14842ae",
                "earlyChi2": 8.5,
                "earlyBootstrapP": 0.6081959020489756,
                "lateChi2": 19.33473684210526,
                "latePValue": 0.08076415515281299,
                "cherryPickFlag": false
            },
            {
                "epoch": 84,
                "hashedServerSeed": "1613761e6adef02df6cb54717b2c1ad68c4b8f90866b3ebc072aa8b054b6571b",
                "earlyChi2": 7.2,
                "earlyBootstrapP": 0.7256371814092953,
                "lateChi2": 20.402105263157896,
                "latePValue": 0.059851665875050086,
                "cherryPickFlag": false
            },
            {
                "epoch": 85,
                "hashedServerSeed": "4b7cbcd35a09d51da4c1cdf3cf1a7591219a060dd2490e8da270e9d2af807786",
                "earlyChi2": 12.27,
                "earlyBootstrapP": 0.2773613193403298,
                "lateChi2": 13.778947368421054,
                "latePValue": 0.31504655238633694,
                "cherryPickFlag": false
            },
            {
                "epoch": 86,
                "hashedServerSeed": "925bfc2f070c649899e371214ad30d34b3f7fec661c6849b5f8d1ba8db714845",
                "earlyChi2": 6.029999999999999,
                "earlyBootstrapP": 0.8385807096451774,
                "lateChi2": 12.355789473684212,
                "latePValue": 0.4175452329311953,
                "cherryPickFlag": false
            },
            {
                "epoch": 87,
                "hashedServerSeed": "aeee35a6edd03ac9596cd0314858a4685436ac076ae92d37b70e5abfd55ece93",
                "earlyChi2": 10.579999999999998,
                "earlyBootstrapP": 0.3938030984507746,
                "lateChi2": 14.873684210526317,
                "latePValue": 0.24841713103761642,
                "cherryPickFlag": false
            },
            {
                "epoch": 88,
                "hashedServerSeed": "4e59ca0e67ff8b2564dfaf1526bd89566cef3fdbf895751df5dfbf25b25c2851",
                "earlyChi2": 13.440000000000001,
                "earlyBootstrapP": 0.20089955022488756,
                "lateChi2": 3.9263157894736835,
                "latePValue": 0.9847295656298214,
                "cherryPickFlag": false
            },
            {
                "epoch": 89,
                "hashedServerSeed": "b570a312332bec105fa3b5e87030dc76afeb2bee8f00a16e737bb60f9fee1a51",
                "earlyChi2": 5.51,
                "earlyBootstrapP": 0.8650674662668666,
                "lateChi2": 20.32,
                "latePValue": 0.061269648580222213,
                "cherryPickFlag": false
            },
            {
                "epoch": 90,
                "hashedServerSeed": "47de729a4069c101254c21e776cc8083542f1c90a1081a4e11b699df29c61957",
                "earlyChi2": 11.23,
                "earlyBootstrapP": 0.34182908545727136,
                "lateChi2": 11.753684210526314,
                "latePValue": 0.46565894689781906,
                "cherryPickFlag": false
            },
            {
                "epoch": 91,
                "hashedServerSeed": "a82e71946bd4cec960821ab4f3f9e5fc5703b617085f19da8b513f075b5523b5",
                "earlyChi2": 12.270000000000001,
                "earlyBootstrapP": 0.2673663168415792,
                "lateChi2": 10.823157894736841,
                "latePValue": 0.5441318808139697,
                "cherryPickFlag": false
            },
            {
                "epoch": 92,
                "hashedServerSeed": "0f18c016eb1e8c4aa6c344ee945ab278c74a7def8b45da70989bbd18dbf28dd3",
                "earlyChi2": 7.070000000000001,
                "earlyBootstrapP": 0.7376311844077961,
                "lateChi2": 5.568421052631579,
                "latePValue": 0.9362582010087755,
                "cherryPickFlag": false
            },
            {
                "epoch": 93,
                "hashedServerSeed": "4b211dd6fc332f6ea33176e8b816bec7b373bd318dd6264a7e7140bb3c9583e6",
                "earlyChi2": 7.070000000000001,
                "earlyBootstrapP": 0.7376311844077961,
                "lateChi2": 10.440000000000001,
                "latePValue": 0.5774186916170454,
                "cherryPickFlag": false
            },
            {
                "epoch": 94,
                "hashedServerSeed": "19524dd066187fa12c8ec4694069a6fd07f98be01de734428e83124690c54036",
                "earlyChi2": 8.76,
                "earlyBootstrapP": 0.5627186406796602,
                "lateChi2": 8.031578947368422,
                "latePValue": 0.7826577507045539,
                "cherryPickFlag": false
            },
            {
                "epoch": 95,
                "hashedServerSeed": "f33e7dab9b1d31a0182e8b082261fe996438660a75aa851030e405f61dbae10b",
                "earlyChi2": 9.67,
                "earlyBootstrapP": 0.47876061969015493,
                "lateChi2": 11.863157894736842,
                "latePValue": 0.45673133896459417,
                "cherryPickFlag": false
            },
            {
                "epoch": 96,
                "hashedServerSeed": "a9f9c99c9115159a510ff3edb145b920ce365d89dcc64a5ea0e12ed96f47b43e",
                "earlyChi2": 10.190000000000001,
                "earlyBootstrapP": 0.4207896051974013,
                "lateChi2": 5.705263157894738,
                "latePValue": 0.9302046445198079,
                "cherryPickFlag": false
            },
            {
                "epoch": 97,
                "hashedServerSeed": "025852657543a252de0c1ec914f0057272cd75decbda5d0a2075c964a1f97ce7",
                "earlyChi2": 4.47,
                "earlyBootstrapP": 0.9300349825087456,
                "lateChi2": 11.096842105263159,
                "latePValue": 0.5206380567499198,
                "cherryPickFlag": false
            },
            {
                "epoch": 98,
                "hashedServerSeed": "3017e91e7535178112ae55ab37bb853e0997271bfd174095ffeccdaf9eec01b0",
                "earlyChi2": 12.270000000000001,
                "earlyBootstrapP": 0.2673663168415792,
                "lateChi2": 9.400000000000002,
                "latePValue": 0.6684384852977379,
                "cherryPickFlag": false
            },
            {
                "epoch": 99,
                "hashedServerSeed": "158fcba69cd157dfb65f4511b6c25b4203a4d9caf12705d16c2e8a4ed2de2365",
                "earlyChi2": 11.360000000000001,
                "earlyBootstrapP": 0.3218390804597701,
                "lateChi2": 12.355789473684212,
                "latePValue": 0.4175452329311953,
                "cherryPickFlag": false
            },
            {
                "epoch": 100,
                "hashedServerSeed": "7a4f1d547c11c16c629b5cad42c8c81da5fc8871e90e20ced43fc8945dd9d4f3",
                "earlyChi2": 10.320000000000002,
                "earlyBootstrapP": 0.39480259870064965,
                "lateChi2": 30.33684210526316,
                "latePValue": 0.002484070241297598,
                "cherryPickFlag": false
            },
            {
                "epoch": 101,
                "hashedServerSeed": "bff646a192dcdf34a772d213a39fe915d1c2d5ee1cc7d435db62629e3bb0ab33",
                "earlyChi2": 13.83,
                "earlyBootstrapP": 0.1904047976011994,
                "lateChi2": 11.999999999999998,
                "latePValue": 0.4456796413646098,
                "cherryPickFlag": false
            },
            {
                "epoch": 102,
                "hashedServerSeed": "80ad991ea4bdc35c96c703c361dc32bec3b95eeadc3ca96be4a83a6c3934193b",
                "earlyChi2": 17.86,
                "earlyBootstrapP": 0.06746626686656672,
                "lateChi2": 5.376842105263158,
                "latePValue": 0.9441942352630204,
                "cherryPickFlag": false
            },
            {
                "epoch": 103,
                "hashedServerSeed": "ca4f4cc1a52dd517f9cdb820214847b07dfe5499b5d95f73da2ec57c9d486027",
                "earlyChi2": 14.22,
                "earlyBootstrapP": 0.17391304347826086,
                "lateChi2": 13.888421052631577,
                "latePValue": 0.30789022927658316,
                "cherryPickFlag": false
            },
            {
                "epoch": 104,
                "hashedServerSeed": "ff8a9714db9566fc0f64d754ab29e2356bed21c2ac0fbcaa2f37533ca4554b04",
                "earlyChi2": 12.789999999999997,
                "earlyBootstrapP": 0.24587706146926536,
                "lateChi2": 11.069473684210525,
                "latePValue": 0.5229743558807719,
                "cherryPickFlag": false
            },
            {
                "epoch": 105,
                "hashedServerSeed": "ee9f5bc491be5cb4e9edbdd3e464c220b6b9a6a288686c9ff9f06a695bfbc81b",
                "earlyChi2": 7.070000000000001,
                "earlyBootstrapP": 0.7376311844077961,
                "lateChi2": 14.326315789473686,
                "latePValue": 0.28035753289852006,
                "cherryPickFlag": false
            },
            {
                "epoch": 106,
                "hashedServerSeed": "6c4baf0ccc590ca7262d8c96bbb56f4f036eb46dcc88c70fc6bc496ec3c6ac86",
                "earlyChi2": 16.3,
                "earlyBootstrapP": 0.10794602698650675,
                "lateChi2": 13.149473684210523,
                "latePValue": 0.35827060094429297,
                "cherryPickFlag": false
            },
            {
                "epoch": 107,
                "hashedServerSeed": "3ea4964c5bb6f44823863d8acc2269d904154f74a41e64d7e93db80d431bc2fc",
                "earlyChi2": 7.720000000000001,
                "earlyBootstrapP": 0.670664667666167,
                "lateChi2": 14.052631578947368,
                "latePValue": 0.29735995410537386,
                "cherryPickFlag": false
            },
            {
                "epoch": 108,
                "hashedServerSeed": "d9766b0f29b86829dd2e4a0b7337132f64a1dcf6a6d2c083ea45e0406eb8bc5d",
                "earlyChi2": 9.280000000000001,
                "earlyBootstrapP": 0.5062468765617192,
                "lateChi2": 12,
                "latePValue": 0.44567964136461025,
                "cherryPickFlag": false
            },
            {
                "epoch": 109,
                "hashedServerSeed": "6466deb82ee71c753eb1dd194bc2f07dfb3cd8f5552e5b6623c00e88352fbd00",
                "earlyChi2": 13.96,
                "earlyBootstrapP": 0.18040979510244878,
                "lateChi2": 6.854736842105265,
                "latePValue": 0.867061898163364,
                "cherryPickFlag": false
            },
            {
                "epoch": 110,
                "hashedServerSeed": "fec23d2f73f9dff93265b7619eaa814319990fd821f1adfdd7f12c959e2c279e",
                "earlyChi2": 4.47,
                "earlyBootstrapP": 0.9300349825087456,
                "lateChi2": 14.572631578947368,
                "latePValue": 0.26564364098893467,
                "cherryPickFlag": false
            },
            {
                "epoch": 111,
                "hashedServerSeed": "017ec017452b452a1f723c9d1cfb4c3de0e5ccfd2085e49f4461d1e2c0e1c649",
                "earlyChi2": 8.63,
                "earlyBootstrapP": 0.5822088955522239,
                "lateChi2": 6.0610526315789475,
                "latePValue": 0.9129731695528024,
                "cherryPickFlag": false
            },
            {
                "epoch": 112,
                "hashedServerSeed": "74ecba904058fa1578cd64017f7ab52e2304f019e888b0ccf9c3c14fd76d33be",
                "earlyChi2": 6.55,
                "earlyBootstrapP": 0.8010994502748626,
                "lateChi2": 10.27578947368421,
                "latePValue": 0.5917797477439561,
                "cherryPickFlag": false
            },
            {
                "epoch": 113,
                "hashedServerSeed": "6340a924bcf18f61e35df6f7d07293f21c726550f5eafacb425cefd12801b9ed",
                "earlyChi2": 6.939999999999999,
                "earlyBootstrapP": 0.7701149425287356,
                "lateChi2": 16.214736842105264,
                "latePValue": 0.181597514404508,
                "cherryPickFlag": false
            },
            {
                "epoch": 114,
                "hashedServerSeed": "eafe058797e3a979e0f5067c12f607832c86e71a65872e01454add5b14c800ec",
                "earlyChi2": 4.99,
                "earlyBootstrapP": 0.894552723638181,
                "lateChi2": 7.812631578947369,
                "latePValue": 0.7995958262758104,
                "cherryPickFlag": false
            },
            {
                "epoch": 115,
                "hashedServerSeed": "18f79035b80e0519b408ed24a934afe4e76a1caed860451c79c36b4c84a4ff1b",
                "earlyChi2": 10.06,
                "earlyBootstrapP": 0.44427786106946526,
                "lateChi2": 8.031578947368422,
                "latePValue": 0.7826577507045539,
                "cherryPickFlag": false
            },
            {
                "epoch": 116,
                "hashedServerSeed": "9cd7aac7f79999cd3ef4132fea5782da523e5a9dd80ae79aa773c32b86e9132a",
                "earlyChi2": 5.119999999999999,
                "earlyBootstrapP": 0.8865567216391804,
                "lateChi2": 12.49263157894737,
                "latePValue": 0.40696946899381603,
                "cherryPickFlag": false
            },
            {
                "epoch": 117,
                "hashedServerSeed": "991ae570263c3b0be8258d08b04c2b0d1dd93c4a0602203097ad883c38e83448",
                "earlyChi2": 7.720000000000001,
                "earlyBootstrapP": 0.670664667666167,
                "lateChi2": 9.372631578947368,
                "latePValue": 0.6708161521231278,
                "cherryPickFlag": false
            },
            {
                "epoch": 118,
                "hashedServerSeed": "bbc0efb84b29b9acc9b5554c34a27f9a101283030dce5ad70c6a15ca98f5f983",
                "earlyChi2": 11.750000000000002,
                "earlyBootstrapP": 0.29685157421289354,
                "lateChi2": 11.999999999999998,
                "latePValue": 0.4456796413646098,
                "cherryPickFlag": false
            },
            {
                "epoch": 119,
                "hashedServerSeed": "e445610de7d10bf4c1fc0ec64f868fd2c3789f2cd7dd64dea774df0b5590e6f3",
                "earlyChi2": 5.51,
                "earlyBootstrapP": 0.8650674662668666,
                "lateChi2": 11.042105263157891,
                "latePValue": 0.5253137458279609,
                "cherryPickFlag": false
            }
        ]
    }
}; },
  "src/config.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — game configuration.
 *
 * Every value here was confirmed from the live game surface and/or read off the
 * 6,000-hand captured dataset (see verify.ts rules steps and live-parity-testing.md).
 * There is no external multiplier table to pin (blackjack is rule-driven, not
 * table-driven); the side-bet paytables are LIQD client constants, cross-checked
 * against live side-bet wins in the capture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlackjack = exports.suitOf = exports.rankOf = exports.TWENTY_ONE_PLUS_THREE = exports.PERFECT_PAIRS = exports.PASS2_LATE_NONCES = exports.PASS2_TOTAL_NONCES = exports.PASS2_EARLY_NONCES = exports.PASS2_P0 = exports.PASS2_ALPHA = exports.FIRST_CARD_DF = exports.RANKS = exports.SIM_SD_PER_ROUND = exports.SIM_PASS1_ROUNDS = exports.SIM_BASE_ROUNDS = exports.EXPECTED_HANDS = exports.EXPECTED_EPOCH_SIZE = exports.EXPECTED_SEEDS = exports.NOMINAL_HOUSE_EDGE = exports.SHOE_SIZE = exports.DECKS = exports.RNG_BRANCH_SHA256 = exports.ATTACK_SHA256 = exports.EXACT_RTP_SHA256 = exports.SIMULATION_HTML_SHA256 = exports.SIMULATION_SHA256 = exports.DATASET_SHA256 = void 0;
exports.cherryPickFlag = cherryPickFlag;
exports.cardValueFromRank = cardValueFromRank;
exports.handValue = handValue;
/** SHA-256 of the captured dataset — the verifier aborts if this does not match. */
exports.DATASET_SHA256 = 'c2a28c5164a546105963ffb4ff8e7c422a68802df47afcdcfa0b4fdbad1fdbf7';
/**
 * SHA-256 of the committed simulation artifact (`outputs/simulation-results.json`).
 * Steps 17–19 score whatever that file contains, so the repo pins it. The pin is reconciled in
 * SCORED Step 25 (Artifact Hash Integrity) — presence AND hash, both hard FAILs. It used to be
 * enforced by `tests/verify.ts` aborting the process before any step printed, which made a
 * substituted artifact indistinguishable from a crash to a gate harness, and made a DELETED
 * artifact skip the guard entirely. `npm run test:full` regenerates the file with fresh seeds
 * and sets SIM_FRESH=1, which switches the hash half of the guard (never the presence half) to
 * record-and-label instead of enforce. Scope note: this pin protects third parties against artifact drift/substitution; it
 * cannot make the repo self-proving against its own publisher, who could re-pin at will.
 */
exports.SIMULATION_SHA256 = '782c056164982d76879225c2e4059d1d7ee29f176e095ee78105386759574686';
/**
 * SHA-256 of the committed convergence chart (`outputs/rtp-convergence.html`). The chart and the
 * JSON are two outputs of ONE `npm run simulate` and must move together — pinning only the JSON
 * let a stale chart (labelling a pre-fix figure "AUTHORITATIVE") survive a full gate. Reconciled
 * in scored Step 25 alongside the JSON pin, with the same SIM_FRESH=1 record-and-label bypass on
 * the hash (its PRESENCE is required unconditionally).
 */
exports.SIMULATION_HTML_SHA256 = '321d58a6609efb00e52c69c56c5d0ecc245d6da83f3a06f70c07a6c2da827c66';
/**
 * SHA-256 of the committed exact-RTP artifact (`outputs/exact-rtp.json`).
 *
 * This file is fully deterministic — `npm run rtp` regenerates it byte-identically — so the pin
 * needs no `SIM_FRESH`-style bypass: it only ever moves when the solver itself changes, which is
 * exactly when a human should have to look.
 *
 * TWO guards, deliberately, because they fail for different reasons:
 *   - `tests/blackjack/exactSolverTests.ts` re-derives the artifact from live solves via
 *     `buildExactArtifact()` and deep-compares every field. That proves the committed NUMBERS are
 *     the real solve, which a hash can never do — but it lives in mocha, so the scored `npm run
 *     verify` path could not see a forged artifact at all.
 *   - This pin, reconciled in scored Step 25 beside the other artifact pins, binds the artifact
 *     in the SCORED run at zero cost. Added after the forged-artifact battery (Gate 10 F4) planted
 *     self-consistent nonsense in this file and the verifier scored 31/31 without reading it.
 *     Round 3 moved it out of verify.ts's fail-fast abort and into the scored step, and added the
 *     PRESENCE assertion — deleting this file used to produce 31/31 Full Pass, exit 0.
 */
exports.EXACT_RTP_SHA256 = 'db26864d6a7272cbc069e85a961b231b3937332a291822215612dc79060a5fff';
/**
 * SHA-256 of `outputs/cherry-pick-attack.json` — the measured return-based seed grind against
 * this audit's own Step-19 detector (`npm run attack`, src/cherry-pick-attack.ts).
 *
 * It is the producing artifact for every figure the report quotes about cherry-pick DETECTION
 * POWER, so it is pinned like any other. Deterministic by construction — candidate and bootstrap
 * seeds are SHA-256 of fixed labels and the file carries no timestamp — so `npm run attack`
 * reproduces it byte-for-byte and the pin needs no SIM_FRESH-style bypass.
 */
exports.ATTACK_SHA256 = 'd69da9086664be838677cfc4da146b66e56b69f00f1d755b4a8d38d0ef08d4ad';
/**
 * SHA-256 of `outputs/rng-branch-coverage.json` — which paths of the draw primitive the capture
 * actually exercised (`npm run branches`, src/rng-branch-audit.ts). Producing artifact for the
 * "the rejection branch is ASSUMED, not witnessed" figures in rng-algorithm-analysis.md.
 * Deterministic: it replays the committed dataset and evaluates closed forms.
 */
exports.RNG_BRANCH_SHA256 = 'eb2c74a1ecf84d3dbf3c1cc3a490b9c04ad1a24d201c4f58efc4403bbacb4593';
exports.DECKS = 8;
exports.SHOE_SIZE = exports.DECKS * 52; // 416
exports.NOMINAL_HOUSE_EDGE = 0.01; // internal config field houseEdge=1.00% (NOT the surface figure: the game surface advertises 0.48% [E16])
// ─────────────────────────────────────────────────────────────────────────────
// POPULATION PINS (G-BIND). The audit's population is declared HERE, in code, and
// never read out of the artifact being scored.
//
// WHY. Two independent Stage 8 reviewers, on 2026-09-09, ran the same attack against
// this repo: delete one epoch (50 rounds + its `seeds[]` record) and decrement
// `meta.phases.F.hands` by 50. Every count the suite checked — `seeds.length`,
// `bets.length`, `meta.plannedTotal`, `meta.epochSize`, `meta.phases[*].hands` — was read
// from INSIDE the file under test, so shrinking the data and doctoring the header left the
// file internally consistent: `56 passing` (the suite's size on 2026-09-09 — a historical record
// of that run, NOT the current test count; take that from your own `npx mocha`), `31/31`,
// PROVABLY FAIR — Full Pass, exit 0,
// with Step 1 printing "119/119 epochs" and Step 6 "5950/5950 hands". The SHA-256 pin does
// not help — it proves the bytes have not moved since WE pinned them, not that the file is
// the capture. A row COUNT is not an identity.
//
// `meta.plannedTotal`, `meta.progress.bets`, `meta.progress.seeds` and `seeds[].nonceEnd`
// were, before this, present in the dataset and read by NOTHING (grep: `nonceEnd` appeared
// only in `src/types.ts`). They are now all asserted against the constants below — Steps 4
// and 5 — so a doctored header is a contradiction rather than a dead field.
//
// These three numbers are the capture plan, fixed at Phase 0 and reproduced in MANIFEST.md.
// Changing one is a deliberate act that a human has to perform in source, in a diff.
// ─────────────────────────────────────────────────────────────────────────────
/** Epochs (server-seed rotations) the capture plan declares. */
exports.EXPECTED_SEEDS = 120;
/** Rounds served per epoch before rotation. */
exports.EXPECTED_EPOCH_SIZE = 50;
/** Total captured rounds. 120 × 50 = 6,000 — the population every headline figure rests on. */
exports.EXPECTED_HANDS = exports.EXPECTED_SEEDS * exports.EXPECTED_EPOCH_SIZE;
// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION SHAPE PINS (G-BIND, second half).
//
// The Monte-Carlo tolerance used to be read from the artifact it gates:
// `se = 1.15 / sqrt(rounds)` with `rounds` taken from `outputs/simulation-results.json`,
// in both scored Step 17 and the mocha 3σ anchor. A reviewer forged the artifact to claim
// 1,000,000 rounds and 99.20% RTP, re-pinned SIMULATION_SHA256, and Step 17 printed
// `[PASS] … simulation 0.8000% over 1,000,000 rounds (±0.1150 pp 1σ) → 2.72σ, limit 3σ`
// — a 5.5× wider gate, bought by claiming fewer rounds, missing the true edge by 0.31 pp.
//
// The round counts are therefore pinned beside the hash. σ is computed from the PINNED
// count, so a claimed-smaller run cannot widen its own acceptance window, and the artifact's
// own `rounds` must equal the pin or the step hard-FAILs.
// ─────────────────────────────────────────────────────────────────────────────
/** Rounds in the committed base-game fair-shuffle Monte-Carlo (`baseGame.rounds`). */
exports.SIM_BASE_ROUNDS = 30000000;
/** Rounds in the committed Pass-1 real-shoe fairness run (`pass1_fresh_seeds.rounds`). */
exports.SIM_PASS1_ROUNDS = 500000;
/** Per-round SD of the per-initial-bet loss, measured 1.146718922176392, rounded up. */
exports.SIM_SD_PER_ROUND = 1.15;
/**
 * Card ranks (A..K). An UNPOOLED first-card uniformity χ² has RANKS−1 = 12 degrees of freedom.
 *
 * Bin pooling matters here and is easy to get wrong: `chiSquaredTest` (src/stats.ts) merges the
 * end bins while their expected count is below 5. Pass 1 runs 500,000 rounds (expected 38,461
 * per rank) and Pass 2's LATE window 950 nonces (expected 73), so neither pools and both are
 * df 12. Pass 2's EARLY window is only 50 nonces (expected 3.85), so it pools to 11 bins on
 * df 10 — which is why Step 19 binds the early half by reproducing the raw χ² from the seeds
 * rather than by pinning a df.
 */
exports.RANKS = 13;
/**
 * Degrees of freedom for the first-card rank χ². DERIVED from RANKS, never read from the
 * artifact: a reviewer set `firstCardChi2=9999, firstCardDf=100000, firstCardPValue=1`,
 * re-pinned, and Step 18 printed "RECOMPUTED … p=1.0000" and PASSed — because the step
 * recomputed p from a df the artifact supplied.
 */
exports.FIRST_CARD_DF = exports.RANKS - 1;
/**
 * Pass-2 cherry-pick significance level. A seed flags when its early-window (served
 * nonces 0..49) first-card χ² sits in the top α of the bootstrap null AND its late window
 * does not, so the per-seed flag probability under the null is α(1−α) = 0.0475.
 *
 * Step 19 previously computed that probability as `expectedFlagsByChance / seeds_tested`,
 * both artifact fields: setting `cherryPickFlags=120, expectedFlagsByChance=120` made
 * p₀ = 1, the survival probability 1, and the step PASSed on a dataset where every single
 * epoch had flagged. p₀ is now this declared constant and nothing else.
 */
exports.PASS2_ALPHA = 0.05;
/** Per-seed flag probability under the null: α × (1 − α). */
exports.PASS2_P0 = exports.PASS2_ALPHA * (1 - exports.PASS2_ALPHA);
/** Served window scored by the Pass-2 early statistic — nonces 0..49, the rounds actually dealt. */
exports.PASS2_EARLY_NONCES = exports.EXPECTED_EPOCH_SIZE;
/**
 * Total nonces derived per seed by the Pass-2 experiment: the served window plus the LATE control
 * window (nonces 50..999, 950 of them). Declared here rather than left as a local in
 * `src/simulate.ts` because `src/cherry-pick-attack.ts` has to score the SAME two windows — see
 * `cherryPickFlag` below.
 */
exports.PASS2_TOTAL_NONCES = 1000;
/** Nonces in the late control window: 950, expected count per rank 73, so no bin pooling (df 12). */
exports.PASS2_LATE_NONCES = exports.PASS2_TOTAL_NONCES - exports.PASS2_EARLY_NONCES;
/**
 * THE cherry-pick flag predicate. One definition, three callers.
 *
 * A seed flags when its early (served) window is extreme under the bootstrap null AND its late
 * control window is not — an early-only excess, which is the shape a selected seed would have.
 * Both halves matter: the conjunction is why the per-seed null probability is α(1−α) = PASS2_P0
 * and not α.
 *
 * ROUND-4 QA-04. This used to be written out three times: in `src/simulate.ts` (Pass 2, which
 * produced the pinned artifact), in `tests/steps/simulation.ts` (scored Step 19, which recomputes
 * the flag count from the artifact's rows), and in `src/cherry-pick-attack.ts` — where the third
 * copy had drifted. The attack script scored its selected blocks on `earlyP < α` ALONE and then
 * labelled that "Step 19", reporting a chance rate of 120 × α = 6.0 and a survival probability
 * computed at p₀ = α. Both numbers describe a detector Step 19 does not implement. The predicate
 * and the null parameter now live here and nothing restates them.
 */
function cherryPickFlag(earlyP, lateP) {
    return earlyP < exports.PASS2_ALPHA && lateP >= exports.PASS2_ALPHA;
}
// NOTE: the enforced rule set is NOT a single object here. Each consumer carries its own
// rule constants — the exact solver (`src/exact-play.ts` LIQD_RULES), the simulator
// (`src/simulate.ts`), the payout evaluator (`tests/steps/payouts.ts`), and the rational
// oracle (`anchor/oracle.py`) — and each is exercised by the verification suite. A former
// `RULES` object lived here but nothing imported it, so it could drift from the rules the
// code actually applies; it was removed to avoid pointing the reader at dead code.
/** Perfect Pairs side-bet paytable (payout-to-1). LIQD client constants. */
exports.PERFECT_PAIRS = {
    PERFECT_PAIR: 25, // same rank + same suit
    COLORED_PAIR: 13, // same rank + same colour, different suit
    MIXED_PAIR: 6, // same rank, different colour
};
/** 21+3 side-bet paytable (payout-to-1) on the player's two cards + dealer upcard. */
exports.TWENTY_ONE_PLUS_THREE = {
    SUITED_THREE_OF_A_KIND: 100,
    STRAIGHT_FLUSH: 40,
    THREE_OF_A_KIND: 30,
    STRAIGHT: 10,
    FLUSH: 5,
};
/** Card value: A=11 (soft), 10/J/Q/K=10, else pip. rank is 1..13 (1=A..13=K). */
function cardValueFromRank(rank) {
    return rank === 1 ? 11 : rank >= 10 ? 10 : rank;
}
const rankOf = (card) => Number(card.split(':')[1]);
exports.rankOf = rankOf;
const suitOf = (card) => card.split(':')[0];
exports.suitOf = suitOf;
/** Hand total with soft-ace reduction. */
function handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        const v = cardValueFromRank((0, exports.rankOf)(c));
        total += v;
        if (v === 11)
            aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return { total, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;
exports.isBlackjack = isBlackjack;

  },
  "src/exact-play.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — exact EV solver, parameterised on the shoe model.
 *
 * One engine, two modes:
 *   {kind:'infinite'}          — each draw independent at 1/13 (4/13 for T).
 *                                Exact for a with-replacement RNG that picks `value % 52`.
 *   {kind:'finite', decks: 8}  — a real 416-card shoe dealt WITHOUT replacement,
 *                                reshuffled every hand. Exact for LIQD, whose
 *                                RNG is a Fisher-Yates shuffle over 8 decks.
 *
 * and two strategies:
 *   'TD' — actions read from src/strategy.ts, the table simulate.ts plays.
 *          This is the simulation's exact target.
 *   'CD' — actions chosen by argmax at every state (composition-dependent
 *          optimal). The true optimal floor, and the independent check on the
 *          table: sim and solver share strategy.ts and could share a bug in it,
 *          but CD ignores the table entirely.
 *
 * ── The split EV: one scoped derivation, and what it does and does not assume ──
 *
 * The identity this solver uses for a split is
 *
 *     EV_split(x,x vs u) = 2 × EV_hand(start = [x], up = u, comp − {x,x,u})
 *
 * Round-4 QA-06 replaced two conflicting paragraphs here — one asserting the identity was
 * "exact, not an approximation", the next hedging it as an approximation with no stated error
 * bound. Neither is a derivation, and agreement with `anchor/oracle.py` cannot settle it: that
 * oracle plays splits SEQUENTIALLY against a physically depleted shoe, but the two engines were
 * written by the same team, so the argument has to stand on its own. It is set out here with its
 * assumptions named, and the numerical results are unchanged.
 *
 * ASSUMPTIONS, in the order they are used:
 *
 *   A1. NO RE-SPLIT. LIQD splits to two hands only, so the number of hands is fixed at 2 and
 *       there is no branching over how many hands exist. This is a confirmed rule of the game
 *       (and, where it is not directly observed, a disclosed limitation — see L5); it is not a
 *       modelling convenience.
 *   A2. FIXED, TOTAL-DEPENDENT STRATEGY, and the INFORMATION each hand may use. Both hands are
 *       played by the same policy read from `src/strategy.ts`, whose argument is (own total,
 *       soft/hard, dealer upcard). No decision on the second hand may depend on which cards the
 *       first hand drew. This is what makes the second hand's decision rule identical to the
 *       first's, and it is a MODELLING CHOICE that matches the headline figure's definition
 *       (basic strategy), not an unavoidable truth about blackjack.
 *   A3. EXCHANGEABILITY of the shoe. In a shuffled shoe, the cards dealt after any stopping time
 *       are exchangeable with the cards dealt first, so — under A2 — the second hand faces the
 *       same predictive distribution over its next card as the first hand did. The two hands are
 *       CORRELATED (shared dealer, shared shoe), but correlation does not move the expectation of
 *       a SUM: E[X₁ + X₂] = E[X₁] + E[X₂] holds without independence, and A2 plus A3 give
 *       E[X₂] = E[X₁]. That is the whole of the "× 2".
 *   A4. HOLE-CARD CONDITIONING. Under peek/OBO with upcard A or T, the hole is a single unseen
 *       card restricted to the non-natural ranks. Its posterior stays proportional to the current
 *       unseen counts over those ranks whatever the player draws (the draw likelihoods cancel),
 *       so composition remains sufficient state and the hole is mixed over only at settlement.
 *       See the section below.
 *
 * WHAT IS EXACT AND WHAT IS NOT, kept separate.
 *
 *   • The HEADLINE model is TOTAL-DEPENDENT over a finite 8-deck shoe. Within that model the
 *     identity above is EXACT: A1 removes the branching, A2 fixes the policy, A3 equates the two
 *     hands' expectations, and linearity of expectation does the rest. `edgePerInitialBet` and
 *     `edgePerTotalWagered` are exact values OF THIS MODEL, computed by dynamic programming over
 *     the shoe composition with no sampling error.
 *   • A COMPOSITION-DEPENDENT model is a different model. There, a second hand that could see
 *     the first hand's cards would sometimes deviate, so 2 × EV_hand is a LOWER BOUND on an
 *     optimal composition-dependent split rather than an identity. This solver does not claim
 *     that model's value, and the CD mode it does offer is a coarse diagnostic on the strategy
 *     table (see 'CD' above), not a bound on the split residual.
 *   • THE ERROR THIS AUDIT DOES NOT BOUND: the difference between the two models on split rounds.
 *     No error bound is asserted for it and none is derived. What is stated instead is scope —
 *     splits are ~2.5 % of rounds, and every published figure is labelled as the total-dependent
 *     basic-strategy edge, which is also the convention the external Wizard of Odds anchor uses.
 *
 * CORROBORATION, at its real strength: `anchor/oracle.py` reaches the same numbers for specified
 * split cases by SEQUENTIAL physical play (a concrete hole card, a genuinely depleted shoe, no
 * conditional probability anywhere). That is evidence the identity is being APPLIED correctly and
 * that the arithmetic is right. It is not independent evidence for A2 or A3, because the oracle
 * assumes the same policy and the same information rule. Recorded as L13.
 *
 * ── Peek, handled exactly ─────────────────────────────────────────────────────
 * With upcard u in {A,T} the hole card is a single unseen card constrained to the
 * non-natural ranks. The hole-card posterior stays proportional to the current
 * unseen counts over those ranks no matter what the player draws (the draw
 * likelihoods cancel), so the composition is sufficient state and no mixture has
 * to be carried through the recursion. The hole is only mixed over at settlement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExactSolver = exports.LIQD_RULES = exports.RIDX = exports.RANKS = void 0;
exports.solveExact = solveExact;
exports.exactSolves = exactSolves;
exports.buildExactArtifact = buildExactArtifact;
exports.serializeExactArtifact = serializeExactArtifact;
const strategy_1 = require("./strategy");
exports.RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];
exports.RIDX = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, T: 8, A: 9,
};
/** Blackjack value of each rank index; A counts 11 here and is demoted as needed. */
const VAL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const T_IDX = 8, A_IDX = 9;
exports.LIQD_RULES = {
    s17: true, das: true, peek: true, blackjackPays: 1.5,
    splitAcesOneCard: true, doubleAnyTwo: true,
};
function fullShoe(model) {
    const c = new Int32Array(10);
    if (model.kind === 'infinite') {
        // Nominal 1-deck shape; probabilities never consult it in infinite mode.
        for (let i = 0; i < 10; i++)
            c[i] = i === T_IDX ? 16 : 4;
        return c;
    }
    const d = model.decks;
    for (let i = 0; i < 10; i++)
        c[i] = (i === T_IDX ? 16 : 4) * d;
    return c;
}
const sum = (c) => {
    let n = 0;
    for (let i = 0; i < 10; i++)
        n += c[i];
    return n;
};
/**
 * Probability of drawing rank i from the current shoe. Infinite mode ignores the
 * counts entirely — that is the whole difference between the two models.
 */
function pDraw(c, n, i, model) {
    if (model.kind === 'infinite')
        return i === T_IDX ? 4 / 13 : 1 / 13;
    return n > 0 ? c[i] / n : 0;
}
/** Add a card to a running (total, soft) pair, demoting an ace if it busts. */
function addCard(total, soft, i) {
    let t = total, s = soft;
    if (i === A_IDX) {
        if (t + 11 <= 21) {
            t += 11;
            s = true;
        }
        else {
            t += 1;
        }
    }
    else {
        t += VAL[i];
        if (t > 21 && s) {
            t -= 10;
            s = false;
        }
    }
    return [t, s];
}
// ── Engine ────────────────────────────────────────────────────────────────────
class ExactSolver {
    constructor(model, strategy, rules = exports.LIQD_RULES) {
        this.dealerMemo = new Map();
        this.handMemo = new Map();
        this.outcomeMemo = new Map();
        this.model = model;
        this.rules = rules;
        this.strategy = strategy;
        this.shoe = fullShoe(model);
    }
    /** Memo key for the shoe state. Infinite mode has no state, so a constant. */
    key(c) {
        if (this.model.kind === 'infinite')
            return '';
        let k = '';
        for (let i = 0; i < 10; i++)
            k += c[i].toString(36) + '.';
        return k;
    }
    /**
     * Dealer final-total distribution as a 24-slot array indexed by total
     * (17..21 used, 22 = bust; index 23 = natural, handled by the caller).
     * Drawn without replacement from `c`, S17 or H17 per rules.
     */
    dealerDist(c, total, soft) {
        const k = `${this.key(c)}|${total}|${soft ? 1 : 0}`;
        const hit = this.dealerMemo.get(k);
        if (hit)
            return hit;
        const out = new Float64Array(24);
        if (total > 21) {
            out[22] = 1;
            this.dealerMemo.set(k, out);
            return out;
        }
        const standsHere = total >= 18
            || (total === 17 && (!soft || this.rules.s17));
        if (standsHere && total >= 17) {
            out[total] = 1;
            this.dealerMemo.set(k, out);
            return out;
        }
        const n = sum(c);
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(total, soft, i);
            if (this.model.kind === 'finite')
                c[i]--;
            const sub = this.dealerDist(c, t2, s2);
            if (this.model.kind === 'finite')
                c[i]++;
            for (let j = 17; j <= 22; j++)
                if (sub[j])
                    out[j] += p * sub[j];
        }
        this.dealerMemo.set(k, out);
        return out;
    }
    /**
     * Dealer outcome distribution given an upcard, mixing over the unseen hole card.
     * Returns { pNatural, dist } where dist is conditional on NO dealer natural.
     */
    dealerOutcome(c, up) {
        const k = `${this.key(c)}|up${up}`;
        const cached = this.outcomeMemo.get(k);
        if (cached)
            return cached;
        const n = sum(c);
        const natRank = up === A_IDX ? T_IDX : up === T_IDX ? A_IDX : -1;
        const pNat = natRank >= 0 ? pDraw(c, n, natRank, this.model) : 0;
        const dist = new Float64Array(24);
        // Hole is a single unseen card. If the dealer could have a natural and does
        // not, it is constrained to the non-completing ranks; the posterior is
        // proportional to the remaining counts over those ranks.
        const denom = natRank >= 0 ? 1 - pNat : 1;
        for (let h = 0; h < 10; h++) {
            if (h === natRank)
                continue;
            const pH = pDraw(c, n, h, this.model) / (denom > 0 ? denom : 1);
            if (pH <= 0)
                continue;
            const [t, s] = addCard(...addCard(0, false, up), h);
            if (this.model.kind === 'finite')
                c[h]--;
            const sub = this.dealerDist(c, t, s);
            if (this.model.kind === 'finite')
                c[h]++;
            for (let j = 17; j <= 22; j++)
                if (sub[j])
                    dist[j] += pH * sub[j];
        }
        const res = { pNatural: pNat, dist };
        this.outcomeMemo.set(k, res);
        return res;
    }
    /**
     * EV of standing on `total`.
     *
     * `hole >= 0` means the dealer's hole card is a KNOWN concrete card that has
     * already been removed from `c` — the hole-explicit peek branch (see `solve`).
     * The dealer then simply plays out from (up + hole) against the depleted shoe
     * and no conditioning appears anywhere below this point.
     *
     * `hole < 0` is the unpeeked path: the hole is unseen and mixed at settlement.
     * That is only sound when nothing has been conditioned on, which is why it is
     * now reached exclusively for upcards that cannot make a natural.
     */
    standEV(c, total, up, hole) {
        if (total > 21)
            return -1;
        if (hole >= 0) {
            const [dt, ds] = addCard(...addCard(0, false, up), hole);
            const dist = this.dealerDist(c, dt, ds);
            let ev = 0;
            for (let j = 17; j <= 22; j++) {
                const p = dist[j];
                if (!p)
                    continue;
                if (j === 22)
                    ev += p;
                else if (total > j)
                    ev += p;
                else if (total < j)
                    ev -= p;
            }
            return ev;
        }
        const { dist } = this.dealerOutcome(c, up);
        let ev = 0;
        for (let j = 17; j <= 22; j++) {
            const p = dist[j];
            if (!p)
                continue;
            if (j === 22)
                ev += p;
            else if (total > j)
                ev += p;
            else if (total < j)
                ev -= p;
        }
        return ev;
    }
    /**
     * EV of playing out a hand. `canDouble` gates the first-move double;
     * `oneCardOnly` implements split aces.
     */
    handEV(c, total, soft, up, canDouble, oneCardOnly, hole) {
        if (total > 21)
            return -1;
        if (oneCardOnly)
            return this.standEV(c, total, up, hole);
        const k = `${this.key(c)}|${total}|${soft ? 1 : 0}|${up}|${canDouble ? 1 : 0}|h${hole}`;
        const hit = this.handMemo.get(k);
        if (hit !== undefined)
            return hit;
        const evStand = this.standEV(c, total, up, hole);
        const n = sum(c);
        // Hit EV
        let evHit = 0;
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(total, soft, i);
            if (this.model.kind === 'finite')
                c[i]--;
            evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
            if (this.model.kind === 'finite')
                c[i]++;
        }
        // Double EV (one card, then stand, two units)
        let evDouble = -Infinity;
        if (canDouble) {
            let e = 0;
            for (let i = 0; i < 10; i++) {
                const p = pDraw(c, n, i, this.model);
                if (p <= 0)
                    continue;
                const [t2] = addCard(total, soft, i);
                if (this.model.kind === 'finite')
                    c[i]--;
                e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
                if (this.model.kind === 'finite')
                    c[i]++;
            }
            evDouble = 2 * e;
        }
        let ev;
        if (this.strategy === 'CD') {
            ev = Math.max(evStand, evHit, canDouble ? evDouble : -Infinity);
        }
        else {
            const a = (0, strategy_1.resolvedAction)(total, soft, VAL[up], canDouble);
            ev = a === 'S' ? evStand : a === 'D' ? evDouble : evHit;
        }
        this.handMemo.set(k, ev);
        return ev;
    }
    /** Total units wagered by a hand played to completion (1, or 2 if it doubles). */
    handWager(c, total, soft, up, canDouble, oneCardOnly, hole) {
        if (total > 21 || oneCardOnly)
            return 1;
        const n = sum(c);
        if (this.strategy === 'CD') {
            // Re-derive the CD action to know whether it doubles.
            const evStand = this.standEV(c, total, up, hole);
            let evHit = 0, evDouble = -Infinity;
            for (let i = 0; i < 10; i++) {
                const p = pDraw(c, n, i, this.model);
                if (p <= 0)
                    continue;
                const [t2, s2] = addCard(total, soft, i);
                if (this.model.kind === 'finite')
                    c[i]--;
                evHit += p * (t2 > 21 ? -1 : this.handEV(c, t2, s2, up, false, false, hole));
                if (this.model.kind === 'finite')
                    c[i]++;
            }
            if (canDouble) {
                let e = 0;
                for (let i = 0; i < 10; i++) {
                    const p = pDraw(c, n, i, this.model);
                    if (p <= 0)
                        continue;
                    const [t2] = addCard(total, soft, i);
                    if (this.model.kind === 'finite')
                        c[i]--;
                    e += p * (t2 > 21 ? -1 : this.standEV(c, t2, up, hole));
                    if (this.model.kind === 'finite')
                        c[i]++;
                }
                evDouble = 2 * e;
            }
            if (canDouble && evDouble >= evStand && evDouble >= evHit)
                return 2;
            if (evStand >= evHit)
                return 1;
        }
        else {
            const a = (0, strategy_1.resolvedAction)(total, soft, VAL[up], canDouble);
            if (a === 'D')
                return 2;
            if (a === 'S')
                return 1;
        }
        // Hitting: wager stays 1 regardless of how many cards follow.
        return 1;
    }
    /** EV of splitting a pair of rank `r`, exact under no-resplit (see header). */
    splitEV(c, r, up, hole) {
        const acesOneCard = r === A_IDX && this.rules.splitAcesOneCard;
        const canDouble = this.rules.das && !acesOneCard;
        const n = sum(c);
        let ev = 0, wager = 0;
        for (let i = 0; i < 10; i++) {
            const p = pDraw(c, n, i, this.model);
            if (p <= 0)
                continue;
            const [t2, s2] = addCard(...addCard(0, false, r), i);
            if (this.model.kind === 'finite')
                c[i]--;
            ev += p * this.handEV(c, t2, s2, up, canDouble, acesOneCard, hole);
            wager += p * this.handWager(c, t2, s2, up, canDouble, acesOneCard, hole);
            if (this.model.kind === 'finite')
                c[i]++;
        }
        return { ev: 2 * ev, wager: 2 * wager };
    }
    /** EV and wager for the player's two cards against an upcard, no naturals. */
    initialEV(c, p1, p2, up, hole) {
        const [t, s] = addCard(...addCard(0, false, p1), p2);
        let best = {
            ev: this.handEV(c, t, s, up, true, false, hole),
            wager: this.handWager(c, t, s, up, true, false, hole),
        };
        if (p1 === p2) {
            const pv = p1 === A_IDX ? 11 : VAL[p1];
            const splits = this.strategy === 'CD'
                ? true // CD decides by EV
                : (0, strategy_1.pairAction)(pv, VAL[up]) === 'P'; // TD reads the table
            if (splits) {
                const sp = this.splitEV(c, p1, up, hole);
                if (this.strategy === 'CD') {
                    if (sp.ev > best.ev)
                        best = sp;
                }
                else {
                    best = sp;
                }
            }
        }
        return best;
    }
    /**
     * Exact result over every initial deal, enumerated without replacement.
     * Returns EV per initial bet, per total wagered, and E[total wager].
     */
    solve() {
        const c = Int32Array.from(this.shoe);
        const bjPays = this.rules.blackjackPays;
        let evSum = 0, wagerSum = 0, pSum = 0;
        let pPlayerBJ = 0, pDealerBJ = 0;
        const N0 = sum(c);
        for (let p1 = 0; p1 < 10; p1++) {
            if (c[p1] === 0)
                continue;
            const pp1 = pDraw(c, N0, p1, this.model);
            if (this.model.kind === 'finite')
                c[p1]--;
            const N1 = sum(c);
            for (let up = 0; up < 10; up++) {
                if (c[up] === 0)
                    continue;
                const pUp = pDraw(c, N1, up, this.model);
                if (this.model.kind === 'finite')
                    c[up]--;
                const N2 = sum(c);
                for (let p2 = 0; p2 < 10; p2++) {
                    if (c[p2] === 0)
                        continue;
                    const pp2 = pDraw(c, N2, p2, this.model);
                    if (this.model.kind === 'finite')
                        c[p2]--;
                    const pCombo = pp1 * pUp * pp2;
                    pSum += pCombo;
                    const playerBJ = (p1 === T_IDX && p2 === A_IDX) || (p1 === A_IDX && p2 === T_IDX);
                    if (playerBJ)
                        pPlayerBJ += pCombo;
                    // Dealer natural probability given the three exposed cards.
                    const { pNatural } = this.dealerOutcome(c, up);
                    if (up === A_IDX || up === T_IDX)
                        pDealerBJ += pCombo * pNatural;
                    let ev, wager;
                    if (playerBJ) {
                        // Peek: a dealer natural pushes; otherwise the player is paid 3:2.
                        // Under peek/OBO the dealer's natural is revealed immediately, so a player
                        // natural pushes against it with probability pNatural either way; the rule flag
                        // does not change this branch. Kept explicit rather than as a dead ternary.
                        const pd = pNatural;
                        ev = pd * 0 + (1 - pd) * bjPays;
                        wager = 1;
                    }
                    else if ((up === A_IDX || up === T_IDX) && this.rules.peek && this.strategy === 'TD') {
                        // ── Hole-explicit peek branch ────────────────────────────────────
                        // Conditioning happens ONCE, here, and never again below.
                        //
                        // The old form computed `Sum_d P(d) * E[return | E, d]` — player draw
                        // paths weighted by the UNCONDITIONAL shoe law with the hole still in
                        // the drawable pool — and applied the no-natural conditioning only at
                        // the settlement leaf. That is not the conditional expectation: given
                        // "no natural", the player's own draw law shifts (knowing the hole is
                        // not a Ten leaves more Tens drawable), so the path weights are wrong.
                        // Verified against an exact-rational physical enumerator: the error is
                        // algebraic, not numerical, and scales ~1/N.
                        //
                        // Here the hole is a CONCRETE card, drawn and removed from the shoe
                        // before the player acts. Inside each branch the dealer's hand is known
                        // and every player draw is the plain physical law on the depleted shoe.
                        // The `Sum_h w_h = 1` mixture is Bayes as an identity.
                        // In infinite mode the draw law is composition-free, so P(E | draws)
                        // is constant and this branch collapses to the old one — identical
                        // results, which is why the infinite regression test is unaffected.
                        const natRank = up === A_IDX ? T_IDX : A_IDX;
                        const N = sum(c);
                        const pNat = pDraw(c, N, natRank, this.model);
                        const denomP = 1 - pNat;
                        let evPlay = 0, wagerPlay = 0;
                        for (let h = 0; h < 10; h++) {
                            if (h === natRank || c[h] === 0)
                                continue;
                            const w = denomP > 0 ? pDraw(c, N, h, this.model) / denomP : 0;
                            if (w <= 0)
                                continue;
                            if (this.model.kind === 'finite')
                                c[h]--; // the hole is a real card
                            const r = this.initialEV(c, p1, p2, up, h);
                            if (this.model.kind === 'finite')
                                c[h]++;
                            evPlay += w * r.ev;
                            wagerPlay += w * r.wager;
                        }
                        // OBO: a dealer natural takes the initial bet only.
                        ev = pNat * -1 + (1 - pNat) * evPlay;
                        wager = pNat * 1 + (1 - pNat) * wagerPlay;
                    }
                    else if (up === A_IDX || up === T_IDX) {
                        // Two cases land here.
                        //
                        // 1. No peek (OBO off): nothing is conditioned on, so the unseen-hole
                        //    mixture at settlement is sound and the player commits everything.
                        //
                        // 2. CD under peek: KNOWN BIASED — see `cdPeekIsApproximate`. CD cannot
                        //    use the hole-explicit branch, because an argmax evaluated inside a
                        //    fixed-hole branch lets the player choose as if the hole were
                        //    visible (measured: +5.5 pp, a peeking player). The correct CD form
                        //    is a per-node posterior mixture, not yet implemented, so CD keeps
                        //    the old conditioning here and carries the ~1/N error the TD path
                        //    just shed. CD is an internal diagnostic on the strategy table; its
                        //    figure must NOT be published as exact until the mixture form lands.
                        const inner = this.initialEV(c, p1, p2, up, -1);
                        if (this.rules.peek) {
                            ev = pNatural * -1 + (1 - pNatural) * inner.ev;
                            wager = pNatural * 1 + (1 - pNatural) * inner.wager;
                        }
                        else {
                            ev = pNatural * -inner.wager + (1 - pNatural) * inner.ev;
                            wager = inner.wager;
                        }
                    }
                    else {
                        // Upcard cannot make a natural: no conditioning, unseen hole is fine.
                        const inner = this.initialEV(c, p1, p2, up, -1);
                        ev = inner.ev;
                        wager = inner.wager;
                    }
                    evSum += pCombo * ev;
                    wagerSum += pCombo * wager;
                    if (this.model.kind === 'finite')
                        c[p2]++;
                }
                if (this.model.kind === 'finite')
                    c[up]++;
            }
            if (this.model.kind === 'finite')
                c[p1]++;
        }
        // In infinite mode the enumeration is already normalised; in finite mode the
        // three-card probabilities sum to 1 by construction. Guard anyway.
        const norm = pSum > 0 ? pSum : 1;
        const evPerInitial = evSum / norm;
        const avgWager = wagerSum / norm;
        return {
            model: this.model,
            strategy: this.strategy,
            rules: this.rules,
            evPerInitialBet: evPerInitial,
            rtpPerInitialBet: 1 + evPerInitial,
            edgePerInitialBet: -evPerInitial,
            avgWager,
            evPerTotalWagered: evPerInitial / avgWager,
            rtpPerTotalWagered: 1 + evPerInitial / avgWager,
            edgePerTotalWagered: -evPerInitial / avgWager,
            playerBlackjackFreq: pPlayerBJ / norm,
            dealerBlackjackFreq: pDealerBJ / norm,
            probabilityMass: pSum,
            cdPeekIsApproximate: this.strategy === 'CD' && this.model.kind === 'finite' && this.rules.peek,
        };
    }
}
exports.ExactSolver = ExactSolver;
function solveExact(model, strategy, rules = exports.LIQD_RULES) {
    return new ExactSolver(model, strategy, rules).solve();
}
/** Run (or look up, if `solver` caches) the four solves the artifact is built from. */
function exactSolves(solver = solveExact) {
    return {
        infiniteCD: solver({ kind: 'infinite' }, 'CD', exports.LIQD_RULES),
        finite8TD: solver({ kind: 'finite', decks: 8 }, 'TD', exports.LIQD_RULES),
        finite1TD: solver({ kind: 'finite', decks: 1 }, 'TD', exports.LIQD_RULES),
        // 6-deck exact solve, all other rule inputs identical — used only to record, in the artifact,
        // the precision of the published WoO reference (its 6-deck csm figure differs from this exact
        // solve by ~1e-4 pp, so WoO's csm figures resolve to ~1e-4 pp, not 1e-5 pp).
        finite6TD: solver({ kind: 'finite', decks: 6 }, 'TD', exports.LIQD_RULES),
    };
}
/**
 * Build the artifact of record for the exact figures (`outputs/exact-rtp.json`).
 *
 * Deterministic — no timestamp, no randomness — so the file and its hash are stable
 * across runs. This is the producing artifact for every exact TD number the report
 * cites; the simulation artifact's own exactTD block is a point-in-time copy and is
 * NOT the citation source.
 *
 * EXPORTED ON PURPOSE (round-2 QA item 1). `npm run rtp` writes what this returns, and
 * `tests/blackjack/exactSolverTests.ts` deep-compares the COMMITTED file against a fresh
 * call. Before that, the test gated three fields of `finite8TD` by hand, so a hand-edit of
 * `rtpPerTotalWagered`, `avgWager`, `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
 * `sixDeckExact` or anything in `wooAnchor` passed the whole suite. One builder, two
 * readers: every key path in the artifact is now bound to the code that produces it, and
 * a field added here is covered the moment it exists.
 */
function buildExactArtifact(solver = solveExact) {
    const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(solver);
    return {
        generatedBy: 'npm run rtp (src/exact-play.ts)',
        deterministic: true,
        finite8TD: td,
        finite1TD: oneDeck,
        infiniteCD: inf,
        cardRemovalLiftPP: (td.rtpPerInitialBet - inf.rtpPerInitialBet) * 100,
        note: 'finite8TD is the headline: exact EV of the src/strategy.ts table on a real ' +
            '416-card shoe, hole-explicit peek branch, anchored to the tiny-shoe ' +
            'exact-rational oracle (anchor/oracle.py, tests/blackjack/exactOracleTests.ts). ' +
            'Finite-shoe CD is a demoted internal diagnostic (cdPeekIsApproximate) and is ' +
            'deliberately absent from this artifact. Base game only — side bets and ' +
            'insurance are excluded.',
        wooAnchor: {
            source: 'https://wizardofodds.com/games/blackjack/calculator/',
            capturedAt: '2026-08-23',
            settings: '8 decks, S17, DAS, double any two, split to 2 hands, no resplit aces, ' +
                'no hit split aces, OBO peek, no surrender, blackjack 3:2',
            basicStrategyContinuousShuffler: 0.0048768,
            basicStrategyContinuousShufflerNote: 'total-dependent basic strategy, reshuffle every hand — the LIQD regime; ' +
                'published at 5 decimal places of percent (0.48768%)',
            deltaVsFinite8TD: td.edgePerInitialBet - 0.0048768,
            sixDeckPublished: 0.0045999,
            sixDeckExact: sixDeck.edgePerInitialBet,
            sixDeckNote: 'Same rule set at 6 decks: WoO publishes 0.45999% (sixDeckPublished) while this engine ' +
                'solves to sixDeckExact. The differences are about 0.00005441 pp at six decks and ' +
                '0.00000518 pp at eight decks. This supports close agreement at the available ' +
                'reference precision; it does not certify every digit of the internal solve.',
        },
    };
}
/** Byte-for-byte serialisation of the artifact as `npm run rtp` writes it to disk. */
function serializeExactArtifact(artifact) {
    return JSON.stringify(artifact, null, 2) + '\n';
}
if (require.main === module) {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const fs = require('fs');
    const path = require('path');
    // Cache the four solves so the console summary below and the artifact are the SAME numbers.
    const cache = new Map();
    const t = {};
    const timedSolver = (model, strategy, rules) => {
        const key = JSON.stringify(model) + strategy;
        let r = cache.get(key);
        if (!r) {
            const t0 = Date.now();
            r = solveExact(model, strategy, rules);
            t[key] = Date.now() - t0;
            cache.set(key, r);
        }
        return r;
    };
    const artifact = buildExactArtifact(timedSolver);
    const { infiniteCD: inf, finite8TD: td, finite1TD: oneDeck, finite6TD: sixDeck } = exactSolves(timedSolver);
    const secs = (model, strategy) => ((t[JSON.stringify(model) + strategy] ?? 0) / 1000).toFixed(2);
    console.log('\n  Infinite deck, CD (with-replacement model)');
    console.log(`    RTP per initial bet : ${(inf.rtpPerInitialBet * 100).toFixed(6)}%`);
    console.log(`    edge                : ${(inf.edgePerInitialBet * 100).toFixed(6)}%`);
    console.log(`    time                : ${secs({ kind: 'infinite' }, 'CD')}s`);
    console.log('\n  Finite 8-deck, TD (the table simulate.ts plays)');
    console.log(`    RTP per initial bet : ${(td.rtpPerInitialBet * 100).toFixed(6)}%   edge ${(td.edgePerInitialBet * 100).toFixed(6)}%`);
    console.log(`    RTP per total wager : ${(td.rtpPerTotalWagered * 100).toFixed(6)}%   avg wager ${td.avgWager.toFixed(6)}`);
    console.log(`    time                : ${secs({ kind: 'finite', decks: 8 }, 'TD')}s`);
    console.log('\n  Finite 1-deck, TD (deck-sensitivity reference, same 8-deck table)');
    console.log(`    edge per initial bet: ${(oneDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);
    console.log(`  Finite 6-deck, TD (WoO precision reference): edge ${(sixDeck.edgePerInitialBet * 100).toFixed(6)}%\n`);
    const outPath = path.join(__dirname, '..', 'outputs', 'exact-rtp.json');
    fs.writeFileSync(outPath, serializeExactArtifact(artifact));
    console.log(`  Wrote ${outPath}\n`);
}

  },
  "src/loader.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Dataset loader with a mandatory SHA-256 hash guard.
 *
 * The guard runs BEFORE any verification so the suite can never validate the wrong
 * file. Prints expected + actual and exits non-zero on mismatch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPTURE_SIDE_FIELDS = exports.DATA_PATH = void 0;
exports.datasetHash = datasetHash;
exports.stripCaptureSideFields = stripCaptureSideFields;
exports.loadDataset = loadDataset;
exports.revealedSeedMap = revealedSeedMap;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const path_1 = require("path");
const config_1 = require("./config");
exports.DATA_PATH = (0, path_1.join)(__dirname, '..', 'data', 'blackjack-6000hands.json');
function datasetHash(path = exports.DATA_PATH) {
    return (0, crypto_1.createHash)('sha256').update((0, fs_1.readFileSync)(path)).digest('hex');
}
/**
 * Fields the capture rig wrote from its OWN recomputation of the game, not from anything
 * LIQD returned: the rig's reconstructed shoe prefix and its own pass/fail verdicts.
 *
 * They are DELETED here, at the single entry point every scored step loads through, so the
 * verification path cannot read them by any access pattern — dotted, bracketed, destructured
 * or computed. `tests/blackjack/antiCircularityTests.ts` is a lint-style regex over source
 * text and cannot see a computed key (`const K = 'veri' + 'fied'; b[K]`); this makes the
 * independence guarantee structural instead of stylistic (round-2 QA item 22).
 *
 * The stripping happens AFTER the hash guard and only in memory. `datasetHash()` reads the
 * file from disk, so the committed dataset — fields and all — is unchanged and still hashes
 * to DATASET_SHA256; the fields remain in the shipped artifact for a third party to inspect.
 */
exports.CAPTURE_SIDE_FIELDS = ['localSequence', 'commitVerified', 'chainLinkOk', 'verified'];
/** Delete every capture-side field from every bet and seed. Computed keys — no literal access. */
function stripCaptureSideFields(ds) {
    const strip = (o) => {
        for (const f of exports.CAPTURE_SIDE_FIELDS)
            delete o[f];
    };
    for (const b of ds.bets)
        strip(b);
    for (const s of ds.seeds)
        strip(s);
    return ds;
}
/**
 * Hash-guard first, then parse, then strip the capture-side fields.
 * On hash mismatch: print both hashes and process.exit(1).
 */
function loadDataset(path = exports.DATA_PATH) {
    const actual = datasetHash(path);
    if (actual !== config_1.DATASET_SHA256) {
        console.error('\n❌ Dataset hash mismatch — refusing to run.');
        console.error(`   expected: ${config_1.DATASET_SHA256}`);
        console.error(`   actual:   ${actual}`);
        process.exit(1);
    }
    return stripCaptureSideFields(JSON.parse((0, fs_1.readFileSync)(path, 'utf8')));
}
/** O(1) revealed-seed lookup: Map<hashedServerSeed, Seed>. */
function revealedSeedMap(ds) {
    const m = new Map();
    for (const s of ds.seeds)
        m.set(s.hashedServerSeed, s);
    return m;
}

  },
  "src/money.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * MONEY, in exact integer settlement units. One definition, every money check.
 *
 * WHY THIS EXISTS (round-4 QA-01).
 *
 * The payout checks used to compare amounts with `Math.abs(a - b) <= 1e-6`. That is the wrong
 * SHAPE of check, not merely a loose one: it rejects an amount that cannot exist on the settlement
 * grid, but it ACCEPTS a wrong amount that can. Executed counterexample: rewriting the epoch-0
 * nonce-0 per-hand credit from `0.20` to `0.1999995` — a legal grid amount, 50 whole settlement
 * units short of what the cards and rules require, i.e. a real underpayment — and re-pinning the
 * dataset left the complete suite green, because 5e-7 < 1e-6. Nothing below 1e-6 could be seen.
 *
 * The capture uses an eight-decimal accounting grid. Every recorded amount is an integer number of 1e-8 units, and so is
 * every rule-derived return (the multipliers are 0, 1, 2, 5/2 and 3 on integer stakes, and the
 * side-bet paytables are whole numbers to one). Comparisons are therefore INTEGER EQUALITY in
 * those units, and the only tolerance in the system sits where float noise genuinely lives:
 * reading a JSON double back onto the grid.
 *
 * It lives in its own module rather than being written out in each step file, because two copies
 * of a rule are two rules — the defect class QA-02 was raised about.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.asMoney = exports.unitsOr0 = exports.GRID_TOL = exports.GRID = void 0;
exports.unitsOf = unitsOf;
/** 8 decimals — the captured game-accounting precision. */
exports.GRID = 1e8;
/**
 * Tolerance for snapping a JSON double onto the grid, IN GRID UNITS.
 *
 * Measured over the committed dataset: 42,894 amounts, worst deviation 1.2e-7 units. The largest
 * offender is `winningAmount: 4.6000000000000005` at epoch 2 nonce 25, which is approximately 5.96e-8 grid units off
 * 4.60 and must therefore read as exactly 460,000,000 units. 1e-3 is ~8,400× the measured noise
 * and 1/1000 of the smallest error that can actually exist — one unit — so representation noise
 * and a real money error can never be confused for one another.
 */
exports.GRID_TOL = 1e-3;
/** A recorded money amount in exact integer settlement units, or null if it is OFF the 1e-8 grid. */
function unitsOf(v) {
    if (v === null || v === undefined)
        return null;
    const x = Number(v);
    if (!Number.isFinite(x))
        return null;
    const u = x * exports.GRID;
    const r = Math.round(u);
    return Math.abs(u - r) > exports.GRID_TOL ? null : r;
}
/** Same, but an absent or off-grid amount counts as zero — for summing optional components. */
const unitsOr0 = (v) => unitsOf(v) ?? 0;
exports.unitsOr0 = unitsOr0;
/** Grid units rendered back as a decimal amount, for failure messages. */
const asMoney = (units) => (units / exports.GRID).toFixed(8);
exports.asMoney = asMoney;

  },
  "src/optimal-play.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — Optimal-Play RTP Engine (analytical)
 *
 * Independent recursive EV solver for optimal basic strategy. Computes the
 * theoretical RTP WITHOUT referencing any LIQD-supplied figure. Wizard of Odds is
 * used only for cross-validation, never as an input.
 *
 * This engine is the INFINITE-DECK limit (each draw independent). LIQD deals from a
 * finite 8-deck (416-card) shoe reshuffled every hand, so the finite-shoe removal
 * effect makes the true RTP marginally different. The AUTHORITATIVE finite 8-deck
 * RTP is the deterministic exact solve in `src/exact-play.ts` (the Monte-Carlo
 * simulation confirms it, but does not establish it); this analytical value is the
 * independent theoretical
 * cross-check, and both are compared to the published Wizard of Odds 8-deck figure.
 *
 * Rules (read off the 6,000-hand dataset — see verify.ts rules steps):
 *   - Dealer stands on soft 17 (S17)
 *   - Blackjack pays 3:2 (2.5× return)
 *   - Double on any two cards; double after split (DAS)
 *   - Split on matching VALUE (any two ten-valued cards may be split); one card on split
 *     aces; NO re-split. Basic strategy never splits tens, so rank-equality detection is
 *     sufficient for the RTP engine — see the note at the pair check in src/simulate.ts.
 *   - Dealer peeks for blackjack on Ace / 10 upcards
 *   - No surrender
 *
 * Card probabilities (infinite deck, suit-agnostic):
 *   2..9, A: 1/13 each;  T (10/J/Q/K): 4/13
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeOptimalRTP = computeOptimalRTP;
exports.clearCaches = clearCaches;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];
const P = {
    '2': 1 / 13, '3': 1 / 13, '4': 1 / 13, '5': 1 / 13, '6': 1 / 13,
    '7': 1 / 13, '8': 1 / 13, '9': 1 / 13, T: 4 / 13, A: 1 / 13,
};
const V = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, A: 11,
};
function add(s, r) {
    let total = s.total;
    let soft = s.soft;
    if (r === 'A') {
        if (total + 11 <= 21) {
            total += 11;
            soft = true;
        }
        else {
            total += 1;
        }
    }
    else {
        total += V[r];
        if (total > 21 && soft) {
            total -= 10;
            soft = false;
        }
    }
    return { total, soft };
}
const dealerCache = new Map();
/** Dealer final-total distribution (22 = bust). */
function dealerDist(state, s17) {
    const key = `${state.total}-${state.soft}-${s17}`;
    const cached = dealerCache.get(key);
    if (cached)
        return cached;
    if (state.total > 21) {
        const m = new Map([[22, 1]]);
        dealerCache.set(key, m);
        return m;
    }
    const stands = state.total >= 18 || (state.total === 17 && (!state.soft || s17 === 'stand'));
    if (stands) {
        const m = new Map([[state.total, 1]]);
        dealerCache.set(key, m);
        return m;
    }
    const m = new Map();
    for (const r of RANKS) {
        const sub = dealerDist(add(state, r), s17);
        for (const [t, p] of sub)
            m.set(t, (m.get(t) || 0) + P[r] * p);
    }
    dealerCache.set(key, m);
    return m;
}
/** Dealer distribution from an upcard, applying the peek rule. */
function dealerStartDist(upcard, s17) {
    const afterUp = add({ total: 0, soft: false }, upcard);
    if (upcard !== 'T' && upcard !== 'A')
        return { pBJ: 0, distNoBJ: dealerDist(afterUp, s17) };
    const pBJ = upcard === 'A' ? P.T : P.A;
    const distNoBJ = new Map();
    for (const hole of RANKS) {
        const isBJHole = (upcard === 'A' && hole === 'T') || (upcard === 'T' && hole === 'A');
        if (isBJHole)
            continue;
        const sub = dealerDist(add(afterUp, hole), s17);
        const pHoleCond = P[hole] / (1 - pBJ);
        for (const [t, pt] of sub)
            distNoBJ.set(t, (distNoBJ.get(t) || 0) + pHoleCond * pt);
    }
    return { pBJ, distNoBJ };
}
const standCache = new Map();
function standEV(playerTotal, dealerUp, s17) {
    if (playerTotal > 21)
        return -1;
    const key = `${playerTotal}-${dealerUp}-${s17}`;
    const c = standCache.get(key);
    if (c !== undefined)
        return c;
    const { distNoBJ } = dealerStartDist(dealerUp, s17);
    let ev = 0;
    for (const [t, pt] of distNoBJ) {
        if (t === 22)
            ev += pt;
        else if (playerTotal > t)
            ev += pt;
        else if (playerTotal < t)
            ev -= pt;
    }
    standCache.set(key, ev);
    return ev;
}
const hitCache = new Map();
function hitEV(state, dealerUp, s17) {
    const key = `${state.total}-${state.soft}-${dealerUp}-${s17}`;
    const c = hitCache.get(key);
    if (c !== undefined)
        return c;
    let ev = 0;
    for (const r of RANKS) {
        const next = add(state, r);
        if (next.total > 21)
            ev += P[r] * -1;
        else
            ev += P[r] * Math.max(standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
    }
    hitCache.set(key, ev);
    return ev;
}
function doubleEV(state, dealerUp, s17) {
    let ev = 0;
    for (const r of RANKS) {
        const next = add(state, r);
        ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
    }
    return 2 * ev;
}
/** EV of one post-split hand from a single card (split aces: one card then stand). */
function postSplitHandEV(rank, dealerUp, s17, das) {
    const start = add({ total: 0, soft: false }, rank);
    let ev = 0;
    for (const r of RANKS) {
        const next = add(start, r);
        if (rank === 'A') {
            ev += P[r] * (next.total > 21 ? -1 : standEV(next.total, dealerUp, s17));
        }
        else {
            let best = Math.max(next.total > 21 ? -1 : standEV(next.total, dealerUp, s17), hitEV(next, dealerUp, s17));
            if (das)
                best = Math.max(best, doubleEV(next, dealerUp, s17));
            ev += P[r] * best;
        }
    }
    return ev;
}
const splitEV = (rank, up, s17, das) => 2 * postSplitHandEV(rank, up, s17, das);
function playerOptimalEV(p1, p2, up, s17, das) {
    const state = add(add({ total: 0, soft: false }, p1), p2);
    let best = Math.max(standEV(state.total, up, s17), hitEV(state, up, s17), doubleEV(state, up, s17));
    if (p1 === p2)
        best = Math.max(best, splitEV(p1, up, s17, das));
    return best;
}
/** Optimal-play RTP = E[return / wager] over all (P1, P2, dealerUp) with peek + BJ handling. */
function computeOptimalRTP(s17 = 'stand', das = true) {
    let rtpSum = 0;
    let playerBJProb = 0;
    for (const p1 of RANKS) {
        for (const p2 of RANKS) {
            const playerBJ = (p1 === 'T' && p2 === 'A') || (p1 === 'A' && p2 === 'T');
            if (playerBJ)
                playerBJProb += P[p1] * P[p2];
            for (const up of RANKS) {
                const pCombo = P[p1] * P[p2] * P[up];
                const upPeeks = up === 'A' || up === 'T';
                const pDealerBJ = up === 'A' ? P.T : up === 'T' ? P.A : 0;
                let ret;
                if (playerBJ && upPeeks)
                    ret = pDealerBJ * 1 + (1 - pDealerBJ) * 2.5;
                else if (playerBJ)
                    ret = 2.5;
                else if (upPeeks)
                    ret = pDealerBJ * 0 + (1 - pDealerBJ) * (1 + playerOptimalEV(p1, p2, up, s17, das));
                else
                    ret = 1 + playerOptimalEV(p1, p2, up, s17, das);
                rtpSum += pCombo * ret;
            }
        }
    }
    return { rtp: rtpSum, edge: 1 - rtpSum, playerBJFreq: playerBJProb, dealerBJFreq: 2 * P.T * P.A, s17, das };
}
function clearCaches() { dealerCache.clear(); standCache.clear(); hitCache.clear(); }
if (require.main === module) {
    const t0 = Date.now();
    const r = computeOptimalRTP('stand', true);
    console.log('\n  LIQD Blackjack — optimal-play RTP (analytical, infinite-deck limit)\n');
    console.log('  Rules:           S17, DAS, no surrender, no re-split, dealer peek');
    console.log(`  Optimal RTP:     ${(r.rtp * 100).toFixed(6)}%`);
    console.log(`  House edge:      ${(r.edge * 100).toFixed(6)}%`);
    console.log(`  Player BJ freq:  ${(r.playerBJFreq * 100).toFixed(4)}%  (infinite-deck 8/169 = ${(8 / 169 * 100).toFixed(4)}%)`);
    console.log(`  Dealer BJ freq:  ${(r.dealerBJFreq * 100).toFixed(4)}%`);
    console.log(`  Time:            ${((Date.now() - t0) / 1000).toFixed(2)}s`);
    console.log(`\n  This engine is the infinite-deck (with-replacement) limit only: ${(r.rtp * 100).toFixed(6)}% RTP / ${(r.edge * 100).toFixed(6)}% edge.`);
    console.log('  Authoritative finite 8-deck RTP and the pinned Wizard of Odds anchor: see the exact solve (npm run rtp -> outputs/exact-rtp.json).\n');
}

  },
  "src/rng.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack provably-fair RNG — canonical reference implementation.
 *
 * Node.js `crypto` only; no LIQD dependency. Reverse-engineered from the live
 * verify endpoint and validated against 6,000 captured hands (every card recomputed).
 *
 * Crypto core is identical to LIQD Mines (independently confirmed against the mines
 * verify endpoint): HMAC-SHA256, key = bytes(serverSeed hex), message
 * `${clientSeed}:${nonce}:${cursor}`, big-endian uint32 chunks with rejection sampling,
 * `chunk % range`.
 *
 * Game logic: BACKWARD in-place Fisher-Yates over an 8-deck (416-card) shoe.
 * Deal is PDPD: player = shoe[0], shoe[2]; dealer = shoe[1], shoe[3]; further cards
 * are dealt from shoe[4:] (all player draws, then all dealer draws).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOE_SIZE = exports.DECKS = exports.SUITS = exports.salt = void 0;
exports.generateProvablyFairNumber = generateProvablyFairNumber;
exports.buildShoeTemplate = buildShoeTemplate;
exports.blackjackShoe = blackjackShoe;
exports.dealtHands = dealtHands;
exports.commitHash = commitHash;
const crypto_1 = require("crypto");
const salt = (clientSeed, nonce, cursor) => `${clientSeed}:${nonce}:${cursor}`;
exports.salt = salt;
/** Bias-free uniform integer in [0, range). Same primitive as Mines/Plinko. */
function generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor, range) {
    const key = Buffer.from(serverSeed, 'hex');
    const digest = (0, crypto_1.createHmac)('sha256', key).update((0, exports.salt)(clientSeed, nonce, cursor)).digest();
    const maxFair = Math.floor(4294967296 / range) * range;
    for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
        const chunk = digest.readUInt32BE(offset);
        if (chunk < maxFair)
            return chunk % range;
    }
    return generateProvablyFairNumber(serverSeed, clientSeed, nonce, cursor + 1000000, range);
}
/** Suits and rank range; card string form is "SUIT:rank" (rank 1=A..13=K). */
exports.SUITS = ['CLUB', 'HEART', 'SPADE', 'DIAMOND'];
exports.DECKS = 8;
exports.SHOE_SIZE = exports.DECKS * 52; // 416
/** 52-card template repeated across 8 decks: suit-major [CLUB,HEART,SPADE,DIAMOND] × ranks 1..13. */
function buildShoeTemplate() {
    const shoe = [];
    for (let d = 0; d < exports.DECKS; d++)
        for (const s of exports.SUITS)
            for (let r = 1; r <= 13; r++)
                shoe.push(`${s}:${r}`);
    return shoe;
}
/**
 * Backward in-place Fisher-Yates: for i = SHOE_SIZE-1 .. 1,
 *   j = generateProvablyFairNumber(cursor=i, range=i+1) ∈ [0, i]; swap(shoe[i], shoe[j]).
 * Returns the full 416-card shuffled shoe.
 */
function blackjackShoe(serverSeed, clientSeed, nonce) {
    const a = buildShoeTemplate();
    for (let i = a.length - 1; i >= 1; i--) {
        const j = generateProvablyFairNumber(serverSeed, clientSeed, nonce, i, i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Deal mapping (PDPD): player = shoe[0],shoe[2]; dealer = shoe[1],shoe[3]; rest from shoe[4:]. */
function dealtHands(shoe) {
    return { player: [shoe[0], shoe[2]], dealer: [shoe[1], shoe[3]], rest: shoe.slice(4) };
}
/** Commitment (Stake convention): SHA-256(utf8(serverSeed hex string)). */
function commitHash(serverSeedHexString) {
    return (0, crypto_1.createHash)('sha256').update(serverSeedHexString, 'utf8').digest('hex');
}

  },
  "src/round-engine.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * One round of LIQD blackjack, played to settlement under the audited basic-strategy table.
 *
 * WHY THIS MODULE EXISTS, AND WHY IT IS A SECOND COPY.
 *
 * The same logic lives inside `src/simulate.ts`, which is a top-level script: it runs a 30M-round
 * Monte-Carlo on import, so nothing can import a function out of it. `src/cherry-pick-attack.ts`
 * needs to settle rounds too, and the honest options were (a) lift the logic out of simulate.ts
 * into this module and have simulate.ts import it, or (b) copy it.
 *
 * (a) is the better engineering and is NOT what was done, deliberately. `outputs/simulation-
 * results.json` is FROZEN and hash-pinned; regenerating it is forbidden after the freeze (it
 * would move every simulation figure the report cites, within Monte-Carlo error, for no reason).
 * So a refactor of simulate.ts could not be re-run to prove it was behaviour-preserving, and an
 * unverifiable refactor of the instrument that produced the frozen artifact is a worse risk than
 * a disclosed duplicate.
 *
 * The duplicate is therefore BOUND rather than trusted: `tests/blackjack/roundEngineTests.ts`
 * runs this engine over a fair 8-deck shuffle and requires its RTP to agree with the exact 8-deck
 * TD solve (`src/exact-play.ts`) within **5σ, per initial bet** — ONE convention, an acceptance
 * window of 5 × 1.15 / √2,000,000 × 100 = 0.4065864 percentage points. (This paragraph read "3σ,
 * in both conventions" through round 3, and the test had never done either: round-4 QA-05.) If
 * this copy drifted from the audited strategy, that test fails. The strategy table itself is NOT
 * duplicated — it is imported from `src/strategy.ts`, the single source of truth that
 * `simulate.ts` and `exact-play.ts` also import.
 *
 * Rules encoded, identical to simulate.ts: 8 decks, S17, DAS, split-aces-one-card, no re-split,
 * dealer peek/OBO, double on any two, blackjack 3:2.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.totalOf = totalOf;
exports.playRound = playRound;
exports.settleShoeAt = settleShoeAt;
exports.settleShoe = settleShoe;
const strategy_1 = require("./strategy");
/** Hand total with soft-ace reduction. Returns [total, soft]. */
function totalOf(cards) {
    let t = 0, aces = 0;
    for (const v of cards) {
        t += v;
        if (v === 11)
            aces++;
    }
    while (t > 21 && aces > 0) {
        t -= 10;
        aces--;
    }
    return [t, aces > 0];
}
/** Play one non-split hand; canDouble gates the first-move double. Returns [finalTotal, betUnits]. */
function playHand(cards, up, canDouble, draw) {
    const bet = 1;
    for (;;) {
        const [t, soft] = totalOf(cards);
        if (t > 21)
            return [t, bet];
        const a = soft ? (0, strategy_1.softAction)(t, up) : (0, strategy_1.hardAction)(t, up);
        if (a === 'D' || a === 'Ds') {
            if (cards.length === 2 && canDouble) {
                cards.push(draw());
                return [totalOf(cards)[0], 2];
            }
            if (a === 'Ds')
                return [t, bet];
            cards.push(draw());
            continue; // D with no double → hit
        }
        if (a === 'S')
            return [t, bet];
        cards.push(draw()); // hit
    }
}
function dealerPlay(cards, draw) {
    for (;;) {
        const [t] = totalOf(cards);
        if (t < 17)
            cards.push(draw());
        else
            return t;
    } // S17
}
/**
 * Play a full round from the four dealt values plus the two player-card RANKS (pair detection is
 * rank-based, matching Step 27's value-based split observation only where ranks coincide).
 * Returns [wagered, returned] in units of the initial bet.
 */
function playRound(p0, up, p1, hole, rp0, rp1, draw) {
    const playerBJ = p0 + p1 === 21;
    const dealerBJ = up + hole === 21 && (up === 11 || hole === 11);
    // US peek / OBO: a dealer natural resolves before the player risks anything extra.
    if (up === 11 || up === 10) {
        if (dealerBJ)
            return [1, playerBJ ? 1 : 0];
    }
    if (playerBJ)
        return [1, 2.5]; // player natural, dealer not BJ → 3:2
    const results = [];
    const pv = rp0 === 1 ? 11 : rp0 >= 10 ? 10 : rp0;
    if (p0 === p1 && rp0 === rp1 && (0, strategy_1.pairAction)(pv, up) === 'P') {
        if (pv === 11) { // split aces: one card each, no further action
            results.push([totalOf([11, draw()])[0], 1]);
            results.push([totalOf([11, draw()])[0], 1]);
        }
        else {
            results.push(playHand([p0, draw()], up, true, draw)); // DAS allowed
            results.push(playHand([p1, draw()], up, true, draw));
        }
    }
    else {
        results.push(playHand([p0, p1], up, true, draw));
    }
    let wager = 0;
    for (const [, b] of results)
        wager += b;
    const anyLive = results.some(([t]) => t <= 21);
    const dTot = anyLive ? dealerPlay([up, hole], draw) : 0;
    let ret = 0;
    for (const [t, b] of results) {
        if (t > 21)
            continue; // bust → lose
        if (dTot > 21 || t > dTot)
            ret += 2 * b; // win
        else if (t === dTot)
            ret += 1 * b; // push
    }
    return [wager, ret];
}
const rankOfCard = (card) => Number(card.slice(card.indexOf(':') + 1));
const valOfCard = (card) => { const r = rankOfCard(card); return r === 1 ? 11 : r >= 10 ? 10 : r; };
/**
 * Settle one round dealt PDPD, reading each card ON DEMAND from `card(i)`.
 *
 * This entry point exists because a round has NO bounded depth (round-4 QA-03). The binding test
 * used to pre-shuffle a fixed 24-card prefix on the stated premise that "a round never consumes
 * more"; a valid eight-deck round of two 12-card split hands against a nine-card dealer hand
 * reads through index 32, so that premise is false and the tail it read was unshuffled. A caller
 * that supplies a lazily shuffled source here cannot have that problem at any depth: the card is
 * shuffled at the moment it is requested.
 */
function settleShoeAt(card) {
    let ptr = 4;
    const draw = () => valOfCard(card(ptr++));
    return playRound(valOfCard(card(0)), valOfCard(card(1)), valOfCard(card(2)), valOfCard(card(3)), rankOfCard(card(0)), rankOfCard(card(2)), draw);
}
/** Settle one round dealt PDPD off an already-shuffled 416-card shoe. Returns [wagered, returned]. */
function settleShoe(shoe) {
    return settleShoeAt((i) => shoe[i]);
}

  },
  "src/shuffle.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * The lazy (incremental) Fisher-Yates shuffle — ONE importable, side-effect-free implementation,
 * so that the thing the regression tests exercise is the thing the simulator and the binding test
 * actually run.
 *
 * WHY THIS MODULE EXISTS.
 *
 * `tests/blackjack/rngTests.ts` carries three depth-uniformity tests whose stated purpose is to
 * guard against the fixed-24-card-prefix defect: an earlier `src/simulate.ts` pre-shuffled only
 * the first 24 positions per round and then read past them, sampling UNSHUFFLED tail positions on
 * deep rounds. Those tests contained their OWN private copy of the shuffle loop, so they guarded
 * a copy nothing shipped. Executed counterexample (round-4 QA-02): changing the real simulator's
 * loop condition from `frontier <= k` to `frontier <= k && frontier < 24` — reintroducing exactly
 * the defect — left all three depth tests green. A regression guard that cannot see the
 * regression is not a guard.
 *
 * The same 24-card premise had also been written into `tests/blackjack/roundEngineTests.ts` as a
 * fact ("a round never consumes more"). It is false: a valid eight-deck round of two 12-card
 * split hands and a nine-card dealer hand reads through index 32 (round-4 QA-03). Because the
 * shuffle here is on demand, a caller that reads index 32 gets index 32 shuffled — there is no
 * depth constant left to be wrong about.
 *
 * WHY EXTRACTING THIS IS SAFE, where extracting the round logic was not.
 *
 * `src/round-engine.ts` documents why the round logic was deliberately COPIED rather than lifted
 * out of `simulate.ts`: `outputs/simulation-results.json` is frozen and hash-pinned, so a refactor
 * of the instrument that produced it could not be re-run to prove it behaviour-preserving. That
 * argument does not apply here, because this extraction is provably equivalent without re-running
 * anything: the shuffler is a pure function of its injected random source, and `rngTests.ts`
 * asserts that the same source produces the same permutation. The frozen artifact is not
 * regenerated and its pin does not move.
 *
 * SIDE-EFFECT FREE. Importing this module allocates nothing, draws no randomness and starts no
 * simulation — the property `simulate.ts` lacks (it runs 30M rounds on import), and the reason
 * the tests could not simply import the original.
 *
 * BEHAVIOUR, stated precisely because three call sites depend on it:
 *   - `items` is held IN PLACE; nothing is copied.
 *   - `ensure(k)` advances the frontier so positions 0..k are FIXED: position f is settled by a
 *     uniform draw from [f, size), the standard Fisher-Yates step. A settled position is never
 *     re-drawn, so `at(k)` is idempotent.
 *   - `reset()` returns the frontier to 0 WITHOUT restoring the array. The next round therefore
 *     re-shuffles from the current arrangement, exactly as a continuous shuffler does and exactly
 *     as the inline loop did. Uniformity at every depth comes from the draw, not from the
 *     starting arrangement.
 *   - RANDOMNESS IS INJECTED as `randBelow(n) -> integer in [0, n)`, not as a float source. That
 *     keeps each caller's existing statistics exactly: `simulate.ts` passes
 *     `(n) => (Math.random() * n) | 0`, the depth tests pass a seeded PRNG in the same shape, and
 *     `roundEngineTests.ts` passes `crypto.randomInt`, which is exactly uniform with no modulo
 *     bias. A shared float-to-index conversion here would have silently changed one of them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRankShoe = buildRankShoe;
exports.createLazyShuffler = createLazyShuffler;
/** An 8-deck (by default) rank multiset: 1..13, `4 × decks` copies of each, in order. */
function buildRankShoe(decks = 8) {
    const ranks = [];
    for (let r = 1; r <= 13; r++)
        for (let k = 0; k < 4 * decks; k++)
            ranks.push(r);
    return ranks;
}
/**
 * Build a lazy Fisher-Yates shuffler over `items`, driven by the injected `randBelow`.
 * Constructing one draws no randomness; only `ensure`/`at` do.
 */
function createLazyShuffler(items, randBelow) {
    const size = items.length;
    let f = 0;
    const ensure = (k) => {
        while (f <= k) {
            const j = f + randBelow(size - f);
            const t = items[f];
            items[f] = items[j];
            items[j] = t;
            f++;
        }
    };
    return {
        items,
        size,
        ensure,
        at: (k) => { ensure(k); return items[k]; },
        reset: () => { f = 0; },
        frontier: () => f,
    };
}

  },
  "src/sidebet-edges.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Exact side-bet house edges, in integer arithmetic, from the SAME evaluator the verifier
 * scores live bets with (`src/sidebets.ts`, paytables from `src/config.ts`).
 *
 * WHY THIS FILE EXISTS. The enumeration lived only inside `tests/blackjack/sideBetEdgeTests.ts`,
 * so the published figures (Perfect Pairs 2.169%, 21+3 3.704%, and the 12:1 counterfactual
 * 4.096%) had a producer that no artifact could quote — the framework's prose check calls that an
 * orphan figure. The enumeration now lives here, has exactly one implementation, and is consumed
 * by two readers: the mocha anchor gate and `src/report-figures.ts`, which emits the numbers into
 * `outputs/report-figures.json` so every prose citation traces to a producing artifact (S-CONST).
 *
 * The enumeration is over the 52 distinct card TYPES with multiplicity 8, not over 416 physical
 * cards: both evaluators are symmetric in their arguments, so the hypergeometric weights below
 * give the exact unordered draw distribution.
 *
 *   2 cards:  C(52,2)·8·8            + 52·C(8,2)                       = 86,320     = C(416,2)
 *   3 cards:  C(52,3)·8·8·8 + 52·51·C(8,2)·8 + 52·C(8,3)               = 11,912,160 = C(416,3)
 *
 * Each result carries its own `total`, and callers assert it against C(416,k) so a bug in the
 * weights cannot pass silently.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOE_TRIPLE_COMBINATIONS = exports.SHOE_PAIR_COMBINATIONS = exports.TYPES = void 0;
exports.binom = binom;
exports.reduce = reduce;
exports.perfectPairsEdgeExact = perfectPairsEdgeExact;
exports.twentyOnePlusThreeEdgeExact = twentyOnePlusThreeEdgeExact;
const sidebets_1 = require("./sidebets");
const config_1 = require("./config");
const SUITS = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
/** The 52 distinct card types, in the encoding `src/sidebets.ts` parses. */
exports.TYPES = (() => {
    const t = [];
    for (const s of SUITS)
        for (let r = 1; r <= 13; r++)
            t.push(`${s}:${r}`);
    return t;
})();
/** Exact binomial C(n,k) in BigInt. */
function binom(n, k) {
    let num = 1n;
    let den = 1n;
    for (let i = 0n; i < k; i++) {
        num *= n - i;
        den *= i + 1n;
    }
    return num / den;
}
const COPIES = BigInt(config_1.DECKS); // 8 physical copies of each of the 52 types
const PAIR_SAME = binom(COPIES, 2n); // C(8,2) = 28
const TRIPLE_SAME = binom(COPIES, 3n); // C(8,3) = 56
/** gcd-reduced fraction, so an assertion can be on the exact rational rather than a float. */
function reduce(n, d) {
    const g = (a, b) => (b === 0n ? (a < 0n ? -a : a) : g(b, a % b));
    const k = g(n, d);
    return [n / k, d / k];
}
function finish(surplus, total) {
    const [n, d] = reduce(surplus, total);
    return {
        num: Number(n),
        den: Number(d),
        rational: `${n}/${d}`,
        edge: Number(n) / Number(d),
        rtp: 1 - Number(n) / Number(d),
        total: total.toString(),
    };
}
/**
 * Perfect Pairs over the player's first two cards.
 *
 * `coloredPairOverride` replaces the COLORED_PAIR payout without touching `src/config.ts` — used
 * for a hypothetical 12:1 sensitivity calculation, not an observed LIQD paytable. Omit it and
 * the paytable is read from config, unmodified.
 */
function perfectPairsEdgeExact(coloredPairOverride) {
    let returned = 0n; // Σ weight × units returned (stake + win; a loser returns 0)
    let total = 0n;
    const unitsBack = (a, b) => {
        const r = (0, sidebets_1.evaluatePerfectPairs)(a, b);
        const pay = coloredPairOverride !== undefined && r.category === 'COLORED_PAIR'
            ? coloredPairOverride
            : r.payout;
        return BigInt(pay > 0 ? pay + 1 : 0);
    };
    for (let i = 0; i < 52; i++) {
        total += PAIR_SAME;
        returned += PAIR_SAME * unitsBack(exports.TYPES[i], exports.TYPES[i]); // two copies of one type
        for (let j = i + 1; j < 52; j++) {
            const w = COPIES * COPIES;
            total += w;
            returned += w * unitsBack(exports.TYPES[i], exports.TYPES[j]);
        }
    }
    return finish(total - returned, total);
}
/** 21+3 over the player's first two cards plus the dealer upcard. */
function twentyOnePlusThreeEdgeExact() {
    let returned = 0n;
    let total = 0n;
    const add = (w, a, b, c) => {
        total += w;
        const pay = (0, sidebets_1.evaluate21Plus3)(a, b, c).payout;
        returned += w * BigInt(pay > 0 ? pay + 1 : 0);
    };
    for (let i = 0; i < 52; i++) {
        add(TRIPLE_SAME, exports.TYPES[i], exports.TYPES[i], exports.TYPES[i]); // three copies of one type
        for (let j = 0; j < 52; j++) {
            if (j === i)
                continue;
            add(PAIR_SAME * COPIES, exports.TYPES[i], exports.TYPES[i], exports.TYPES[j]); // a pair of i plus one j
        }
        for (let j = i + 1; j < 52; j++) {
            for (let k = j + 1; k < 52; k++)
                add(COPIES ** 3n, exports.TYPES[i], exports.TYPES[j], exports.TYPES[k]);
        }
    }
    return finish(total - returned, total);
}
/** C(416,2) and C(416,3) — the totals every enumeration above must reproduce. */
exports.SHOE_PAIR_COMBINATIONS = binom(BigInt(config_1.SHOE_SIZE), 2n).toString();
exports.SHOE_TRIPLE_COMBINATIONS = binom(BigInt(config_1.SHOE_SIZE), 3n).toString();

  },
  "src/sidebets.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Independent evaluators for the two blackjack side bets, using LIQD's confirmed
 * paytables (src/config.ts). Used by verify.ts to re-derive every recorded side-bet
 * outcome from the cards alone, and by simulate.ts for side-bet RTP.
 *
 * Perfect Pairs — the player's first two cards.
 * 21+3 — the player's first two cards + the dealer upcard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePerfectPairs = evaluatePerfectPairs;
exports.evaluate21Plus3 = evaluate21Plus3;
const config_1 = require("./config");
const isRed = (card) => (0, config_1.suitOf)(card) === 'HEART' || (0, config_1.suitOf)(card) === 'DIAMOND';
/** Perfect Pairs on two cards. */
function evaluatePerfectPairs(c1, c2) {
    // LIQD labels a losing Perfect Pairs bet `NO_PAIR`, but a losing 21+3 bet `NO_MATCH`.
    // The two side bets genuinely use different vocabulary; the category comparison in
    // Step 15 is against LIQD's own `gameResult`, so this string must match exactly.
    if ((0, config_1.rankOf)(c1) !== (0, config_1.rankOf)(c2))
        return { category: 'NO_PAIR', payout: 0 };
    if ((0, config_1.suitOf)(c1) === (0, config_1.suitOf)(c2))
        return { category: 'PERFECT_PAIR', payout: config_1.PERFECT_PAIRS.PERFECT_PAIR };
    if (isRed(c1) === isRed(c2))
        return { category: 'COLORED_PAIR', payout: config_1.PERFECT_PAIRS.COLORED_PAIR };
    return { category: 'MIXED_PAIR', payout: config_1.PERFECT_PAIRS.MIXED_PAIR };
}
function isThreeStraight(a, b, c) {
    const consec = (rs) => {
        const s = [...rs].sort((x, y) => x - y);
        return s[0] + 1 === s[1] && s[1] + 1 === s[2];
    };
    if (consec([a, b, c]))
        return true;
    // Ace-high: A(1) counts as 14 for Q-K-A
    return consec([a, b, c].map((r) => (r === 1 ? 14 : r)));
}
/** 21+3 on the player's two cards + the dealer upcard. */
function evaluate21Plus3(c1, c2, dealerUp) {
    const cards = [c1, c2, dealerUp];
    const ranks = cards.map(config_1.rankOf);
    const suits = cards.map(config_1.suitOf);
    const flush = suits[0] === suits[1] && suits[1] === suits[2];
    const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const straight = isThreeStraight(ranks[0], ranks[1], ranks[2]);
    if (trips && flush)
        return { category: 'SUITED_THREE_OF_A_KIND', payout: config_1.TWENTY_ONE_PLUS_THREE.SUITED_THREE_OF_A_KIND };
    if (straight && flush)
        return { category: 'STRAIGHT_FLUSH', payout: config_1.TWENTY_ONE_PLUS_THREE.STRAIGHT_FLUSH };
    if (trips)
        return { category: 'THREE_OF_A_KIND', payout: config_1.TWENTY_ONE_PLUS_THREE.THREE_OF_A_KIND };
    if (straight)
        return { category: 'STRAIGHT', payout: config_1.TWENTY_ONE_PLUS_THREE.STRAIGHT };
    if (flush)
        return { category: 'FLUSH', payout: config_1.TWENTY_ONE_PLUS_THREE.FLUSH };
    return { category: 'NO_MATCH', payout: 0 };
}

  },
  "src/strategy.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * LIQD Blackjack — total-dependent basic strategy table.
 *
 * Single source of truth, imported by BOTH `simulate.ts` (which plays it) and
 * `exact-play.ts` (which computes its exact EV in TD mode). They must never
 * drift apart: the whole point of the exact TD figure is that it is the EV of
 * *this* table, so a second copy would silently invalidate the comparison.
 *
 * Because sim and solver now share this module they can also share a bug in it.
 * That is what the composition-dependent (CD) figure is for — CD chooses actions
 * by argmax and ignores this table entirely, so a mistake here shows up as an
 * abnormally large CD − TD gap.
 *
 * Rules encoded: S17, DAS, no re-split, split aces one card, double on any two.
 * `up` is the dealer upcard value (11 = A, 10 = T/J/Q/K, 2..9).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pairAction = pairAction;
exports.softAction = softAction;
exports.hardAction = hardAction;
exports.resolvedAction = resolvedAction;
/** Pair split decision. `null` = not a pair decision (5,5 is played as hard 10). */
function pairAction(rankVal, up) {
    switch (rankVal) {
        case 11: return 'P'; // A,A
        case 10: return 'H'; // 10,10 → never split (falls to hard 20 stand)
        case 9: return (up === 7 || up === 10 || up === 11) ? 'H' : 'P';
        case 8: return 'P';
        case 7: return (up >= 2 && up <= 7) ? 'P' : 'H';
        case 6: return (up >= 2 && up <= 6) ? 'P' : 'H'; // DAS
        case 5: return null; // treat as hard 10
        case 4: return (up === 5 || up === 6) ? 'P' : 'H'; // DAS
        case 3: return (up >= 2 && up <= 7) ? 'P' : 'H';
        case 2: return (up >= 2 && up <= 7) ? 'P' : 'H';
        default: return 'H';
    }
}
function softAction(t, up) {
    if (t >= 19)
        return 'S'; // A,8 A,9 — S17 stands
    if (t === 18) {
        if (up >= 3 && up <= 6)
            return 'Ds';
        if (up === 2 || up === 7 || up === 8)
            return 'S';
        return 'H';
    }
    if (t === 17)
        return (up >= 3 && up <= 6) ? 'D' : 'H'; // A,6
    if (t === 16 || t === 15)
        return (up >= 4 && up <= 6) ? 'D' : 'H'; // A,5 A,4
    if (t === 14 || t === 13)
        return (up >= 5 && up <= 6) ? 'D' : 'H'; // A,3 A,2
    return 'H';
}
function hardAction(t, up) {
    if (t >= 17)
        return 'S';
    if (t >= 13)
        return (up >= 2 && up <= 6) ? 'S' : 'H';
    if (t === 12)
        return (up >= 4 && up <= 6) ? 'S' : 'H';
    if (t === 11)
        return up === 11 ? 'H' : 'D'; // S17: double 2-10, hit vs A
    if (t === 10)
        return (up >= 2 && up <= 9) ? 'D' : 'H';
    if (t === 9)
        return (up >= 3 && up <= 6) ? 'D' : 'H';
    return 'H';
}
/**
 * The action for a non-pair hand, with the same fallbacks the simulation applies:
 * `D` on a hand of 3+ cards (or when doubling is not allowed) degrades to a hit,
 * and `Ds` degrades to a stand. The solver must mirror this exactly or the exact
 * TD figure would be the EV of a strategy nobody plays.
 */
function resolvedAction(total, soft, up, canDouble) {
    const a = soft ? softAction(total, up) : hardAction(total, up);
    if (a === 'D')
        return canDouble ? 'D' : 'H';
    if (a === 'Ds')
        return canDouble ? 'D' : 'S';
    return a;
}

  },
  "src/types.js": function (module, exports, require, __filename, __dirname) {
"use strict";
// Types mirror the exact capture schema in data/blackjack-6000hands.json
// (liqd-blackjack-capture-v1). Field names match the dataset verbatim.
Object.defineProperty(exports, "__esModule", { value: true });

  },
  "tests/__standalone-entry.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./blackjack/antiCircularityTests");
require("./blackjack/artifactTests");
require("./blackjack/exactOracleTests");
require("./blackjack/exactSolverTests");
require("./blackjack/optimalPlayTests");
require("./blackjack/rngTests");
require("./blackjack/roundEngineTests");
require("./blackjack/sideBetEdgeTests");
require("./blackjack/wooAnchorTests");

  },
  "tests/blackjack/antiCircularityTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Anti-circularity gate.
 *
 * The capture rig writes several fields that are its OWN recomputation of the game,
 * not observations of what LIQD returned:
 *
 *   Bet.localSequence   = shoe.slice(0, k)  — the rig's reconstructed shoe prefix
 *   Bet.verified        = the rig's own pass/fail verdict for that hand
 *   Seed.commitVerified = the rig's own commitment check
 *   Seed.chainLinkOk    = the rig's own next-seed chain check
 *
 * If any scored verification step read one of these, it would be comparing our
 * recomputation against our recomputation and reporting the tautology as proof.
 * The audit's claims must rest only on fields LIQD actually sent (dealt cards,
 * credited amounts, seeds, hashes, nonces) re-derived independently in `src/rng.ts`.
 *
 * TWO LAYERS, and they are not equally strong (round-2 QA items 14 and 22):
 *
 *  1. STRUCTURAL — `src/loader.ts` DELETES all four fields from every bet and seed as it
 *     loads the dataset. Every scored step loads through that one entry point, so no access
 *     pattern of any kind can read them. This is the guarantee; it is asserted below against
 *     the real dataset.
 *  2. LINT — the regex sweep below catches ACCIDENTAL use in source (dotted, literal-bracket
 *     and destructured access) and names the file. It is a style guard, not a proof: a
 *     computed key (`const K = 'veri' + 'fied'; b[K]`) is invisible to it, as the reviewers
 *     demonstrated. It exists to fail the build early and with a good message, not to
 *     establish independence.
 *
 * Independence of the audit's numbers is separately evidenced by two external reviewers
 * recomputing every scored figure from the dataset alone.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const loader_1 = require("../../src/loader");
/** Fields written by the capture rig from its own recomputation — never evidence. */
const CAPTURE_SIDE_FIELDS = ['localSequence', 'verified', 'commitVerified', 'chainLinkOk'];
const ROOT = path.resolve(__dirname, '..', '..');
/** Every source file that contributes to a scored verification result. */
function verificationSources() {
    const files = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name !== 'node_modules')
                    walk(p);
            }
            else if (e.name.endsWith('.ts') && !e.name.endsWith('Tests.ts'))
                files.push(p);
        }
    };
    walk(path.join(ROOT, 'tests', 'steps'));
    walk(path.join(ROOT, 'src'));
    files.push(path.join(ROOT, 'tests', 'verify.ts'));
    return files.filter((f) => fs.existsSync(f) && !f.endsWith(path.join('src', 'types.ts')));
}
/** Strip comments only — string literals are kept. */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}
/** Strip comments AND string literals so prose mentions don't register as usage. */
function codeOnly(src) {
    return stripComments(src)
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
describe('blackjack: anti-circularity — no capture-side field feeds a scored step', () => {
    const sources = verificationSources();
    it('finds the verification sources to scan', () => {
        node_assert_1.strict.ok(sources.length > 3, `only found ${sources.length} sources`);
    });
    for (const field of CAPTURE_SIDE_FIELDS) {
        it(`no verification source reads \`.${field}\``, () => {
            const offenders = [];
            for (const file of sources) {
                const raw = fs.readFileSync(file, 'utf8');
                const code = codeOnly(raw);
                // Indexed access `b['localSequence']` must be matched on the comment-stripped-but-
                // string-KEPT source: codeOnly() blanks string literals, which would turn
                // `b['verified']` into `b['']` and hide the very access this guard exists to catch.
                const withStrings = stripComments(raw);
                // property access (`b.localSequence`) and destructuring (`const { localSequence } = bet`)
                // run on the fully stripped source; indexed access runs on withStrings.
                const patterns = [
                    [new RegExp(`\\.\\s*${field}\\b`), code],
                    [new RegExp(`\\[\\s*['"\`]${field}['"\`]\\s*\\]`), withStrings],
                    [new RegExp(`\\{[^}]*\\b${field}\\b[^}]*\\}\\s*=`), code],
                ];
                if (patterns.some(([re, hay]) => re.test(hay)))
                    offenders.push(path.relative(ROOT, file));
            }
            node_assert_1.strict.deepEqual(offenders, [], `capture-side field \`${field}\` read by: ${offenders.join(', ')}`);
        });
    }
    it('the dataset does carry these fields (so the guard is not vacuous)', () => {
        const datasetDir = path.join(ROOT, 'data');
        const file = fs.readdirSync(datasetDir).find((f) => f.endsWith('.json'));
        node_assert_1.strict.ok(typeof file === 'string', 'dataset present');
        const raw = fs.readFileSync(path.join(datasetDir, file), 'utf8');
        // Guarding fields that are absent would prove nothing; confirm they exist to be misused.
        for (const field of CAPTURE_SIDE_FIELDS) {
            node_assert_1.strict.ok(raw.includes(`"${field}"`), `dataset should contain ${field}`);
        }
    });
    // ── The structural layer. This is the one that makes the guarantee true. ────────────────
    it('loader.ts declares exactly the four capture-side fields as strippable', () => {
        node_assert_1.strict.deepEqual([...loader_1.CAPTURE_SIDE_FIELDS].sort(), [...CAPTURE_SIDE_FIELDS].sort(), 'src/loader.ts CAPTURE_SIDE_FIELDS has drifted from the list this guard scans for');
    });
    it('loadDataset() returns bets and seeds with NO capture-side field present at all', () => {
        // Not "no source reads them" — literally not there. A computed key, a bracket access, a
        // destructure, JSON.stringify: none of them can recover a deleted property.
        const ds = (0, loader_1.loadDataset)();
        node_assert_1.strict.ok(ds.bets.length > 0 && ds.seeds.length > 0, 'dataset loaded non-empty');
        const offenders = [];
        for (const field of CAPTURE_SIDE_FIELDS) {
            const nBets = ds.bets.filter((b) => Object.prototype.hasOwnProperty.call(b, field)).length;
            const nSeeds = ds.seeds.filter((s) => Object.prototype.hasOwnProperty.call(s, field)).length;
            if (nBets || nSeeds)
                offenders.push(`${field}: ${nBets} bet(s), ${nSeeds} seed(s)`);
        }
        node_assert_1.strict.deepEqual(offenders, [], `loadDataset() left capture-side fields in place — ${offenders.join('; ')}`);
    });
    it('the strip is not vacuous: the same fields ARE present before stripping', () => {
        // If the raw records did not carry them, the previous test would pass on an empty premise.
        const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', fs.readdirSync(path.join(ROOT, 'data')).find((f) => f.endsWith('.json'))), 'utf8'));
        for (const field of CAPTURE_SIDE_FIELDS) {
            const n = [...raw.bets, ...raw.seeds].filter((r) => Object.prototype.hasOwnProperty.call(r, field)).length;
            node_assert_1.strict.ok(n > 0, `no raw record carries ${field} — the strip would be vacuous`);
        }
    });
});

  },
  "tests/blackjack/artifactTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../../src/config");
const money_1 = require("../../src/money");
/**
 * Artifact-integrity guards.
 *
 * TWO KINDS, and the repo needs both.
 *
 * 1. FORMATTING. The generators write canonical 2-space JSON, so any hand edit that changes a
 *    value or the formatting breaks a round-trip against JSON.stringify(..., null, 2).
 *    simulate.ts writes NO trailing newline; exact-play.ts writes one. This catches the exact
 *    failure mode that once shipped — edit a value in place, re-serialise part of the file,
 *    forget the twin — but it does NOT catch a value edit that stays canonical (round-2 QA
 *    item 15: MANIFEST.md overstated this).
 *
 * 2. VALUE. All SIX committed inputs are hash-pinned in src/config.ts — DATASET_SHA256,
 *    SIMULATION_SHA256, SIMULATION_HTML_SHA256, EXACT_RTP_SHA256, ATTACK_SHA256 and
 *    RNG_BRANCH_SHA256 — and each pin is asserted here. (This paragraph used to say exact-rtp.json was "not hash-pinned", and the very next
 *    test in this file asserted its pin. The pin was added when a forged-artifact probe planted
 *    self-consistent nonsense in that file and the verifier scored 31/31 without reading it;
 *    the comment was not updated with it. Round-3 QA item B13.)
 *
 * exact-rtp.json carries a SECOND, stronger guard on top of its pin: a field-by-field live
 * re-derivation in tests/blackjack/exactSolverTests.ts. A hash says the bytes have not moved;
 * the re-derivation says the numbers are the real solve.
 *
 * 3. POPULATION SHAPE. The simulation artifact's declared experiment — base-game round count,
 *    Pass-1 round count and df, Pass-2 seed count — is bound to the pins in src/config.ts here
 *    as well as in the scored steps. Before round 3, no mocha test read `pass1_fresh_seeds` or
 *    `pass2_casino_seeds` at all, and the scored steps read their own gate parameters out of
 *    those blocks.
 *
 * outputs/verification-results.json is the suite's OUTPUT, not an input, and is deliberately
 * unpinned — pinning a file the run rewrites would only pin the last run.
 *
 * NOTE on where the pins are ENFORCED at run time: `tests/verify.ts` used to abort the process
 * on a mismatch before a single step printed, which made an artifact forgery look like a crash
 * to any harness reading the run (gate-forgery.sh scored such probes NOT RUN rather than
 * CAUGHT) and made a DELETED artifact skip the guard entirely. Enforcement now lives in scored
 * Step 25 (Artifact Hash Integrity), which asserts presence and hash for all six.
 */
const OUT = path.join(__dirname, '..', '..', 'outputs');
const DATA = path.join(__dirname, '..', '..', 'data', 'blackjack-6000hands.json');
const sha256 = (p) => (0, crypto_1.createHash)('sha256').update(fs.readFileSync(p)).digest('hex');
describe('artifact integrity — every committed input matches its pin in src/config.ts', () => {
    it('data/blackjack-6000hands.json hash matches DATASET_SHA256', () => {
        const actual = sha256(DATA);
        node_assert_1.strict.equal(actual, config_1.DATASET_SHA256, `blackjack-6000hands.json hash ≠ the pinned DATASET_SHA256 — expected ${config_1.DATASET_SHA256}, got ${actual}`);
    });
    it('outputs/simulation-results.json hash matches SIMULATION_SHA256', () => {
        const actual = sha256(path.join(OUT, 'simulation-results.json'));
        node_assert_1.strict.equal(actual, config_1.SIMULATION_SHA256, `simulation-results.json hash ≠ the pinned SIMULATION_SHA256 — expected ${config_1.SIMULATION_SHA256}, got ${actual}. ` +
            'Re-run `npm run simulate` and re-pin, or restore the committed artifact.');
    });
    it('outputs/rtp-convergence.html hash matches SIMULATION_HTML_SHA256', () => {
        const actual = sha256(path.join(OUT, 'rtp-convergence.html'));
        node_assert_1.strict.equal(actual, config_1.SIMULATION_HTML_SHA256, `rtp-convergence.html hash ≠ the pinned SIMULATION_HTML_SHA256 — expected ${config_1.SIMULATION_HTML_SHA256}, got ${actual}. ` +
            'The chart and the JSON are one `npm run simulate` and must move together.');
    });
    it('outputs/cherry-pick-attack.json hash matches ATTACK_SHA256', () => {
        const actual = sha256(path.join(OUT, 'cherry-pick-attack.json'));
        node_assert_1.strict.equal(actual, config_1.ATTACK_SHA256, `cherry-pick-attack.json hash ≠ the pinned ATTACK_SHA256 — expected ${config_1.ATTACK_SHA256}, got ${actual}. ` +
            'It is deterministic: re-run `npm run attack`.');
    });
    it('outputs/rng-branch-coverage.json hash matches RNG_BRANCH_SHA256', () => {
        const actual = sha256(path.join(OUT, 'rng-branch-coverage.json'));
        node_assert_1.strict.equal(actual, config_1.RNG_BRANCH_SHA256, `rng-branch-coverage.json hash ≠ the pinned RNG_BRANCH_SHA256 — expected ${config_1.RNG_BRANCH_SHA256}, got ${actual}. ` +
            'It is deterministic: re-run `npm run branches`.');
    });
    it('outputs/exact-rtp.json hash matches EXACT_RTP_SHA256', () => {
        const actual = sha256(path.join(OUT, 'exact-rtp.json'));
        node_assert_1.strict.equal(actual, config_1.EXACT_RTP_SHA256, `exact-rtp.json hash ≠ the pinned EXACT_RTP_SHA256 — expected ${config_1.EXACT_RTP_SHA256}, got ${actual}. ` +
            'The file is deterministic: re-run `npm run rtp`. If it still differs, the solver changed.');
    });
});
describe('artifact integrity — the simulation artifact declares the experiment the code pins', () => {
    // The gate parameters used to come out of these blocks: Step 17 took sigma from
    // `baseGame.rounds`, Step 18 took the chi-squared df from `pass1_fresh_seeds.firstCardDf`,
    // and Step 19 took p0 from `pass2_casino_seeds.expectedFlagsByChance / seeds_tested`. Each
    // was forgeable into a looser test. They are pinned in src/config.ts now, and the artifact
    // has to agree with the pins — asserted here as well as in the scored steps, because nothing
    // in mocha read either block before round 3.
    const sim = JSON.parse(fs.readFileSync(path.join(OUT, 'simulation-results.json'), 'utf8'));
    it('baseGame.rounds equals the pinned SIM_BASE_ROUNDS (the tolerance is not the artifact\'s to set)', () => {
        node_assert_1.strict.equal(sim.baseGame.rounds, config_1.SIM_BASE_ROUNDS);
    });
    it('pass1_fresh_seeds declares the pinned round count and RANKS-1 degrees of freedom', () => {
        node_assert_1.strict.equal(sim.pass1_fresh_seeds.rounds, config_1.SIM_PASS1_ROUNDS);
        node_assert_1.strict.equal(sim.pass1_fresh_seeds.firstCardDf, config_1.FIRST_CARD_DF, `a first-card rank test over ${config_1.RANKS} ranks has ${config_1.FIRST_CARD_DF} df; the artifact does not get to choose`);
    });
    it('pass2_casino_seeds covers exactly EXPECTED_SEEDS epochs, one result row each', () => {
        node_assert_1.strict.equal(sim.pass2_casino_seeds.seeds_tested, config_1.EXPECTED_SEEDS);
        node_assert_1.strict.equal(sim.pass2_casino_seeds.results.length, config_1.EXPECTED_SEEDS);
        const uniq = new Set(sim.pass2_casino_seeds.results.map((r) => r.hashedServerSeed));
        node_assert_1.strict.equal(uniq.size, config_1.EXPECTED_SEEDS, 'duplicate hashedServerSeed among the Pass-2 result rows');
    });
    it('the Pass-2 early window is the served window the capture plan declares', () => {
        node_assert_1.strict.deepEqual(sim.pass2_casino_seeds.earlyWindow, [0, config_1.PASS2_EARLY_NONCES - 1]);
    });
});
/**
 * THE CHERRY-PICK FLAG PREDICATE — one definition, and the attack artifact obeys it.
 *
 * Round-4 QA-04. `src/cherry-pick-attack.ts` scored its selected blocks on the EARLY half alone
 * (`p < α`) and labelled the result "Step 19", then reported a chance rate of 120 × α and a
 * binomial survival at p₀ = α. Step 19 requires early-extreme AND late-quiet, whose per-seed null
 * probability is α(1−α). The predicate now lives once, in `src/config.ts`; these tests execute it
 * — including the case the early-only version got wrong — and bind the artifact's own flag column
 * to it, so a future drift is a red test rather than a paragraph.
 */
describe('cherry-pick detector — the flag predicate and the attack artifact agree', () => {
    const atk = JSON.parse(fs.readFileSync(path.join(OUT, 'cherry-pick-attack.json'), 'utf8'));
    it('flags only when the early window is extreme AND the late window is not', () => {
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(0.01, 0.40), true, 'early-extreme, late-quiet must flag');
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(0.40, 0.40), false, 'a quiet early window must not flag');
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(config_1.PASS2_ALPHA, 0.40), false, 'the early test is strict (<α), not ≤α');
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(0.01, config_1.PASS2_ALPHA), true, 'the late test is ≥α, so exactly α is quiet');
    });
    it('does NOT flag when BOTH windows are extreme — the case the early-only version got wrong', () => {
        // A seed whose late control window is ALSO significant is a seed with a persistent
        // irregularity, not the early-only signature of a selected block. Step 19 declines to flag
        // it; the attack script's old `p < α` test would have flagged it, which is precisely why its
        // reported chance rate and survival probability described a different detector.
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(0.01, 0.01), false, 'both windows extreme must NOT flag');
        node_assert_1.strict.equal((0, config_1.cherryPickFlag)(0.0001, 0.049), false, 'a late p just under α must NOT flag');
    });
    it('the per-seed null probability is α(1−α), and the artifact uses it', () => {
        node_assert_1.strict.equal(config_1.PASS2_P0, config_1.PASS2_ALPHA * (1 - config_1.PASS2_ALPHA));
        node_assert_1.strict.equal(atk.detector.nullFlagProbability, config_1.PASS2_P0, 'the attack artifact scored its flags against a null other than the declared one');
        node_assert_1.strict.equal(atk.detector.expectedFlagsByChance, config_1.EXPECTED_SEEDS * config_1.PASS2_P0);
    });
    it('every row of the attack artifact carries both windows and obeys the shared predicate', () => {
        const rows = atk.results;
        node_assert_1.strict.equal(rows.length, config_1.EXPECTED_SEEDS);
        let flags = 0;
        for (const r of rows) {
            node_assert_1.strict.equal(typeof r.servedWindowBootstrapP, 'number', `epoch ${String(r.epoch)} has no early p`);
            node_assert_1.strict.equal(typeof r.lateWindowPValue, 'number', `epoch ${String(r.epoch)} has no late p — the late window was not computed`);
            node_assert_1.strict.equal(r.lateWindowDf, config_1.FIRST_CARD_DF, `the late window is ${config_1.RANKS} unpooled bins, so it must carry df ${config_1.FIRST_CARD_DF}`);
            const expected = (0, config_1.cherryPickFlag)(Number(r.servedWindowBootstrapP), Number(r.lateWindowPValue));
            node_assert_1.strict.equal(r.step19Flag, expected, `epoch ${String(r.epoch)}: recorded flag disagrees with the predicate`);
            if (expected)
                flags++;
        }
        node_assert_1.strict.equal(atk.detector.step19FlagsOnSelectedBlocks, flags, 'the artifact\'s flag total disagrees with the count recomputed from its own rows');
    });
});
describe('artifact integrity — committed outputs are canonical, un-hand-edited JSON', () => {
    it('cherry-pick-attack.json and rng-branch-coverage.json round-trip canonical 2-space JSON', () => {
        for (const f of ['cherry-pick-attack.json', 'rng-branch-coverage.json']) {
            const raw = fs.readFileSync(path.join(OUT, f), 'utf8');
            node_assert_1.strict.equal(JSON.stringify(JSON.parse(raw), null, 2), raw, `${f} is not byte-identical to its canonical re-serialisation — hand-edited or reformatted`);
        }
    });
    it('simulation-results.json round-trips canonical 2-space JSON with NO trailing newline (simulate.ts)', () => {
        const raw = fs.readFileSync(path.join(OUT, 'simulation-results.json'), 'utf8');
        node_assert_1.strict.equal(JSON.stringify(JSON.parse(raw), null, 2), raw, 'simulation-results.json is not byte-identical to its canonical re-serialisation — hand-edited or reformatted');
    });
    it('exact-rtp.json round-trips canonical 2-space JSON PLUS one trailing newline (exact-play.ts)', () => {
        const raw = fs.readFileSync(path.join(OUT, 'exact-rtp.json'), 'utf8');
        node_assert_1.strict.equal(JSON.stringify(JSON.parse(raw), null, 2) + '\n', raw, 'exact-rtp.json is not byte-identical to its canonical re-serialisation + trailing newline — hand-edited');
    });
});
/**
 * MONEY ON THE SETTLEMENT GRID — the conversion every payout check now runs on.
 *
 * Round-4 QA-01. The payout comparisons were a 1e-6 float tolerance, which accepts a wrong amount
 * that happens to sit on the grid: `0.20 → 0.1999995` is 50 whole settlement units short and the
 * complete suite stayed green. They are integer equality in 1e-8 units now, and the only tolerance
 * left is `GRID_TOL`, which exists solely to read a JSON double back onto the grid. These tests pin
 * the two things that constant has to do at once: absorb the real IEEE-754 noise in the committed
 * dataset, and never absorb a one-unit money error.
 */
describe('money — recorded amounts convert to exact 1e-8 settlement units', () => {
    it('reads the dataset\'s worst float artifact as the amount it is meant to be', () => {
        // The largest representation deviation in the committed capture: epoch 2 nonce 25's round
        // credit. Approximately 5.96e-8 grid units off 4.60, and it must read as exactly 460,000,000 units.
        node_assert_1.strict.equal((0, money_1.unitsOf)(4.6000000000000005), 460000000);
        node_assert_1.strict.equal((0, money_1.asMoney)((0, money_1.unitsOf)(4.6000000000000005)), '4.60000000');
        node_assert_1.strict.equal((0, money_1.unitsOf)('0.10000000'), 10000000, 'string amounts convert the same way');
        node_assert_1.strict.equal((0, money_1.unitsOf)(0.25), 25000000);
        node_assert_1.strict.equal((0, money_1.unitsOf)(0), 0);
    });
    it('separates a ONE-UNIT money error from float noise', () => {
        // The smallest discrepancy the grid admits. If GRID_TOL ever absorbed this, the exact
        // comparison would silently become a tolerance again.
        node_assert_1.strict.notEqual((0, money_1.unitsOf)(0.19999999), (0, money_1.unitsOf)(0.2));
        node_assert_1.strict.equal((0, money_1.unitsOf)(0.2) - (0, money_1.unitsOf)(0.19999999), 1);
        // And the reviewer's executed counterexample: 50 units, far below the retired 1e-6 tolerance.
        node_assert_1.strict.equal((0, money_1.unitsOf)(0.2) - (0, money_1.unitsOf)(0.1999995), 50);
        node_assert_1.strict.ok(Math.abs(0.2 - 0.1999995) < 1e-6, 'the old tolerance really was blind to it');
    });
    it('refuses an OFF-grid amount rather than rounding it', () => {
        node_assert_1.strict.equal((0, money_1.unitsOf)(0.250000001), null, 'a +1e-9 perturbation is not a settlement amount');
        node_assert_1.strict.equal((0, money_1.unitsOf)(Number.NaN), null);
        node_assert_1.strict.equal((0, money_1.unitsOf)(Number.POSITIVE_INFINITY), null);
        node_assert_1.strict.equal((0, money_1.unitsOf)(null), null);
        node_assert_1.strict.equal((0, money_1.unitsOf)(undefined), null);
        node_assert_1.strict.equal((0, money_1.unitsOr0)(null), 0, 'an absent optional component sums as zero');
    });
    it('GRID_TOL sits far above the dataset\'s measured noise and far below one unit', () => {
        // Both directions asserted, so neither can be widened without a red test.
        const worstMeasuredNoise = Math.abs(4.6000000000000005 * money_1.GRID - 460000000);
        node_assert_1.strict.ok(worstMeasuredNoise < money_1.GRID_TOL / 100, `measured noise ${worstMeasuredNoise} must sit well inside GRID_TOL ${money_1.GRID_TOL}`);
        node_assert_1.strict.ok(money_1.GRID_TOL < 0.5, 'GRID_TOL must be far below the half-unit that would round a real error away');
    });
});

  },
  "tests/blackjack/exactOracleTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Tiny-shoe oracle — the external anchor the exact solver never had.
 *
 * WHY THIS FILE EXISTS. Until 2026-08-23 every check on `src/exact-play.ts` compared
 * the engine to ITSELF: infinite-deck agreement, finite->infinite convergence, deltas
 * between two runs in the mutation battery, and a 3-sigma simulation gate whose sigma
 * (0.0210 pp) is an order of magnitude coarser than the errors that matter. Not one
 * compared it to an independently derived value at a finite deck count — and the only
 * external anchor, the infinite-deck reference, is precisely the regime where the
 * peek-conditioning bug is identically zero. So a real algebraic defect sat in the
 * peek branch, produced a wrong figure in the 4th decimal, and passed 17/17 tests.
 *
 * These expectations are EXACT RATIONALS from a physical enumerator: the hole is a
 * concrete dealt card, both split hands are played sequentially against a genuinely
 * depleted shoe, and no conditioning appears anywhere — so it cannot be wrong the same
 * way the solver was. Values are exact fractions, not decimals, and are asserted at
 * 1e-12: a tolerance any 1/N conditioning error would blow straight through.
 *
 *   control  437/13200     — no Ten and no Ace, so the peek path is UNREACHABLE.
 *                            Localises any future regression to peek vs. core engine.
 *   peekA    17081/194040  — Ten/Ace heavy; the old solver was off by -2.472e-4 here.
 *   peekB    78863/900900  — split-heavy peek shoe; old solver off by +2.683e-3.
 *
 * If one of these ever fails, the number in the report is wrong. That is the point.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const exact_play_1 = require("../../src/exact-play");
/** Rank order is [2..9, T, A]; index 8 = Ten, index 9 = Ace. */
const SHOES = [
    {
        name: 'control — peek path unreachable (no Ten, no Ace)',
        counts: [3, 0, 0, 0, 0, 3, 3, 3, 0, 0],
        exact: [437, 13200],
        note: 'proves the core engine (recursion, splits, DAS, dealer play, settlement) is sound',
    },
    {
        name: 'peekA — Ten/Ace heavy',
        counts: [0, 0, 0, 0, 0, 2, 2, 2, 5, 3],
        exact: [17081, 194040],
        note: 'pre-fix solver was off by -2.472e-4',
    },
    {
        name: 'peekB — split-heavy peek shoe',
        counts: [2, 0, 0, 0, 0, 0, 2, 2, 4, 3],
        exact: [78863, 900900],
        note: 'pre-fix solver was off by +2.683e-3',
    },
];
/** Solve an arbitrary composition. The shoe is normally built from a deck count. */
function solveShoe(counts) {
    const s = new exact_play_1.ExactSolver({ kind: 'finite', decks: 1 }, 'TD', exact_play_1.LIQD_RULES);
    s.shoe = Int32Array.from(counts);
    s.dealerMemo.clear();
    s.handMemo.clear();
    s.outcomeMemo.clear();
    return s.solve().evPerInitialBet;
}
describe('Exact solver — tiny-shoe rational oracle (independent anchor)', () => {
    for (const { name, counts, exact, note } of SHOES) {
        const [num, den] = exact;
        it(`reproduces ${num}/${den} exactly — ${name}`, () => {
            const got = solveShoe(counts);
            const want = num / den;
            assert_1.strict.ok(Math.abs(got - want) < 1e-12, `${name}\n  expected ${want.toFixed(15)} (= ${num}/${den})\n  ` +
                `got      ${got.toFixed(15)}\n  delta    ${(got - want).toExponential(3)}\n  ${note}`);
        });
    }
    it('the control shoe and the peek shoes are genuinely different code paths', () => {
        // Guards the localisation property: if someone makes the peek branch unreachable,
        // the control test would still pass and silently stop proving anything.
        const control = SHOES[0].counts;
        assert_1.strict.equal(control[8], 0, 'control shoe must contain no Ten');
        assert_1.strict.equal(control[9], 0, 'control shoe must contain no Ace');
        assert_1.strict.ok(SHOES[1].counts[8] > 0 && SHOES[1].counts[9] > 0, 'peekA must contain both');
        assert_1.strict.ok(SHOES[2].counts[8] > 0 && SHOES[2].counts[9] > 0, 'peekB must contain both');
    });
});
describe('Exact solver — the oracle can actually fail (falsifiability)', () => {
    it('detects a reintroduced peek-conditioning error', () => {
        // Reproduce the OLD math on peekA by asserting the oracle rejects it. 0.087781086157710
        // is what the defective solver returned; if this ever compares equal, the tolerance has
        // been loosened to the point where the oracle no longer guards anything.
        const preFixValue = 0.087781086157710;
        const want = 17081 / 194040;
        assert_1.strict.ok(Math.abs(preFixValue - want) > 1e-12, 'the pre-fix value must be distinguishable from the exact value at this tolerance');
    });
});

  },
  "tests/blackjack/exactSolverTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Exact solver — publication gate for the engine.
 *
 * The engine replaces an infinite-deck anchor that modelled the wrong game, so
 * these tests exist to prove it is right *and* falsifiable, not merely that it
 * produces a number. Solves are cached across tests: an 8-deck solve takes tens of seconds.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exact_play_1 = require("../../src/exact-play");
const optimal_play_1 = require("../../src/optimal-play");
const config_1 = require("../../src/config");
const simResults = __importStar(require("../../outputs/simulation-results.json"));
const cache = new Map();
function solve(model, strategy, rules = exact_play_1.LIQD_RULES, tag = '') {
    const k = JSON.stringify(model) + strategy + tag;
    let r = cache.get(k);
    if (!r) {
        r = (0, exact_play_1.solveExact)(model, strategy, rules);
        cache.set(k, r);
    }
    return r;
}
const pct = (r) => r.edgePerInitialBet * 100;
describe('Exact solver — infinite mode reproduces the published infinite-deck reference engine', () => {
    it('matches the legacy infinite-deck solver to floating-point precision', () => {
        const legacy = (0, optimal_play_1.computeOptimalRTP)('stand', true).rtp;
        const fresh = solve({ kind: 'infinite' }, 'CD').rtpPerInitialBet;
        // NOT asserted bit-for-bit. The two engines sum the same quantities in a
        // different order, so they differ in the last ~2 ULP (~1.1e-15). That is
        // float summation order, not a modelling difference; asserting exact equality
        // would be asserting an accident of iteration order.
        assert.ok(Math.abs(legacy - fresh) < 1e-12, `infinite mode drifted from the published infinite-deck reference figure: ${legacy} vs ${fresh}`);
        assert.strictEqual(fresh.toFixed(12), (0.994296119877263).toFixed(12));
    });
    it('a very large finite shoe converges to the infinite-deck limit', () => {
        const inf = solve({ kind: 'infinite' }, 'CD').edgePerInitialBet * 100;
        const big = solve({ kind: 'finite', decks: 5000 }, 'CD').edgePerInitialBet * 100;
        assert.ok(Math.abs(big - inf) < 0.01, `finite(5000) should approach infinite: ${big.toFixed(6)} vs ${inf.toFixed(6)}`);
    });
});
describe('Exact solver — finite 8-deck, the figure LIQD publishes', () => {
    it('the enumeration is a proper probability distribution', () => {
        const r = solve({ kind: 'finite', decks: 8 }, 'TD');
        assert.ok(Math.abs(r.probabilityMass - 1) < 1e-9, `initial-deal probabilities must sum to 1, got ${r.probabilityMass}`);
    });
    it('exact 8-deck TD edge is pinned to 0.004876748223247249 (±1e-12) — internal drift guard', () => {
        // Deterministic solve → the double reproduces bit-for-bit. This 1e-12 pin is the ENGINE drift
        // guard (distinct from the external WoO anchor, which resolves only to ~1e-4 pp). A regression
        // in the solver moves this and fails the build rather than silently recalibrating the headline.
        const r = solve({ kind: 'finite', decks: 8 }, 'TD');
        assert.ok(Math.abs(r.edgePerInitialBet - 0.004876748223247249) < 1e-12, `exact 8-deck TD edge drifted: got ${r.edgePerInitialBet}, expected 0.004876748223247249 ±1e-12`);
    });
    it('EVERY field of the committed outputs/exact-rtp.json is re-derived by buildExactArtifact()', () => {
        // Round-1 fix pinned three fields of finite8TD by hand. Round-2 QA item 1: that is a guard
        // over ~3 of ~60 key paths — `rtpPerTotalWagered` (README headline 0.432435%), `avgWager`
        // (README headline 1.127741), `finite1TD`, `infiniteCD`, `cardRemovalLiftPP`,
        // `wooAnchor.sixDeckExact` and the whole wooAnchor block were unguarded, and a hand-edit of
        // any of them passed 45/45 + 31/31 + exit 0.
        //
        // The artifact is now built by ONE exported function (src/exact-play.ts buildExactArtifact),
        // which `npm run rtp` writes and this test re-derives. deepStrictEqual binds every key path
        // that exists, and any field added to the builder later is covered the moment it exists —
        // no per-field list to keep in sync. The solves are injected from this file's cache, so this
        // costs no extra solve time (the 1-deck and 6-deck solves are reused by the mutation battery).
        const artifactPath = path.join(__dirname, '..', '..', 'outputs', 'exact-rtp.json');
        const raw = fs.readFileSync(artifactPath, 'utf8');
        const fresh = (0, exact_play_1.buildExactArtifact)((model, strategy, rules) => solve(model, strategy, rules ?? exact_play_1.LIQD_RULES));
        // deepStrictEqual first: it names the differing key path, which a byte diff cannot.
        assert.deepStrictEqual(JSON.parse(raw), JSON.parse(JSON.stringify(fresh)), 'outputs/exact-rtp.json differs from a fresh buildExactArtifact() — the committed artifact was hand-edited, or the solver drifted');
        // …then byte identity, which additionally pins key ORDER and the serialisation the CLI writes.
        assert.strictEqual(raw, (0, exact_play_1.serializeExactArtifact)(fresh), 'outputs/exact-rtp.json is not byte-identical to serializeExactArtifact(buildExactArtifact()) — re-run `npm run rtp`');
    });
    it('natural frequency matches the closed form 2*(32/416)*(128/415)', () => {
        const r = solve({ kind: 'finite', decks: 8 }, 'TD');
        const closed = 2 * (32 / 416) * (128 / 415);
        assert.ok(Math.abs(r.playerBlackjackFreq - closed) < 1e-6, `player natural ${r.playerBlackjackFreq} vs closed form ${closed}`);
    });
    it('agrees with the 30M-round simulation within 3 sigma (per initial bet)', () => {
        const r = solve({ kind: 'finite', decks: 8 }, 'TD');
        const sim = simResults;
        const rounds = sim.baseGame.rounds;
        // sigma is computed from the PINNED round count, not from the artifact's own `rounds`.
        // Reading `rounds` out of the file being gated let the artifact set its own tolerance:
        // a reviewer forged baseGame to claim 1,000,000 rounds and 99.20% RTP, re-pinned
        // SIMULATION_SHA256, and both this test and scored Step 17 passed on a 5.5x wider
        // window that hid a 0.31 pp miss. The claimed count must EQUAL the pin, and the pin is
        // what sets the gate. (Same fix, same reason, in tests/steps/simulation.ts.)
        assert.equal(rounds, config_1.SIM_BASE_ROUNDS, `simulation-results.json claims ${rounds} rounds but SIM_BASE_ROUNDS is pinned at ${config_1.SIM_BASE_ROUNDS} ` +
            '— a claimed round count cannot set its own acceptance window');
        const simEdge = sim.baseGame.edgeInitial * 100;
        const sigma = (config_1.SIM_SD_PER_ROUND / Math.sqrt(config_1.SIM_BASE_ROUNDS)) * 100; // pinned; measured per-round SD 1.146718922176392, rounded up
        const delta = Math.abs(pct(r) - simEdge);
        assert.ok(delta <= 3 * sigma, `exact ${pct(r).toFixed(6)}% vs sim ${simEdge.toFixed(6)}% over ${config_1.SIM_BASE_ROUNDS} pinned rounds ` +
            `= ${(delta / sigma).toFixed(2)} sigma (limit 3)`);
    });
    it('agrees with the simulation on average wager per round', () => {
        const r = solve({ kind: 'finite', decks: 8 }, 'TD');
        const simWager = simResults.baseGame.avgWager;
        assert.ok(Math.abs(r.avgWager - simWager) < 1e-3, `exact avg wager ${r.avgWager} vs sim ${simWager}`);
    });
    it('sits ABOVE the infinite-deck limit, as card removal predicts', () => {
        const inf = solve({ kind: 'infinite' }, 'CD').rtpPerInitialBet;
        const fin = solve({ kind: 'finite', decks: 8 }, 'TD').rtpPerInitialBet;
        const liftPP = (fin - inf) * 100;
        assert.ok(liftPP > 0, `finite must exceed infinite, lift was ${liftPP.toFixed(4)} pp`);
        assert.ok(liftPP > 0.05 && liftPP < 0.10, `card-removal lift expected 0.05-0.10 pp, got ${liftPP.toFixed(4)} pp`);
    });
});
describe('Exact solver — CD is a COARSE diagnostic on the strategy table, not a figure', () => {
    // DEMOTED (decision-6, 2026-08-23). Finite-shoe CD under peek still carries the
    // peek-conditioning approximation: it cannot use the hole-explicit architecture,
    // because an argmax evaluated inside a fixed-hole branch lets the player choose as
    // if the hole were visible (measured: +5.5 pp — a peeking player). The correct CD
    // form is a per-node posterior mixture and is not implemented.
    //
    // So CD keeps exactly one job: catching a GROSS error in the shared strategy table,
    // which the simulation and the TD solver both read and could therefore both be wrong
    // about together. The tolerance below is sized for that job, and deliberately NOT for
    // precision — CD cannot confirm anything below its own error, so no CD figure and no
    // CD-TD gap may be published. Fine-grained validation of TD lives in the tiny-shoe
    // exact-rational oracle, not here.
    it('is flagged approximate, so it can never be mistaken for a publishable figure', () => {
        const cd = solve({ kind: 'finite', decks: 8 }, 'CD');
        const td = solve({ kind: 'finite', decks: 8 }, 'TD');
        assert.strictEqual(cd.cdPeekIsApproximate, true, 'finite CD under peek must self-identify as approximate');
        assert.strictEqual(td.cdPeekIsApproximate, false, 'TD is hole-explicit and exact — it must NOT carry the approximation flag');
    });
    it('shows no GROSS strategy-table error (coarse bound, not a precision claim)', () => {
        const td = pct(solve({ kind: 'finite', decks: 8 }, 'TD'));
        const cd = pct(solve({ kind: 'finite', decks: 8 }, 'CD'));
        assert.ok(cd <= td, `CD edge ${cd.toFixed(6)}% must not exceed TD edge ${td.toFixed(6)}%`);
        // 0.05 pp is ~15x CD's own residual error and ~10x the true CD-TD gap, so it can
        // only fire on a real table defect — which is the whole and only point of this check.
        assert.ok(td - cd < 0.05, `CD-TD gap ${(td - cd).toFixed(6)} pp exceeds the coarse 0.05 pp bound — ` +
            `that magnitude means a genuine strategy-table error, not the CD approximation`);
    });
});
describe('Exact solver — mutation battery (falsifiability)', () => {
    // Flipping a rule must move the exact figure by roughly the published amount.
    // A mutation that does NOT move it is a finding. Where our figure and the
    // published constant disagree, the reason is recorded rather than the
    // tolerance quietly widened.
    const base = () => pct(solve({ kind: 'finite', decks: 8 }, 'TD'));
    it('H17 costs the player about +0.22 pp', () => {
        const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...exact_play_1.LIQD_RULES, s17: false }, 'h17')) - base();
        assert.ok(Math.abs(d - 0.22) <= 0.03, `H17 delta ${d.toFixed(4)} pp, expected ~+0.22`);
    });
    it('removing DAS costs about +0.14 pp', () => {
        const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...exact_play_1.LIQD_RULES, das: false }, 'nodas')) - base();
        assert.ok(Math.abs(d - 0.14) <= 0.03, `no-DAS delta ${d.toFixed(4)} pp, expected ~+0.14`);
    });
    it('6 decks is very slightly better for the player than 8', () => {
        const d = pct(solve({ kind: 'finite', decks: 6 }, 'TD')) - base();
        assert.ok(Math.abs(d - (-0.02)) <= 0.03, `6-deck delta ${d.toFixed(4)} pp, expected ~-0.02`);
    });
    it('6:5 blackjack matches the closed form for EIGHT decks, not the single-deck constant', () => {
        // Commonly quoted as +1.39 pp, but that constant is a SINGLE-DECK figure.
        // The cost is exactly (1.5 - 1.2) x P(player natural) x P(dealer not natural | player natural),
        // where the conditional dealer-natural probability draws from the 414 cards left after the
        // player's ace+ten are removed: 2*31*127/(414*413). Conditioning is what makes it exact —
        // the unconditional form (1 - dealerBlackjackFreq) is ~0.002 pp high. P(natural) is lower at
        // 8 decks, so ~1.358 pp is the correct 8-deck value.
        const r8 = solve({ kind: 'finite', decks: 8 }, 'TD');
        const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...exact_play_1.LIQD_RULES, blackjackPays: 1.2 }, 'bj65')) - base();
        const dealerNatGivenPlayerNat = 2 * 31 * 127 / (414 * 413); // 8 decks, ace+ten already removed
        const closed = 0.3 * r8.playerBlackjackFreq * (1 - dealerNatGivenPlayerNat) * 100;
        assert.ok(Math.abs(d - closed) < 1e-6, `6:5 delta ${d.toFixed(6)} pp must match the conditional closed form ${closed.toFixed(6)} pp`);
        assert.ok(d > 1.3 && d < 1.4, `6:5 delta ${d.toFixed(4)} pp out of range`);
    });
    it('removing the peek moves the figure against the player', () => {
        // Modelled as: the player uses the SAME peek-optimal table and loses every
        // wagered unit to a dealer natural. The natural penalty is applied outside
        // the recursion, so CD cannot adapt to it either — this is an UPPER BOUND on
        // the cost, and it runs above the ~+0.11 pp usually published for ENHC with
        // re-optimised strategy. LIQD peeks, so this mutation is a probe only.
        const d = pct(solve({ kind: 'finite', decks: 8 }, 'TD', { ...exact_play_1.LIQD_RULES, peek: false }, 'nopeek')) - base();
        assert.ok(d > 0.10 && d < 0.25, `no-peek delta ${d.toFixed(4)} pp out of the expected band`);
    });
    it('a single deck moves strongly in the player\'s favour', () => {
        // Delta -0.571 pp vs the 8-deck figure. Accounted for: the published 1-deck csm edge at this
        // rule set is -0.11442% (0.602 pp below 8 decks); the remaining 0.031 pp is the cost of playing
        // the 8-deck total-dependent table on a single deck instead of a 1-deck-optimised table.
        // See rtp-analysis.md. LIQD deals 8 decks, so this does not affect the published figure.
        const d = pct(solve({ kind: 'finite', decks: 1 }, 'TD')) - base();
        assert.ok(d < -0.35 && d > -0.75, `1-deck delta ${d.toFixed(4)} pp out of the expected band`);
    });
});

  },
  "tests/blackjack/optimalPlayTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const optimal_play_1 = require("../../src/optimal-play");
// Engine-drift guard.
//
// The analytical optimal-play RTP feeds Step 17's consistency gate in `src/simulate.ts`.
// Because that gate compares the simulator against this engine, a silent regression in the
// engine (a rule change, a cache bug, a rounding shift) would move BOTH sides together and
// pass unnoticed. This test pins the engine's output to its known value so a drift fails the
// build rather than quietly recalibrating the gate it anchors.
//
// Expected: computeOptimalRTP('stand', true).rtp = 0.994296119877263 (S17, DAS, no
// surrender, dealer peek; infinite-deck limit). The engine is deterministic — every run
// reproduces the same double — so the tolerance is 1e-9, not a "numerical variation"
// band. The previous ±2e-4 band was ~13× wider than the peek-conditioning defect this
// repo just shed (~1.5e-5): a drift guard looser than the drifts that matter guards
// nothing.
describe('blackjack: optimal-play engine drift guard', () => {
    it("computeOptimalRTP('stand', true).rtp is pinned to 0.994296119877263 (±1e-9)", () => {
        const { rtp } = (0, optimal_play_1.computeOptimalRTP)('stand', true);
        node_assert_1.strict.ok(Math.abs(rtp - 0.994296119877263) <= 1e-9, `optimal-play RTP drifted: got ${rtp.toFixed(15)}, expected 0.994296119877263 ±1e-9`);
    });
});

  },
  "tests/blackjack/rngTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const rng_1 = require("../../src/rng");
const shuffle_1 = require("../../src/shuffle");
// Real LIQD Blackjack validation vectors — taken from the captured dataset
// (epoch 0, revealed serverSeed). Every value below is reproduced independently
// by the reference RNG and matches the recorded live hand.
const SERVER_SEED = '6dca5e36b6b9dc56730e282ab3c2bae6';
const CLIENT_SEED = 'audita6d2fe11bb1f';
describe('blackjack: real captured shoe reproduction', () => {
    it('serverSeed 6dca5e36… clientSeed audita6d2… nonce=0 -> shoe[0..3] = HEART:7,CLUB:10,HEART:9,HEART:11', () => {
        const shoe = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        node_assert_1.strict.deepEqual(shoe.slice(0, 4), ['HEART:7', 'CLUB:10', 'HEART:9', 'HEART:11'], `got ${JSON.stringify(shoe.slice(0, 4))}`);
    });
    it('deal is PDPD: player = HEART:7,HEART:9 ; dealer = CLUB:10,HEART:11 (matches the recorded live hand)', () => {
        const { player, dealer } = (0, rng_1.dealtHands)((0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0));
        node_assert_1.strict.deepEqual(player, ['HEART:7', 'HEART:9'], `player ${JSON.stringify(player)}`);
        node_assert_1.strict.deepEqual(dealer, ['CLUB:10', 'HEART:11'], `dealer ${JSON.stringify(dealer)}`);
    });
});
describe('blackjack: commitment hash (SHA-256 of utf8 hex string)', () => {
    it('commitHash(6dca5e36…) -> 948eff89… (== recorded hashedServerSeed)', () => {
        node_assert_1.strict.equal((0, rng_1.commitHash)(SERVER_SEED), '948eff896b5521c1064402dcd5557342210e03e0c4e864d0b83418bfb5e12f42');
    });
});
// ── Negative controls ────────────────────────────────────────────────────────────
// A test suite that only asserts correct inputs produce correct outputs cannot fail
// when the implementation is wrong in the ways that matter. These assert the reverse.
describe('blackjack: negative controls (the suite must be able to fail)', () => {
    it('a tampered server seed does NOT reproduce the recorded commitment', () => {
        const tampered = 'a' + SERVER_SEED.slice(1);
        node_assert_1.strict.notEqual(tampered, SERVER_SEED);
        node_assert_1.strict.notEqual((0, rng_1.commitHash)(tampered), (0, rng_1.commitHash)(SERVER_SEED));
    });
    it('a one-nibble change in the server seed yields a completely different shoe', () => {
        const tampered = SERVER_SEED.slice(0, -1) + (SERVER_SEED.slice(-1) === '0' ? '1' : '0');
        const a = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        const b = (0, rng_1.blackjackShoe)(tampered, CLIENT_SEED, 0);
        node_assert_1.strict.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
    });
    it('a wrong client seed yields a different shoe (the client seed genuinely feeds the draw)', () => {
        const a = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        const b = (0, rng_1.blackjackShoe)(SERVER_SEED, 'wrong-client-seed-test', 0);
        node_assert_1.strict.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
    });
    it('a different nonce yields a different shoe', () => {
        const a = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        const b = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 1);
        node_assert_1.strict.notDeepEqual(a.slice(0, 8), b.slice(0, 8));
    });
    it('the shoe is a valid 8-deck multiset: 416 cards, 32 of each rank, 104 of each suit', () => {
        const shoe = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        node_assert_1.strict.equal(shoe.length, 416);
        const byRank = new Map();
        const bySuit = new Map();
        for (const c of shoe) {
            const [suit, rank] = c.split(':');
            byRank.set(rank, (byRank.get(rank) ?? 0) + 1);
            bySuit.set(suit, (bySuit.get(suit) ?? 0) + 1);
        }
        node_assert_1.strict.equal(byRank.size, 13);
        node_assert_1.strict.equal(bySuit.size, 4);
        for (const [, n] of byRank)
            node_assert_1.strict.equal(n, 32);
        for (const [, n] of bySuit)
            node_assert_1.strict.equal(n, 104);
    });
    it('the deal is a permutation of the shoe prefix — no card is invented or dropped', () => {
        const shoe = (0, rng_1.blackjackShoe)(SERVER_SEED, CLIENT_SEED, 0);
        const { player, dealer, rest } = (0, rng_1.dealtHands)(shoe);
        node_assert_1.strict.deepEqual([...player, ...dealer, ...rest].sort(), [...shoe].sort());
    });
});
// ── Reference-RTP shuffle: uniformity at depth ───────────────────────────────────
// Regression guard for the fixed-prefix pre-shuffle defect: the reference RTP engine
// once shuffled only the first 24 positions per round and read beyond them, which
// sampled UNSHUFFLED tail positions on deep rounds (split-with-aces chains). The
// lazy Fisher-Yates frontier must sample uniformly at ANY depth.
//
// ROUND-4 QA-02. These tests used to carry their own private copy of the shuffle loop, so
// they guarded a copy that nothing shipped: the reviewer changed the REAL simulator's loop
// condition from `frontier <= k` to `frontier <= k && frontier < 24` — reintroducing the exact
// defect named above — and all three of these tests stayed green. The loop now lives in
// `src/shuffle.ts`, `src/simulate.ts` imports it, and so does this file. The last test in this
// block binds that arrangement in source, so the guard cannot silently detach again.
describe('blackjack: reference-shuffle uniformity across shallow and deep draws', () => {
    // Deterministic PRNG (mulberry32) so this statistical guard is REPRODUCIBLE — a randomized
    // Math.random() version false-failed at its 0.1% bound roughly 0.3% of runs (3 depths), which
    // is unacceptable for a gate that must be green every run. A fixed seed removes the flake while
    // still exercising uniformity at depth: the fixed-prefix defect it guards against is grossly
    // non-uniform (an unshuffled tail position is deterministic → χ² in the thousands), so it fails
    // this bound under any seed. Randomness is INJECTED into the shared shuffler, which is why the
    // shared implementation can be driven deterministically here and by `Math.random` in production.
    function mulberry32(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    /** Rank landing on `depth` over `trials` rounds of THE SIMULATOR'S OWN shuffler. */
    function rankAtDepth(depth, trials, rand) {
        const shuffler = (0, shuffle_1.createLazyShuffler)((0, shuffle_1.buildRankShoe)(8), (n) => (rand() * n) | 0);
        const counts = new Array(14).fill(0);
        for (let t = 0; t < trials; t++) {
            shuffler.reset(); // exactly what simulate.ts does at the top of each round
            counts[shuffler.at(depth)]++; // ensure(depth) then read — the draw path under test
        }
        return counts.slice(1);
    }
    for (const depth of [3, 23, 40]) {
        it(`position ${depth} is uniform over the 13 ranks`, () => {
            const trials = 60000;
            const counts = rankAtDepth(depth, trials, mulberry32(0x9e3779b9 ^ depth));
            const exp = trials / 13;
            const chi2 = counts.reduce((a, o) => a + ((o - exp) ** 2) / exp, 0);
            // chi2(12) upper 0.1% critical value = 32.91 — deterministic seed, so this is a fixed value.
            node_assert_1.strict.ok(chi2 < 32.91, `depth ${depth}: chi2=${chi2.toFixed(2)} exceeds the 0.1% critical value`);
        });
    }
    it('the shuffler is a pure function of its injected stream — importing it draws no randomness', () => {
        // The property `src/simulate.ts` does not have (it runs 30M rounds on import) and the reason
        // the depth tests could not simply import the original. Constructing a shuffler must not
        // consume the stream; only `ensure`/`at` may.
        let draws = 0;
        const counting = (n) => { draws++; return n >> 1; };
        const s = (0, shuffle_1.createLazyShuffler)((0, shuffle_1.buildRankShoe)(8), counting);
        node_assert_1.strict.equal(draws, 0, 'constructing a shuffler consumed randomness');
        node_assert_1.strict.equal(s.frontier(), 0);
        s.ensure(3);
        node_assert_1.strict.equal(draws, 4, 'ensure(3) must fix exactly positions 0..3');
        s.ensure(3);
        node_assert_1.strict.equal(draws, 4, 'a settled position must never be re-drawn');
        // Same stream in, same permutation out — the equivalence that makes the extraction from
        // simulate.ts provably behaviour-preserving without regenerating the frozen artifact.
        const ra = mulberry32(12345), rb = mulberry32(12345);
        const a = (0, shuffle_1.createLazyShuffler)((0, shuffle_1.buildRankShoe)(8), (n) => (ra() * n) | 0);
        const b = (0, shuffle_1.createLazyShuffler)((0, shuffle_1.buildRankShoe)(8), (n) => (rb() * n) | 0);
        a.ensure(60);
        b.ensure(60);
        node_assert_1.strict.deepEqual(a.items.slice(0, 61), b.items.slice(0, 61));
    });
    it('src/simulate.ts uses THIS implementation — no second copy of the shuffle loop', () => {
        // Source binding, not a behavioural one. Without it the tests above prove only that
        // src/shuffle.ts is uniform at depth, which is not the claim being made: the claim is that
        // the SIMULATOR is. QA-02's counterexample was possible precisely because that binding did
        // not exist. If simulate.ts ever re-inlines the loop, this fails and names the file.
        const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'simulate.ts'), 'utf8');
        node_assert_1.strict.ok(/from '\.\/shuffle'/.test(src), 'src/simulate.ts no longer imports the shared shuffler — the depth tests below would be guarding a copy');
        node_assert_1.strict.ok(/createLazyShuffler\(/.test(src), 'src/simulate.ts imports ./shuffle but does not construct a shuffler from it');
        node_assert_1.strict.ok(!/while\s*\(\s*frontier\s*<=/.test(src), 'src/simulate.ts has re-inlined a shuffle frontier loop — there are two implementations again');
    });
});

  },
  "tests/blackjack/roundEngineTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * BINDING TEST for `src/round-engine.ts`.
 *
 * That module is a deliberate SECOND copy of the round logic inside `src/simulate.ts` — the
 * original cannot be imported (simulate.ts runs a 30M-round Monte-Carlo on import) and cannot be
 * refactored either, because the artifact it produced is frozen and hash-pinned, so a refactor
 * could not be re-run to prove it behaviour-preserving. See that module's header.
 *
 * A duplicate that nothing checks is a duplicate that drifts. This test pins it to the exact
 * 8-deck TD solve — the same quantity, computed by a completely different method (dynamic
 * programming over the shoe composition rather than dealt rounds). If the copy stopped playing
 * the audited strategy, or mis-settled a double, a split or a natural, this fails.
 *
 * THE SHOE. Cards are drawn from a LAZY Fisher-Yates shuffle (`src/shuffle.ts`, the same
 * implementation `src/simulate.ts` uses) fed by `crypto.randomInt`, which is exactly uniform.
 * The frontier advances on demand, so every index the engine reads was shuffled for that round
 * at any depth. This replaces a fixed 24-card pre-shuffle that rested on the stated premise
 * "a round never consumes more" — round-4 QA-03 executed the counterexample below and that
 * premise is false, so the old version could read an UNSHUFFLED tail and the "fair shuffle"
 * behind this binding was not held on deep rounds. It is also cheaper: ~5.7 draws per round
 * instead of 24.
 *
 * THE GATE, stated as implemented (round-4 QA-05). Fresh entropy each run (never a pinned seed
 * array), so the estimate carries real sampling error. The test compares the run's point estimate
 * of the edge PER INITIAL BET — one convention, not two — against `solveExact(...).edgePerInitialBet`,
 * and fails when the deviation exceeds 5 × SIM_SD_PER_ROUND / √ROUNDS. With SIM_SD_PER_ROUND =
 * 1.15 (the CONFIGURED constant in src/config.ts — the per-round SD measured at 1.146718922176392
 * and rounded up, never re-measured by this run) and ROUNDS = 2,000,000, the acceptance window is
 *
 *     5 × 1.15 / √2,000,000 × 100  =  0.4065864 percentage points.
 *
 * That is the WIDTH of the window, and it is a false-failure budget (5σ ≈ 1 in 1.7 million), not a
 * detection guarantee: a true drift of exactly that size would be caught only about half the time.
 * A claim about power would need a power calculation, and none is made here.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const crypto_1 = require("crypto");
const round_engine_1 = require("../../src/round-engine");
const exact_play_1 = require("../../src/exact-play");
const rng_1 = require("../../src/rng");
const shuffle_1 = require("../../src/shuffle");
const config_1 = require("../../src/config");
describe('round-engine — the duplicated round logic still plays the audited game', () => {
    it('its Monte-Carlo RTP agrees with the exact 8-deck TD solve within 5 sigma', () => {
        const ROUNDS = 2000000;
        // `randomInt` is a uniform integer source with no modulo bias; the shuffler asks it for an
        // index in [f, size) one position at a time, so no depth constant appears anywhere here.
        const shuffler = (0, shuffle_1.createLazyShuffler)((0, rng_1.buildShoeTemplate)(), crypto_1.randomInt);
        let wagered = 0;
        let returned = 0;
        for (let r = 0; r < ROUNDS; r++) {
            shuffler.reset();
            const [w, ret] = (0, round_engine_1.settleShoeAt)((i) => shuffler.at(i));
            wagered += w;
            returned += ret;
        }
        const exact = (0, exact_play_1.solveExact)({ kind: 'finite', decks: config_1.DECKS }, 'TD');
        // Per INITIAL bet: total net loss divided by the number of rounds, matching
        // `edgePerInitialBet` (NOT divided by total wagered, which is the other convention).
        const simEdgePerInitial = (wagered - returned) / ROUNDS;
        const se = config_1.SIM_SD_PER_ROUND / Math.sqrt(ROUNDS);
        const dev = Math.abs(simEdgePerInitial - exact.edgePerInitialBet);
        assert.ok(dev <= 5 * se, `round-engine edge ${(simEdgePerInitial * 100).toFixed(4)}% per initial bet vs exact ` +
            `${(exact.edgePerInitialBet * 100).toFixed(6)}% = ${(dev / se).toFixed(2)} sigma (limit 5, ` +
            `window ±${(5 * se * 100).toFixed(7)} pp). ` +
            `Over ${ROUNDS.toLocaleString()} rounds, wagered ${wagered.toFixed(0)}, returned ${returned.toFixed(0)}. ` +
            'The duplicated round logic in src/round-engine.ts has drifted from the audited strategy.');
    });
    it('every card the engine reads was shuffled for that round — instrumented, at real depths', () => {
        // The property the 24-card pre-shuffle silently lost, checked per access rather than argued.
        // The frontier is read immediately AFTER each access: `at(i)` must have advanced it past `i`,
        // so `i >= frontier()` means the engine consumed a position this round never settled. Under a
        // capped frontier (mutation R38's edit) that is exactly what happens the moment a round reads
        // past the cap, so the assertion is not vacuous — it is the frontier-cap detector.
        const shuffler = (0, shuffle_1.createLazyShuffler)((0, rng_1.buildShoeTemplate)(), crypto_1.randomInt);
        let unshuffled = 0;
        let deepest = 0;
        for (let r = 0; r < 200000; r++) {
            shuffler.reset();
            (0, round_engine_1.settleShoeAt)((i) => {
                const card = shuffler.at(i);
                if (i >= shuffler.frontier())
                    unshuffled++;
                if (i > deepest)
                    deepest = i;
                return card;
            });
        }
        assert.equal(unshuffled, 0, `${unshuffled} card(s) were read from a position the round had not shuffled`);
        assert.ok(deepest >= 4, `instrumented run only ever reached index ${deepest}`);
        // HOW DEEP A REAL ROUND ACTUALLY GOES, measured rather than assumed — and why sampling alone
        // could never have refuted the 24-card premise. Over 200,000 rounds of this run the deepest
        // index read is typically ~13 (measured 13 on 2026-09-10, with 3 rounds reaching it); indices
        // at or past 24 did not occur once. The old bound was therefore empirically comfortable and
        // still wrong, which is why the refutation below is a CONSTRUCTED witness, not a longer run.
        //
        // The deterministic half of the guard, which does not depend on hitting a deep round by luck:
        // asking for a deep index must settle it, at any depth. A capped frontier fails here every run.
        shuffler.reset();
        shuffler.at(40);
        assert.equal(shuffler.frontier(), 41, 'ensure() must settle every index up to and including the one requested — a capped shuffle frontier fails here');
        shuffler.reset();
        shuffler.at(415);
        assert.equal(shuffler.frontier(), 416, 'the last position of the shoe must be reachable and settled');
    });
    it('reconstructs a valid round that reads through shoe index 32', () => {
        // The counterexample the reviewer executed. Player splits a pair of 2s; each hand runs
        // [2,A,A,A,A,A,5,A,A,A,A,A] to a hard 17 (12 cards); the dealer runs [7,2,2,A,A,A,A,A,A] to
        // 17 (9 cards). 4 dealt + 11 + 11 + 7 = 33 cards, indices 0..32 — nine past the bound the
        // old test asserted as a fact. Both hands push, so [wagered, returned] = [2, 2].
        const witness = [
            'CLUB:2', 'CLUB:7', 'DIAMOND:2', 'HEART:2', // PDPD
            'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:5', // split hand 1
            'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1', 'DIAMOND:1',
            'HEART:1', 'HEART:1', 'HEART:1', 'HEART:1', 'HEART:1', 'DIAMOND:5', // split hand 2
            'SPADE:1', 'SPADE:1', 'SPADE:1', 'SPADE:1', 'SPADE:1',
            'SPADE:2', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', 'CLUB:1', // dealer
        ];
        assert.equal(witness.length, 33);
        const read = [];
        const [wagered, returned] = (0, round_engine_1.settleShoeAt)((i) => {
            read.push(i);
            assert.ok(i < witness.length, `the engine read index ${i}, past the ${witness.length}-card witness`);
            return witness[i];
        });
        assert.equal(Math.max(...read), 32, 'the witness must reach index 32 or it does not refute the 24-card bound');
        assert.equal(new Set(read).size, 33, 'the round must consume 33 distinct positions');
        assert.deepEqual([wagered, returned], [2, 2], 'both split hands push against a dealer 17');
        // The bound this test used to assert. Stated as a refutation so it cannot creep back.
        assert.ok(Math.max(...read) >= 24, 'a round CAN consume more than 24 cards — the old premise was false');
    });
    it('the gate is tight enough to see a 3:2 -> 1:1 downgrade of the natural', () => {
        // Falsifiability of the gate itself, stated in the units the gate uses. A player natural
        // occurs on ~4.75% of rounds and returns 2.5x; returning 2x instead removes about
        // 0.5 x 0.0475 of a unit per round from the player, which is far outside 5 sigma at the
        // round count above.
        //
        // SCOPE, corrected in round 4 (QA-10): this is a MATHEMATICAL SANITY CHECK on the gate's
        // width, not an execution of the faulty payout path. It reads a live `solveExact()` result
        // (playerBlackjackFreq), so it is not merely an inequality between literals — but it does
        // not mutate `playRound`'s natural settlement, and it would not notice if that settlement
        // were wrong. The executed demonstration that a 2.5x -> 2x change in the ENGINE is caught is
        // mutation R37 in tests/mutations.json, run by `npm run mutate`.
        const exact = (0, exact_play_1.solveExact)({ kind: 'finite', decks: config_1.DECKS }, 'TD');
        const shift = 0.5 * exact.playerBlackjackFreq;
        const se = config_1.SIM_SD_PER_ROUND / Math.sqrt(2000000);
        assert.ok(shift > 5 * se, `a 3:2 -> 1:1 downgrade shifts the edge by ${(shift * 100).toFixed(4)} pp, which must exceed ` +
            `the ${(5 * se * 100).toFixed(7)} pp gate above`);
    });
});

  },
  "tests/blackjack/sideBetEdgeTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
/**
 * Side-bet house edges — exact, from the SAME evaluator the verifier scores live bets with.
 *
 * The report publishes Perfect Pairs 2.169% and 21+3 3.704%. Until round 2 those two figures were
 * derived by hand in `rtp-analysis.md` from a combination table typed into the prose, with no
 * code behind them and no row in the MANIFEST Model Anchors table (round-2 QA item 23).
 *
 * The enumeration itself now lives in `src/sidebet-edges.ts` — one implementation, two readers:
 * this anchor gate and `src/report-figures.ts`, which emits the same figures into
 * `outputs/report-figures.json` so the published percentages have a producing artifact instead of
 * living only inside a test (S-CONST). It enumerates the full 8-deck draw distribution and
 * classifies every combination with `src/sidebets.ts` — the evaluator Steps 15 and 16 use to
 * reconstruct all 11,600 live side-bet settlements, reading the paytables from `src/config.ts`.
 * So the published edge, the live-settlement check, the emitted artifact and the paytable
 * constants are one chain with no hand-copied number in it.
 *
 * The assertions below are on the exact REDUCED RATIONAL, not on a float, and each enumeration's
 * total weight is checked against C(416,k) so a bug in the hypergeometric weights cannot pass
 * silently.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const sidebet_edges_1 = require("../../src/sidebet-edges");
const config_1 = require("../../src/config");
describe('side-bet house edges — exact enumeration through src/sidebets.ts', () => {
    it('the 8-deck shoe this enumerates is the shoe the game deals', () => {
        node_assert_1.strict.equal(sidebet_edges_1.TYPES.length, 52);
        node_assert_1.strict.equal(config_1.DECKS, 8);
        node_assert_1.strict.equal(config_1.SHOE_SIZE, 416);
    });
    it('Perfect Pairs edge is exactly 9/415 (2.1687%)', () => {
        const e = (0, sidebet_edges_1.perfectPairsEdgeExact)();
        node_assert_1.strict.equal(e.total, sidebet_edges_1.SHOE_PAIR_COMBINATIONS, 'enumeration weight ≠ C(416,2)');
        node_assert_1.strict.equal(e.rational, '9/415', `Perfect Pairs edge is ${e.rational} (${e.edge}), expected 9/415 — the published 2.169% no longer follows from the paytable in src/config.ts`);
    });
    it('21+3 edge is exactly 4596/124085 (3.7039%)', () => {
        const e = (0, sidebet_edges_1.twentyOnePlusThreeEdgeExact)();
        node_assert_1.strict.equal(e.total, sidebet_edges_1.SHOE_TRIPLE_COMBINATIONS, 'enumeration weight ≠ C(416,3)');
        node_assert_1.strict.equal(e.rational, '4596/124085', `21+3 edge is ${e.rational} (${e.edge}), expected 4596/124085 — the published 3.704% no longer follows from the paytable in src/config.ts`);
    });
    it('the enumeration can fail: a richer coloured-pair payout moves the Perfect Pairs edge', () => {
        // Negative control. The published 13:1 coloured pair is one pip above the common 12:1;
        // the report says that one pip roughly halves the edge (4.096% -> 2.169%). Recompute the
        // 12:1 variant here so the claim is arithmetic, not assertion.
        const at12 = (0, sidebet_edges_1.perfectPairsEdgeExact)(12);
        node_assert_1.strict.equal(at12.total, sidebet_edges_1.SHOE_PAIR_COMBINATIONS, 'enumeration weight ≠ C(416,2)');
        node_assert_1.strict.ok(Math.abs(at12.edge - 0.04096) < 5e-5, `12:1 coloured pair should give ~4.096%, got ${(at12.edge * 100).toFixed(4)}%`);
        node_assert_1.strict.ok(at12.edge > 2 * (9 / 415) * 0.9, 'the 13:1 -> 12:1 change must move the edge, or this enumeration is not sensitive to the paytable');
    });
});

  },
  "tests/blackjack/wooAnchorTests.js": function (module, exports, require, __filename, __dirname) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const exact_play_1 = require("../../src/exact-play");
/**
 * Published external anchor — Wizard of Odds house-edge calculator.
 *
 * The tiny-shoe rational oracle (exactOracleTests.ts) anchors the ENGINE; this test
 * anchors the HEADLINE against a reference produced entirely outside this repo.
 *
 * Source:   https://wizardofodds.com/games/blackjack/calculator/  (captured 2026-08-23)
 * Settings: 8 decks, dealer stands soft 17, double after split, double on any first
 *           two cards, split to 2 hands (no re-split), no re-split aces, no hit split
 *           aces, player loses only original bet vs dealer BJ (peek/OBO), no
 *           surrender, blackjack pays 3:2 — the confirmed LIQD rule set.
 * Figure:   "Basic strategy with continuous shuffler" = 0.48768% house edge. That is
 *           total-dependent basic strategy with a reshuffle every hand — exactly the
 *           regime of our finite 8-deck TD solve (LIQD reshuffles every hand).
 *
 * Tolerance: one ulp of the published figure. WoO publishes 5 decimal places of
 * percent, so the underlying value is known only to ±1e-5 pp (1e-7 in fraction); our
 * exact 0.4876748% sits 5.2e-8 from the rounded 0.0048768. The pre-fix defective
 * solver was 1.48e-5 away — two orders of magnitude outside this gate — so the test
 * demonstrably fails on the error class it exists to catch.
 *
 * NOTE: this 1e-7 gate is a REGRESSION PIN on the observed 8-deck agreement, not a claim that WoO
 * resolves to 1e-7. WoO's published continuous-shuffler figures are good to ~1e-4 pp (see the
 * precision residual in reproducibility.md; at 6 decks the same engine reads 0.459936% vs a
 * published 0.45999%). The engine's own 1e-12 pin (exactSolverTests.ts) is the PRIMARY drift guard;
 * if WoO republishes with a >1e-5 pp change while the engine is unmoved, re-pin this constant.
 */
const WOO_BASIC_CSM_EDGE = 0.0048768; // 0.48768% per initial bet, published at 5 dp
const ONE_ULP = 1e-7; // resolution of the published figure, in fraction
describe('blackjack: published external anchor (Wizard of Odds, 8-deck LIQD rule set)', () => {
    it('exact 8-deck TD edge matches the published 0.48768% at published precision', function () {
        this.timeout(300000);
        const td = (0, exact_play_1.solveExact)({ kind: 'finite', decks: 8 }, 'TD');
        const delta = td.edgePerInitialBet - WOO_BASIC_CSM_EDGE;
        node_assert_1.strict.ok(Math.abs(delta) <= ONE_ULP, `exact 8-deck TD edge ${(td.edgePerInitialBet * 100).toFixed(6)}% vs published ` +
            `0.48768% — delta ${(delta * 100).toExponential(3)} pp exceeds one ulp of the ` +
            'published figure. Either the engine regressed or the anchor is stale.');
    });
    it('the anchor can fail: the pre-fix defective edge is far outside the gate', () => {
        // SCOPE, stated in round 4 (QA-10). This is a MATHEMATICAL SANITY CHECK on the anchor's
        // WIDTH: it shows that a historically real wrong value — the peek-conditioning-defective
        // solve this repo once shipped — sits two orders of magnitude outside the tolerance above,
        // so the anchor is not a gate that cannot fail. It is an inequality between two constants.
        // It does NOT execute any faulty code path and would not notice a payout regression in the
        // round engine; the executed demonstration of that is mutation R37 (`npm run mutate -- 40`),
        // which changes the engine's own natural settlement and turns a named assertion red.
        const preFixEdge = 0.004862001075398866; // the peek-conditioning-defective figure
        node_assert_1.strict.ok(Math.abs(preFixEdge - WOO_BASIC_CSM_EDGE) > ONE_ULP * 100, 'the pre-fix value must sit well outside the anchor tolerance, or this gate guards nothing');
    });
});

  },
};
var __cache = {};

function __flatten(from, spec) {
  var base = from ? from.split('/').slice(0, -1).join('/') : '';
  var parts = (base ? base + '/' + spec : spec).split('/');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === '' || p === '.') continue;
    if (p === '..') { out.pop(); continue; }
    out.push(p);
  }
  return out.join('/');
}

function __resolve(from, spec) {
  var joined = __flatten(from, spec);
  var candidates = [joined, joined + '.js', joined + '.json', joined + '/index.js'];
  for (var c = 0; c < candidates.length; c++) {
    if (Object.prototype.hasOwnProperty.call(__modules, candidates[c])) return candidates[c];
  }
  return null;
}

function __require(from, spec) {
  if (!spec.startsWith('.')) return __nodeRequire(spec);
  var id = __resolve(from, spec);
  if (!id) {
    // Not TypeScript, so tsc never emitted it — a .mjs/.cjs/.json asset the package SHIPS, such as
    // a capture reference module. Load the real file off disk relative to the package root. The
    // bundle stays self-contained for compiled code without pretending the package has no other
    // files; if the asset is genuinely missing, the error names it rather than hiding it.
    var abs = __PF_ROOT__ + '/' + __flatten(from, spec);
    try { return __nodeRequire(abs); } catch (e) {
      throw new Error('standalone verifier: unresolved module "' + spec + '" from "' + from + '" (' + e.message + ')');
    }
  }
  if (__cache[id]) return __cache[id].exports;
  var module = { exports: {} };
  __cache[id] = module;
  var dir = id.split('/').slice(0, -1).join('/');
  __modules[id](
    module,
    module.exports,
    function (s) { return __require(id, s); },
    __PF_ROOT__ + '/' + id,
    dir ? __PF_ROOT__ + '/' + dir : __PF_ROOT__
  );
  return module.exports;
}

__require('', './tests/__standalone-entry.js');
