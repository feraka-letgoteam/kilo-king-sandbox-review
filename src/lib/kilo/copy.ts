/**
 * Player-facing copy that differs between standard and social (stake.us) mode.
 *
 * Stake Engine launches social-mode games with the URL parameter `social=true`.
 * In that mode the game must not show any restricted term from the
 * jurisdiction list (bet, buy, cash, pay, purchase, stake, wager, gamble, ...),
 * matched as whole words, case-insensitive. Every string here that contains a
 * restricted term in standard mode has a social variant without one.
 *
 * Presentation copy only. Nothing in this file changes math, outcomes, wallet
 * calls or layout. `scripts/check-social-copy.mjs` scans every social value.
 */

export type CopyPair<T> = { readonly standard: T; readonly social: T };

const pair = <T>(standard: T, social: T): CopyPair<T> => ({ standard, social });

/** `social=true` (case-insensitive) selects social copy; anything else is standard. */
export function readSocialFlag(search?: string): boolean {
  const query =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  return new URLSearchParams(query).get("social")?.toLowerCase() === "true";
}

/** Read once at load: the launch parameter does not change during a session. */
export const SOCIAL_MODE: boolean = readSocialFlag();

/** Stake Engine general disclaimer template, verbatim. Shown in both modes. */
export const GENERAL_DISCLAIMER =
  "Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.";

type Text = (value: string) => string;
type Text2 = (a: string, b: string) => string;

