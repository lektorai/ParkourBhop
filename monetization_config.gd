class_name MonetizationConfig
## All monetisation knobs in one place. Fill these in before a release build.

## Yandex Mobile Ads (https://ads.yandex.ru) unit ids. Leave empty to ship without ads.
const API_KEY := ""
const INTERSTITIAL_ID := ""   # e.g. "R-M-XXXXXXX-1"
const REWARDED_ID := ""       # e.g. "R-M-XXXXXXX-2"
const BANNER_ID := ""

## Show an interstitial after every N solved puzzles (never when "no ads" bought).
const INTERSTITIAL_EVERY_N_WINS := 3

## Free hints per puzzle before a rewarded ad / hint bank is required.
const FREE_HINTS_PER_PUZZLE := 3
## Fallback cooldown (seconds) for a free hint when no ad SDK is installed.
const HINT_COOLDOWN_NO_ADS := 20
## Mistakes allowed before "out of lives".
const MAX_MISTAKES := 3

## RuStore product ids (create them in RuStore Console → Монетизация).
const PRODUCT_NO_ADS := "no_ads"          # non-consumable, suggested price 149 ₽
const PRODUCT_HINTS_20 := "hints_20"      # consumable, suggested price 79 ₽

## Privacy policy URL shown in settings (host docs/privacy.html on GitHub Pages).
const PRIVACY_URL := "https://lektorai.github.io/ParkourBhop/privacy.html"
