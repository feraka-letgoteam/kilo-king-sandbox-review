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
    search ?? (typeof window === "undefined" ? "" : (window.location?.search ?? ""));
  return new URLSearchParams(query).get("social")?.toLowerCase() === "true";
}

/** Read once at load: the launch parameter does not change during a session. */
export const SOCIAL_MODE: boolean = readSocialFlag();

/** Stake Engine general disclaimer template, verbatim. Shown in both modes. */
export const GENERAL_DISCLAIMER =
  "Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.";

type Text = (value: string) => string;
type Text2 = (a: string, b: string) => string;
type Text4 = (a: string, b: string, c: string, d: string) => string;

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
    "15 free spins. Reel one of the first spin opens with a ×25 VS that always wins its reel. It stays sticky, and adjacent same-side reels merge using their multiplier product. All other Yacht Stash rules apply. Trigger with five scatters or receive it from Mystery Bonus. No direct purchase.",
    "15 free spins. Reel one of the first spin opens with a ×25 VS that always wins its reel. It stays sticky, and adjacent same-side reels merge using their multiplier product. All other Yacht Stash rules apply. Trigger with five scatters or receive it from Mystery Bonus. No direct feature play.",
  ),
  "feature.getawayDetail": pair(
    "Activate Max spins, then press Spin for each attempt. Every spin costs 1,000× the base bet, starts fresh and pays either 25,000× or zero. No free spins, secondary gamble or partial award. Activation itself is free; exit between spins.",
    "Activate Max spins, then press Spin for each attempt. Every spin costs 1,000× the base play, starts fresh and wins either 25,000× or zero. No free spins, second chance or partial award. Activation itself is free; exit after any spin.",
  ),
  "feature.mysteryDetail": pair<Text>(
    (odds) => `Awards Dockside Catch, Yacht Stash or Super Yacht Stash. One charge, then the selected bonus plays at the current base bet. Super Yacht Stash opens with a ×25 VS that always wins its reel. ${odds}.`,
    (odds) => `Awards Dockside Catch, Yacht Stash or Super Yacht Stash. One charge, then the selected bonus plays at the current base play. Super Yacht Stash opens with a ×25 VS that always wins its reel. ${odds}.`,
  ),

  // Feature takeover presentation
  "takeover.yachtConfirmation": pair(
    "Every VS stays wild through the final spin. Adjacent King reels merge with King; Cop reels merge with Cop. A merged group multiplies its individual values and applies that product once. No cash collection.",
    "Every VS stays wild through the final spin. Adjacent King reels merge with King; Cop reels merge with Cop. A merged group multiplies its individual values and applies that product once. No coin collection.",
  ),
  "takeover.getawayConfirmation": pair(
    "Activate the mode, then press Spin for each attempt. Every spin costs 1,000× your base bet and returns either 25,000× or zero. Each spin starts fresh. Exit the mode at any time between spins.",
    "Activate the mode, then press Spin for each attempt. Every spin costs 1,000× your base play and returns either 25,000× or zero. Each spin starts fresh. Exit the mode after any spin.",
  ),
  "takeover.mysteryConfirmation": pair<Text>(
    (odds) => `Super Yacht opens with a ×25 VS that always wins its reel. ${odds}. One purchase; no additional charge for the selected bonus.`,
    (odds) => `Super Yacht opens with a ×25 VS that always wins its reel. ${odds}. One feature play; no additional charge for the selected bonus.`,
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
  "info.modeTitle.buy": pair("Dockside Catch", "Dockside Catch"),
  "info.modeTitle.yacht": pair("Yacht Stash", "Yacht Stash"),
  "info.modeTitle.mystery": pair("Mystery Bonus", "Mystery Bonus"),
  "info.modeDesc.ante": pair(
    "One spin with increased scatter frequency. Turn Ante On or Off on the Features page. Payouts still use the base bet.",
    "One spin with increased scatter frequency. Turn Ante On or Off on the Features page. Wins still use the base play.",
  ),
  "info.modeDesc.buy": pair(
    "Direct entry with 10 free spins, starting at ×1. No base-game line or scatter award is paid on entry.",
    "Direct entry with 10 free spins, starting at ×1. No base-game line or scatter award is given on entry.",
  ),
  "info.modeDesc.mystery": pair(
    "One purchase randomly awards Dockside Catch, Yacht Stash or Super Yacht Stash. Selection odds appear in the confirmation. Super Yacht opens with a ×25 VS on reel one that always wins its reel.",
    "One feature play randomly awards Dockside Catch, Yacht Stash or Super Yacht Stash. Selection odds appear in the confirmation. Super Yacht opens with a ×25 VS on reel one that always wins its reel.",
  ),
  "info.modeDesc.getaway": pair(
    "Activate the mode at no charge, then press Spin for each paid attempt. Each spin costs 1,000× the base bet and returns exactly 25,000× or zero. The giant speedboat advances left to right across five positions, pausing at each reached position. A boat that stalls short pays zero and resets, so every spin starts fresh with nothing carried over; a full boat pays the max win. No free spins or partial prize. Exit the mode between spins.",
    "Activate the mode at no charge, then press Spin for each attempt. Each spin costs 1,000× the base play and returns exactly 25,000× or zero. The giant speedboat advances left to right across five positions, pausing at each reached position. A boat that stalls short wins zero and resets, so every spin starts fresh with nothing carried over; a full boat earns the max win. No free spins or partial prize. Exit the mode after any spin.",
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
    "The KING crown is the only scatter. Each reel can count once. Scatter wins count anywhere on the final base-game screen, independently of win lines.",
  ),
  "info.scatter.respin": pair(
    "Exactly two scatter reels lock while the other three reels respin once. The final screen determines the line wins, scatter award and any free spins. Purchased features do not pay scatter awards.",
    "Exactly two scatter reels lock while the other three reels respin once. The final screen determines the line wins, scatter award and any free spins. Instantly triggered features do not award scatter wins.",
  ),
  "info.freeSpins": pair(
    "Features use the triggering base bet with no extra charge per spin. Three scatters start Dockside Catch (10 spins); four start Yacht Stash (15 spins); five start Super Yacht Stash (15 spins). The five-scatter feature opens with a ×25 VS on reel one that always wins its reel. Dockside Catch and Yacht Stash have direct buys; Super Yacht is available through five scatters or a Mystery Bonus buy. Yacht uses the existing ten paylines with sticky VS wilds. The Getaway has a single binary result.",
    "Features use the triggering base play with no extra charge per spin. Three scatters start Dockside Catch (10 spins); four start Yacht Stash (15 spins); five start Super Yacht Stash (15 spins). The five-scatter feature opens with a ×25 VS on reel one that always wins its reel. Dockside Catch and Yacht Stash can be started directly as feature plays; Super Yacht is available through five scatters or a Mystery Bonus feature play. Yacht uses the existing ten win lines with sticky VS wilds. The Getaway has a single binary result.",
  ),
  "info.vs.progression": pair(
    "Yacht starts with an opening ×2 VS in the first two spins. Super Yacht instead opens the very first spin with a ×25 VS on reel one that always wins its reel; King or Cop can win it, and the ×25 stays sticky until completion. That ×25 is a wild multiplier, not a guaranteed 25× payout. Further recorded encounters develop during the middle and closing spins, unless the round has already reached its payout limit. Every winning ×2, ×3, ×4, ×5, ×6, ×8 or ×10 reel locks through the feature. King and Cop never combine. Adjacent same-side reels form one continuous wild: ×3 beside ×4 becomes ×12. Each group product is applied once to a winning connection; separate participating groups add together. This feature has no cash collection.",
    "Yacht starts with an opening ×2 VS in the first two spins. Super Yacht instead opens the very first spin with a ×25 VS on reel one that always wins its reel; King or Cop can win it, and the ×25 stays sticky until completion. That ×25 is a wild multiplier, not a guaranteed 25× win. Further recorded encounters develop during the middle and closing spins, unless the round has already reached its win limit. Every winning ×2, ×3, ×4, ×5, ×6, ×8 or ×10 reel locks through the feature. King and Cop never combine. Adjacent same-side reels form one continuous wild: ×3 beside ×4 becomes ×12. Each group product is applied once to a winning connection; separate participating groups add together. This feature has no coin collection.",
  ),
  "info.vs.limits": pair(
    "The Yacht purchase payout limit remains 18,000× base bet. A natural Yacht or Super Yacht stays inside its base or Ante round’s 25,000× total payout limit. Super Yacht from Mystery also has a 25,000× limit. Mystery-selected Dockside and Yacht retain their existing 25,000× and 18,000× limits respectively. The local candidate uses a weighted outcome catalogue with approximately 95.5% return against the 200× purchase price; it is not a certified or published Stake Engine return. All feature state resets at the end of the paid round.",
    "The Yacht feature win limit remains 18,000× base play. A natural Yacht or Super Yacht stays inside its base or Ante round’s 25,000× total win limit. Super Yacht from Mystery also has a 25,000× limit. Mystery-selected Dockside and Yacht retain their existing 25,000× and 18,000× limits respectively. The local candidate uses a weighted outcome catalogue with approximately 95.5% return against the 200× feature price; it is not a certified or published Engine return. All feature state resets at the end of the round.",
  ),
  "info.vs.getaway": pair(
    "The Getaway buys exactly one spin for 1,000× base bet. Its only payouts are 25,000× or zero; no second gamble is offered. Each spin starts fresh; nothing carries over from a stalled boat. In this local candidate distribution the max-win probability is 3.82% (about 1 in 26) and the loss probability is 96.18%. The exact candidate return is 95.5%; this is not a certified or published Stake Engine return.",
    "The Getaway plays exactly one spin for 1,000× base play. Its only results are 25,000× or zero; no second chance is offered. Each spin starts fresh; nothing carries over from a stalled boat. In this local candidate distribution the max-win probability is 3.82% (about 1 in 26) and the loss probability is 96.18%. The exact candidate return is 95.5%; this is not a certified or published Engine return.",
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
    "Mystery Bonus is charged once at 200× the base bet; the bonus it picks then plays at no extra charge. The Getaway is the playable Max spins mode. Activating it does not charge the balance; each press of Spin buys one attempt at the displayed cost.",
    "Mystery Bonus is charged once at 200× the base play; the bonus it picks then plays at no extra charge. The Getaway is the playable Max spins mode. Activating it does not charge the balance; each press of Spin plays one attempt at the displayed price.",
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
  // Collector meter, retriggers and entry upgrades (D7).
  "info.meter.title": pair("Collector meter & retriggers", "Collector meter & retriggers"),
  "info.meter.body": pair(
    "In Dockside Catch, every fisherman advances the meter after its spin. At 4, 8 and 12 total collectors, each milestone is a retrigger: it adds 10 free spins and raises the multiplier for the next spin.",
    "In Dockside Catch, every fisherman advances the meter after its spin. At 4, 8 and 12 total collectors, each milestone is a retrigger: it adds 10 free spins and raises the multiplier for the next spin.",
  ),
  "info.meter.after": pair(
    "A milestone reached during a collection does not increase that collection. No further retriggers are awarded after ×10. The meter resets when the feature ends.",
    "A milestone reached during a collection does not increase that collection. No further retriggers are awarded after ×10. The meter resets when the feature ends.",
  ),
  "info.upgrades.title": pair("Feature upgrades", "Feature upgrades"),
  "info.upgrades.body": pair(
    "Dockside Catch can start with upgrades, shown on its intro card: More packages, More fishermen, More tools, Starts one level higher and +2 spins. +2 spins adds 2 spins to the starting award and 2 more to every retrigger, so each milestone then adds 12 free spins instead of 10. Upgrades last only for that feature and are part of the recorded result.",
    "Dockside Catch can start with upgrades, shown on its intro card: More packages, More fishermen, More tools, Starts one level higher and +2 spins. +2 spins adds 2 spins to the starting award and 2 more to every retrigger, so each milestone then adds 12 free spins instead of 10. Upgrades last only for that feature and are part of the recorded result.",
  ),
  // Maximum win paragraph (social: no "payout").
  "info.max.overall": pair("The overall maximum total round payout is", "The overall maximum total round win is"),
  "info.max.atCurrentTail": pair(", the overall maximum total round payout is", ", the overall maximum total round win is"),
  "info.max.includes": pair(
    "This includes all line wins, scatter wins and collections. Reaching the mode's cap ends the round, including remaining free spins, and awards no more than the cap.",
    "This includes all line wins, scatter wins and collections. Reaching the mode's cap ends the round, including remaining free spins, and awards no more than the cap.",
  ),
  // Controls (D8).
  "info.controls.title": pair("Controls", "Controls"),
  "info.controls.readouts.label": pair("Balance & Win", "Balance & Win"),
  "info.controls.readouts": pair(
    "BALANCE shows your available balance. WIN shows the total won in the current round and counts up to the final amount.",
    "BALANCE shows your available balance. WIN shows the total won in the current round and counts up to the final amount.",
  ),
  "info.controls.speed.label": pair("Speed", "Speed"),
  "info.controls.speed": pair(
    "Normal, Turbo and Super turbo change presentation speed only. Use the lightning control, Auto screen or Game settings.",
    "Normal, Turbo and Super turbo change presentation speed only. Use the lightning control, Auto screen or Game settings.",
  ),
  "info.controls.menu.label": pair("Menu", "Menu"),
  "info.controls.menu": pair(
    "Opens Info, Music and Sound. Music and Sound have separate controls. Game settings includes speed and motion preferences.",
    "Opens Info, Music and Sound. Music and Sound have separate controls. Game settings includes speed and motion preferences.",
  ),
  "info.controls.audio.label": pair("Audio", "Audio"),
  "info.controls.audio": pair(
    "Toggle music and sound effects independently in the menu. Unavailable audio controls remain disabled until audio is ready.",
    "Toggle music and sound effects independently in the menu. Unavailable audio controls remain disabled until audio is ready.",
  ),
  "info.controls.availability.label": pair("Availability", "Availability"),
  "info.controls.availability": pair(
    "Some controls can be unavailable for your session. Small popout views keep Auto and speed options in Game settings.",
    "Some controls can be unavailable for your session. Small popout views keep Auto and speed options in Game settings.",
  ),
  "info.controls.features.label": pair("Features", "Features"),
  "info.controls.auto.label": pair("Auto", "Auto"),
  "info.controls.spin.label": pair("Spin / Spacebar", "Spin / Spacebar"),
  // Return to player (info screen). Candidate targets, not certified Engine RTP.
  "info.rtp.intro": pair(
    "Verified theoretical RTP is not yet available for this sandbox.",
    "Verified theoretical RTP is not yet available for this sandbox.",
  ),
  "info.rtp.value": pair("Not verified", "Not verified"),
  "info.rtp.note": pair(
    "RTP describes an expected return over many plays, not the return from any individual session. This preview does not publish a theoretical percentage.",
    "RTP describes an expected return over many plays, not the return from any individual session. This preview does not publish a theoretical percentage.",
  ),

  // Feature cards (playful heist tone). Feature names stay fixed.
  // Buy card: name, one line, price, button.
  "card.buy.dock": pair(
    "Fish are biting. 10 free spins to haul in the cash.",
    "Fish are biting. 10 free spins to haul in the coins.",
  ),
  "card.buy.yacht": pair(
    "The King’s got a boat to catch. 15 free spins, sticky VS wilds.",
    "The King’s got a boat to catch. 15 free spins, sticky VS wilds.",
  ),
  "card.buy.getaway": pair(
    "Floor it. One spin: max win or nothing.",
    "Floor it. One spin: max win or nothing.",
  ),
  "card.buy.mystery": pair(
    "One crate, three bonuses. Maybe the ×25 opener.",
    "One crate, three bonuses. Maybe the ×25 opener.",
  ),
  "card.scatter.superYacht": pair("5 scatters · ×25 opener", "5 scatters · ×25 opener"),
  // Trigger card line under the feature name (≤8 words with the name, auto-advances).
  "card.trigger.dock": pair<Text>(
    (spins) => `${spins} FREE SPINS · REEL ’EM IN`,
    (spins) => `${spins} FREE SPINS · REEL ’EM IN`,
  ),
  "card.trigger.yacht": pair<Text>(
    (spins) => `${spins} FREE SPINS · ALL ABOARD`,
    (spins) => `${spins} FREE SPINS · ALL ABOARD`,
  ),
  "card.trigger.superYacht": pair<Text>(
    (spins) => `${spins} FREE SPINS · ×25 OPENER`,
    (spins) => `${spins} FREE SPINS · ×25 OPENER`,
  ),
  "card.trigger.getaway": pair("FLOOR IT · MAX WIN OR NOTHING", "FLOOR IT · MAX WIN OR NOTHING"),
  // Intro card hook (≤10 words with the name, then TAP TO CONTINUE). Not wired yet:
  // the v4 flow has no tap-to-continue intro card; ready for the trigger build-up.
  "card.intro.dock": pair(
    "Fish are biting. Every fisherman hauls the catch.",
    "Fish are biting. Every fisherman hauls the catch.",
  ),
  "card.intro.yacht": pair("THE KING’S GOT A BOAT TO CATCH", "THE KING’S GOT A BOAT TO CATCH"),
  "card.intro.superYacht": pair(
    "×25 opener that always wins its reel.",
    "×25 opener that always wins its reel.",
  ),
  "card.intro.mystery": pair(
    "One crate, three bonuses. Maybe the ×25 opener.",
    "One crate, three bonuses. Maybe the ×25 opener.",
  ),
  "card.intro.getaway": pair(
    "One spin. Floor it: max win or nothing.",
    "One spin. Floor it: max win or nothing.",
  ),
  "card.tapToContinue": pair("TAP TO CONTINUE", "TAP TO CONTINUE"),
  // Server (RGS) errors. Shown in a modal; keep each to one short sentence.
  "rgs.error.session": pair(
    "Your session has expired. Reload the game to continue.",
    "Your session has expired. Reload the game to continue.",
  ),
  "rgs.error.balance": pair(
    "Not enough balance for this bet.",
    "Not enough balance for this play.",
  ),
  "rgs.error.rateLimited": pair(
    "Too many requests. Wait a moment, then try again.",
    "Too many requests. Wait a moment, then try again.",
  ),
  "rgs.error.paused": pair(
    "Play is paused right now. Please try again later.",
    "Play is paused right now. Please try again later.",
  ),
  "rgs.error.generic": pair(
    "Something went wrong. Reload the game to finish any unfinished round.",
    "Something went wrong. Reload the game to finish any unfinished round.",
  ),
  "rgs.error.badLaunch": pair(
    "This game link is not valid. Relaunch the game from the lobby.",
    "This game link is not valid. Relaunch the game from the lobby.",
  ),
  // Bet Replay (replay=true). No path into live play from these screens.
  "replay.play": pair("PLAY", "PLAY"),
  "replay.playAgain": pair("PLAY AGAIN", "PLAY AGAIN"),
  "replay.loading": pair("Loading replay…", "Loading replay…"),
  /** (mode, base amount, real cost, win), amounts already formatted with the server currency. */
  "replay.result": pair<Text4>(
    (mode, base, cost, win) => `${mode}: ${base} · REAL COST: ${cost} · WIN: ${win}`,
    (mode, base, cost, win) => `${mode}: ${base} · REAL COST: ${cost} · WIN: ${win}`,
  ),
  "replay.error.notFound": pair(
    "This round could not be found.",
    "This round could not be found.",
  ),
  "replay.error.unavailable": pair(
    "Replay unavailable. Please try again.",
    "Replay unavailable. Please try again.",
  ),
  "replay.error.incomplete": pair(
    "This replay link is incomplete.",
    "This replay link is incomplete.",
  ),
  "replay.error.unplayable": pair(
    "This round can't be shown.",
    "This round can't be shown.",
  ),
  /** Badge line in the BALANCE cell. The base amount label reuses `label.betShort`. */
  "replay.badge": pair("REPLAY", "REPLAY"),
  "replay.realCost": pair("REAL COST", "REAL COST"),
  /** Plate text before Play is pressed. */
  "replay.ready": pair("REPLAY READY", "REPLAY READY"),
  /** Caption when the link has no amount, so values show as multipliers. */
  "replay.noAmount": pair(
    "Amounts are shown as multiples of the base bet.",
    "Amounts are shown as multiples of the base play.",
  ),
  // Replay mode titles: same names as the feature titles (no "buy" in any mode).
  "replay.mode.base": pair("Base Game", "Base Game"),
  "replay.mode.ante": pair("Ante", "Ante"),
  "replay.mode.dockside": pair("Dockside Catch", "Dockside Catch"),
  "replay.mode.yacht": pair("Yacht Stash", "Yacht Stash"),
  "replay.mode.mystery": pair("Mystery Bonus", "Mystery Bonus"),
  "replay.mode.getaway": pair("The Getaway", "The Getaway"),
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