export const COPY = {
  // Shared units and labels
  "unit.baseBet": pair("base bet", "base play"),
  "label.baseBet": pair("Base bet", "Base play"),
  "label.betShort": pair("Bet", "Play"),
  "label.purchaseCost": pair("Purchase cost", "Feature price"),
  "label.confirmPurchase": pair("Confirm", "Confirm"),
  "label.buyFeature": pair("Buy feature", "Get feature"),
  "label.anteBet": pair("Ante bet", "Ante play"),
  "label.cashCollections": pair("Cash collections", "Coin collections"),
  "symbol.cashRoll": pair("Cash roll", "Coin roll"),

  // Bet panel and bet controls
  "bet.panelTitle": pair("Bet amount", "Play amount"),
  "bet.baseLabel": pair("Base bet · LGC", "Base play · LGC"),
  "bet.decrease": pair("Decrease bet", "Decrease play"),
  "bet.increase": pair("Increase bet", "Increase play"),
  "bet.amounts": pair("Base bet amounts", "Base play amounts"),
  "bet.apply": pair("Apply bet", "Apply play amount"),
  "bet.unavailable": pair("Bet unavailable", "Play unavailable"),
  "bet.controlsGroup": pair("Bet controls", "Play controls"),
  "bet.changeAria": pair<Text2>(
    (bet, currency) => `Change base bet, ${bet} ${currency}`,
    (bet, currency) => `Change base play, ${bet} ${currency}`,
  ),
  "bet.readoutTitle": pair<Text>(
    (bet) => `Base bet ${bet}`,
    (bet) => `Base play ${bet}`,
  ),
  "bet.decreaseBase": pair("Decrease base bet", "Decrease base play"),
  "bet.increaseBase": pair("Increase base bet", "Increase base play"),
  "bet.featureGroup": pair("Feature base bet", "Feature base play"),
  "bet.featureDecrease": pair("Decrease feature base bet", "Decrease feature base play"),
  "bet.featureIncrease": pair("Increase feature base bet", "Increase feature base play"),
  "bet.featureChangeAria": pair<Text>(
    (amount) => `Change feature base bet, ${amount}`,
    (amount) => `Change feature base play, ${amount}`,
  ),

  // Purchase quotes (control-model)
  "quote.notAvailable": pair(
    "Requires five scatters · not available to buy",
    "Requires five scatters · not available as a feature play",
  ),
  "quote.aboveLimit": pair<Text>(
    (max) => `Above the ${max} purchase limit`,
    (max) => `Above the ${max} feature play limit`,
  ),
  "quote.outsideLimits": pair("Outside the bet limits", "Outside the play limits"),

  // Feature catalogue and confirmation
  "feature.kindBonusBuy": pair("Bonus buy", "Get bonus"),
  "feature.purchasePrice": pair("Purchase price", "Feature price"),
  "feature.reviewAria": pair<Text2>(
    (title, cost) => `Review ${title} purchase for ${cost} LGC`,
    (title, cost) => `Review ${title} for ${cost} LGC`,
  ),
  "feature.previewNoBet": pair("Preview only · No bet is placed.", "Preview only · Nothing is played."),
  "feature.anteAriaOn": pair("Deactivate ante bet", "Deactivate ante play"),
  "feature.anteAriaOff": pair("Activate ante bet", "Activate ante play"),
  "feature.anteNote": pair(
    "Ante changes the cost of each spin. Your next spin uses the selected wager.",
    "Ante changes the price of each spin. Your next spin uses the selected play amount.",
  ),
  "feature.galleryNote": pair(
    "Purchases require confirmation. Preview cards place no bet.",
    "Feature plays require confirmation. Preview cards do not start a play.",
  ),
  "feature.confirmBuy": pair<Text>(
    (cost) => `Buy · ${cost} LGC`,
    (cost) => `Play · ${cost} LGC`,
  ),
  "feature.groupBuy": pair("Buy features", "Get features"),
  "feature.yachtDetail": pair(
    "15 free spins. VS encounters develop across the opening, middle and closing spins. Each winning ×2–×10 reel stays locked. Adjacent reels of the same side merge into one larger wild and their multipliers multiply. Separate participating groups add; each group product is counted once. No cash collection.",
    "15 free spins. VS encounters develop across the opening, middle and closing spins. Each winning ×2–×10 reel stays locked. Adjacent reels of the same side merge into one larger wild and their multipliers multiply. Separate participating groups add; each group product is counted once. No coin collection.",
  ),
  "feature.superYachtDetail": pair(
    "15 free spins with a guaranteed winning ×25 VS on reel one of the first spin. It stays sticky, and adjacent same-side reels merge using their multiplier product. All other Yacht Stash rules apply. Trigger with five scatters or receive it from Mystery Bonus. No direct purchase.",
    "15 free spins with a guaranteed winning ×25 VS on reel one of the first spin. It stays sticky, and adjacent same-side reels merge using their multiplier product. All other Yacht Stash rules apply. Trigger with five scatters or receive it from Mystery Bonus. No direct feature play.",
  ),
  "feature.getawayDetail": pair(
    "Activate Max spins, then press Spin for each attempt. Every spin costs 1,000× the base bet and pays either 25,000× or zero. No free spins, secondary gamble or partial award. Activation itself is free; exit between spins.",
    "Activate Max spins, then press Spin for each attempt. Every spin costs 1,000× the base play and wins either 25,000× or zero. No free spins, second chance or partial award. Activation itself is free; exit between spins.",
  ),
  "feature.mysteryDetail": pair<Text>(
    (odds) => `Awards Dockside Catch, Yacht Stash or Super Yacht Stash. One charge, then the selected bonus plays at the current base bet. Super Yacht Stash guarantees a winning ×25 VS on reel one of spin one. ${odds}.`,
    (odds) => `Awards Dockside Catch, Yacht Stash or Super Yacht Stash. One charge, then the selected bonus plays at the current base play. Super Yacht Stash guarantees a winning ×25 VS on reel one of spin one. ${odds}.`,
  ),

  // Feature takeover presentation
  "takeover.dockSummary": pair(
    "10 free spins. Collect cash and build your multiplier.",
    "10 free spins. Collect coins and build your multiplier.",
  ),
  "takeover.yachtConfirmation": pair(
    "Every VS stays wild through the final spin. Adjacent King reels merge with King; Cop reels merge with Cop. A merged group multiplies its individual values and applies that product once. No cash collection.",
    "Every VS stays wild through the final spin. Adjacent King reels merge with King; Cop reels merge with Cop. A merged group multiplies its individual values and applies that product once. No coin collection.",
  ),
  "takeover.getawayConfirmation": pair(
    "Activate the mode, then press Spin for each attempt. Every spin costs 1,000× your base bet and returns either 25,000× or zero. Exit the mode at any time between spins.",
    "Activate the mode, then press Spin for each attempt. Every spin costs 1,000× your base play and returns either 25,000× or zero. Exit the mode at any time between spins.",
  ),
  "takeover.mysteryConfirmation": pair<Text>(
    (odds) => `Super Yacht guarantees a winning ×25 on reel one of spin one. ${odds}. One purchase; no additional charge for the selected bonus.`,
    (odds) => `Super Yacht guarantees a winning ×25 on reel one of spin one. ${odds}. One feature play; no additional charge for the selected bonus.`,
  ),
  "takeover.anteSubtitle": pair("Ante bet · more scatters", "Ante play · more scatters"),
  "takeover.buy": pair("Buy", "Play"),
  "takeover.maxNote": pair(
    "No charge to activate. Each press of Spin is a new paid attempt.",
    "No charge to activate. Each press of Spin is a new attempt at the displayed price.",
  ),

  // Control dock (SlotControls)
  "dock.buyCaption": pair("Buy", "Bonus"),

  // Round plates, HUD and spin button
  "plate.placeBet": pair("Place a bet", "Come and play"),
  "plate.placeBetCaps": pair("PLACE A BET", "COME AND PLAY"),
  "plate.roundPays": pair<Text>(
    (amount) => `Round pays ${amount}`,
    (amount) => `Round wins ${amount}`,
  ),
  "plate.paid": pair<Text>(
    (amount) => `Paid ${amount}`,
    (amount) => `Won ${amount}`,
  ),
  "plate.noPay": pair("No pay", "No win"),
  "hud.boughtFeature": pair("Bought feature", "Instantly triggered feature"),
  "hud.cashLocked": pair<Text>(
    (count) => `${count} cash locked`,
    (count) => `${count} coins locked`,
  ),
  "hud.cashLockedBoard": pair("Cash locked", "Coins locked"),
  "spin.buy": pair<Text>(
    (cost) => `BUY ${cost}`,
    (cost) => `PLAY ${cost}`,
  ),
  "effect.finalCash": pair("FINAL CASH", "FINAL COINS"),
  "effect.cashMultiplier": pair<Text>(
    (multiplier) => `CASH ×${multiplier}`,
    (multiplier) => `COINS ×${multiplier}`,
  ),
  "note.outsideStakeRules": pair(
    "That charge is outside the stake rules.",
    "That charge is outside the play limits.",
  ),

  // Menu, rules and paytable
  "menu.rules": pair("Rules & paytable", "Rules & win table"),
  "paytable.title": pair("Pay table", "Win table"),
  "paytable.intro": pair(
    "All wins below are multiples of the base bet. Current base bet:",
    "All wins below are multiples of the base play. Current base play:",
  ),
  "paytable.symbolAria": pair<Text>(
    (name) => `${name} payouts`,
    (name) => `${name} wins`,
  ),
  "paylines.howWinsPay": pair(
    "Three or more matching symbols pay on consecutive reels, starting from the leftmost reel. Only the longest matching combination pays on each line. Wins on different lines are added together.",
    "Three or more matching symbols win on consecutive reels, starting from the leftmost reel. Only the longest matching combination wins on each line. Wins on different lines are added together.",
  ),
  "paylines.separate": pair(
    "Line wins and scatter wins are separate. Package line wins and cash collections are also separate awards. Collection multipliers do not multiply line wins.",
    "Line wins and scatter wins are separate. Package line wins and coin collections are also separate awards. Collection multipliers do not multiply line wins.",
  ),
  "info.documentAria": pair(
    "Kilo King paytable, features and game information",
    "Kilo King win table, features and game information",
  ),
  "info.modeTitle.buy": pair("Dockside Catch buy", "Dockside Catch feature"),
  "info.modeTitle.yacht": pair("Yacht Stash buy", "Yacht Stash feature"),
  "info.modeTitle.mystery": pair("Mystery Bonus buy", "Mystery Bonus feature"),
  "info.modeDesc.ante": pair(
    "One spin with increased scatter frequency. Turn Ante On or Off on the Features page. Payouts still use the base bet.",
    "One spin with increased scatter frequency. Turn Ante On or Off on the Features page. Wins still use the base play.",
  ),
  "info.modeDesc.buy": pair(
    "Direct entry with 10 free spins, starting at ×1. No base-game line or scatter award is paid on entry.",
    "Direct entry with 10 free spins, starting at ×1. No base-game line or scatter award is given on entry.",
  ),
  "info.modeDesc.mystery": pair(
    "One purchase randomly awards Dockside Catch, Yacht Stash or Super Yacht Stash. Selection odds appear in the confirmation. Super Yacht opens with a guaranteed winning ×25 VS on reel one in spin one.",
    "One feature play randomly awards Dockside Catch, Yacht Stash or Super Yacht Stash. Selection odds appear in the confirmation. Super Yacht opens with a guaranteed winning ×25 VS on reel one in spin one.",
  ),
  "info.modeDesc.getaway": pair(
    "Activate the mode at no charge, then press Spin for each paid attempt. Each spin costs 1,000× the base bet and returns exactly 25,000× or zero. The giant speedboat advances left to right across five positions, pausing at each reached position. A partial boat pays zero and stays in place until the next spin; a full boat pays the max win. No free spins or partial prize. Exit the mode between spins.",
    "Activate the mode at no charge, then press Spin for each attempt. Each spin costs 1,000× the base play and returns exactly 25,000× or zero. The giant speedboat advances left to right across five positions, pausing at each reached position. A partial boat wins zero and stays in place until the next spin; a full boat wins the max win. No free spins or partial prize. Exit the mode between spins.",
  ),
  "info.wild.substitutes": pair(
    "In the base game and Dockside Catch, the fisherman substitutes for every paying line symbol, but never for a KING scatter. A full line of fishermen pays the tackle-case award.",
    "In the base game and Dockside Catch, the fisherman substitutes for every winning line symbol, but never for a KING scatter. A full line of fishermen wins the tackle-case award.",
  ),
  "info.wild.collects": pair(
    "In Dockside Catch, each fisherman collects every contraband package at the current collection multiplier. Multiple fishermen collect the same packages separately. A fisherman without a contraband package pays no collection, but still advances the meter. In the base game, an occasional Dockside Deal adds a collector that gathers visible cargo at ×1. It does not advance the bonus meter.",
    "In Dockside Catch, each fisherman collects every contraband package at the current collection multiplier. Multiple fishermen collect the same packages separately. A fisherman without a contraband package collects nothing, but still advances the meter. In the base game, an occasional Dockside Deal adds a collector that gathers visible cargo at ×1. It does not advance the bonus meter.",
  ),
  "info.wild.respin": pair(
    "On eligible non-winning base boards with at least two packages and no scatters or fisherman, a Catch Respin can hold all existing packages for one free respin of the other positions. New packages and fishermen can land. Every fisherman collects all final packages once at ×1; without a fisherman, packages do not pay. Only the final board is paid, and the respin does not charge another bet or trigger free spins.",
    "On eligible non-winning base boards with at least two packages and no scatters or fisherman, a Catch Respin can hold all existing packages for one free respin of the other positions. New packages and fishermen can land. Every fisherman collects all final packages once at ×1; without a fisherman, packages do not win. Only the final board is awarded, and the respin does not charge another play or trigger free spins.",
  ),
  "info.packages.values": pair(
    "Dime bags and wrapped kilos show cash values based on your base bet. Fishermen collect them during Dockside Catch and on eligible base-game collector landings. They are not scatters. The separate Cash roll symbol pays ordinary line wins.",
    "Dime bags and wrapped kilos show coin values based on your base play. Fishermen collect them during Dockside Catch and on eligible base-game collector landings. They are not scatters. The separate Coin roll symbol awards ordinary line wins.",
  ),
  "info.scatter.anywhere": pair(
    "The KING crown is the only scatter. Each reel can count once. Scatter wins pay anywhere on the final base-game screen, independently of paylines.",
    "The KING crown is the only scatter. Each reel can count once. Scatter wins count anywhere on the final base-game screen, independently of paylines.",
  ),
  "info.scatter.respin": pair(
    "Exactly two scatter reels lock while the other three reels respin once. The final screen determines the line wins, scatter award and any free spins. Purchased features do not pay scatter awards.",
    "Exactly two scatter reels lock while the other three reels respin once. The final screen determines the line wins, scatter award and any free spins. Instantly triggered features do not award scatter wins.",
  ),
  "info.freeSpins": pair(
    "Features use the triggering base bet with no extra charge per spin. Three scatters start Dockside Catch (10 spins); four start Yacht Stash (15 spins); five start Super Yacht Stash (15 spins). The five-scatter feature guarantees a winning ×25 VS on reel one in spin one. Dockside Catch and Yacht Stash have direct buys; Super Yacht is available through five scatters or a Mystery Bonus buy. Yacht uses the existing ten paylines with sticky VS wilds. The Getaway has a single binary result.",
    "Features use the triggering base play with no extra charge per spin. Three scatters start Dockside Catch (10 spins); four start Yacht Stash (15 spins); five start Super Yacht Stash (15 spins). The five-scatter feature guarantees a winning ×25 VS on reel one in spin one. Dockside Catch and Yacht Stash can be started directly as feature plays; Super Yacht is available through five scatters or a Mystery Bonus feature play. Yacht uses the existing ten paylines with sticky VS wilds. The Getaway has a single binary result.",
  ),
  "info.vs.progression": pair(
    "Yacht starts with an opening ×2 VS in the first two spins. Super Yacht instead guarantees a winning ×25 VS on reel one in the very first spin; King or Cop can win it, and the ×25 stays sticky until completion. That ×25 is a wild multiplier, not a guaranteed 25× payout. Further recorded encounters develop during the middle and closing spins, unless the round has already reached its payout limit. Every winning ×2, ×3, ×4, ×5, ×6, ×8 or ×10 reel locks through the feature. King and Cop never combine. Adjacent same-side reels form one continuous wild: ×3 beside ×4 becomes ×12. Each group product is applied once to a winning connection; separate participating groups add together. This feature has no cash collection.",
    "Yacht starts with an opening ×2 VS in the first two spins. Super Yacht instead guarantees a winning ×25 VS on reel one in the very first spin; King or Cop can win it, and the ×25 stays sticky until completion. That ×25 is a wild multiplier, not a guaranteed 25× win. Further recorded encounters develop during the middle and closing spins, unless the round has already reached its win limit. Every winning ×2, ×3, ×4, ×5, ×6, ×8 or ×10 reel locks through the feature. King and Cop never combine. Adjacent same-side reels form one continuous wild: ×3 beside ×4 becomes ×12. Each group product is applied once to a winning connection; separate participating groups add together. This feature has no coin collection.",
  ),
  "info.vs.limits": pair(
    "The Yacht purchase payout limit remains 18,000× base bet. A natural Yacht or Super Yacht stays inside its base or Ante round’s 25,000× total payout limit. Super Yacht from Mystery also has a 25,000× limit. Mystery-selected Dockside and Yacht retain their existing 25,000× and 18,000× limits respectively. The local candidate uses a weighted outcome catalogue with approximately 95.5% return against the 200× purchase price; it is not a certified or published Stake Engine return. All feature state resets at the end of the paid round.",
    "The Yacht feature win limit remains 18,000× base play. A natural Yacht or Super Yacht stays inside its base or Ante round’s 25,000× total win limit. Super Yacht from Mystery also has a 25,000× limit. Mystery-selected Dockside and Yacht retain their existing 25,000× and 18,000× limits respectively. The local candidate uses a weighted outcome catalogue with approximately 95.5% return against the 200× feature price; it is not a certified or published Engine return. All feature state resets at the end of the round.",
  ),
  "info.vs.getaway": pair(
    "The Getaway buys exactly one spin for 1,000× base bet. Its only payouts are 25,000× or zero; no second gamble is offered. In this local candidate distribution the max-win probability is 3.82% and loss probability is 96.18%. The exact candidate return is 95.5%; this is not a certified or published Stake Engine return.",
    "The Getaway plays exactly one spin for 1,000× base play. Its only results are 25,000× or zero; no second chance is offered. In this local candidate distribution the max-win probability is 3.82% and loss probability is 96.18%. The exact candidate return is 95.5%; this is not a certified or published Engine return.",
  ),
  "info.modes.title": pair("Bet modes", "Play modes"),
  "info.modes.atThisBet": pair("at this bet", "at this play"),
  "info.modes.maxPayout": pair(
    "Maximum round payout at this bet:",
    "Maximum round win at this play amount:",
  ),
  "info.modes.confirm": pair(
    "Purchases require confirmation of the full charge. The maximum single-round charge is",
    "Feature plays require confirmation of the full charge. The maximum single-round charge is",
  ),
  "info.modes.aboveLimit": pair(
    ". A purchase above that limit, or above your available balance, is unavailable.",
    ". A feature play above that limit, or above your available balance, is unavailable.",
  ),
  "info.modes.mysteryNote": pair(
    "Mystery Bonus is an artwork preview in development and cannot currently be played or purchased. The Getaway is the playable Max spins mode. Activating it does not charge the balance; each press of Spin buys one attempt at the displayed cost.",
    "Mystery Bonus is an artwork preview in development and cannot currently be played. The Getaway is the playable Max spins mode. Activating it does not charge the balance; each press of Spin plays one attempt at the displayed price.",
  ),
  "info.max.theBaseBet": pair("× the base bet", "× the base play"),
  "info.max.basis": pair(
    "This is based on the base bet, not the feature purchase price.",
    "This is based on the base play, not the feature price.",
  ),
  "info.max.atCurrent": pair("At your current base bet of", "At your current base play of"),
  "info.sandbox": pair(
    "This private preview uses a local test balance. No real-money wallet or Stake Engine game server is connected. Animations and spin-speed settings do not alter the recorded round result.",
    "This private preview uses a local test balance. No live wallet or Engine game server is connected. Animations and spin-speed settings do not alter the recorded round result.",
  ),
  "info.disclaimerTitle": pair("General disclaimer", "General disclaimer"),
  "info.disclaimer": pair(GENERAL_DISCLAIMER, GENERAL_DISCLAIMER),
  "info.controls.spin": pair(
    "Starts one round at the selected wager. During presentation, the same control can skip ahead without changing the result.",
    "Starts one round at the selected play amount. During presentation, the same control can skip ahead without changing the result.",
  ),
  "info.controls.bet": pair(
    "Open the bet selector or use its steppers. The readout includes the Ante charge when enabled. Ante On / Off is on the Features page.",
    "Open the play amount selector or use its steppers. The readout includes the Ante charge when enabled. Ante On / Off is on the Features page.",
  ),
  "info.controls.auto": pair(
    "Choose a finite number of spins and confirm to start. Auto stops on a bonus or an unavailable next bet. Stop cancels the remaining queue; the current round completes.",
    "Choose a finite number of spins and confirm to start. Auto stops on a bonus or an unavailable next play. Stop cancels the remaining queue; the current round completes.",
  ),
  "info.controls.features": pair(
    "The crown-and-hook control opens the feature catalogue and Ante setting. Review the price and confirm before buying a feature.",
    "The crown-and-hook control opens the feature catalogue and Ante setting. Review the price and confirm before playing a feature.",
  ),
} satisfies Record<string, CopyPair<unknown>>;

export type CopyKey = keyof typeof COPY;

/** Picks the standard or social variant. `social` defaults to the launch flag. */
export function t<K extends CopyKey>(
  key: K,
  social: boolean = SOCIAL_MODE,
): (typeof COPY)[K]["standard"] {
  const entry = COPY[key];
  return social ? entry.social : entry.standard;
}
