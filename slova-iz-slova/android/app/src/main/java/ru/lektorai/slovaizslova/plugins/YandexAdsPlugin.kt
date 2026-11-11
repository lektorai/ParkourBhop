package ru.lektorai.slovaizslova.plugins

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yandex.mobile.ads.common.AdError
import com.yandex.mobile.ads.common.AdRequest
import com.yandex.mobile.ads.common.AdRequestError
import com.yandex.mobile.ads.common.ImpressionData
import com.yandex.mobile.ads.common.YandexAds
import com.yandex.mobile.ads.interstitial.InterstitialAd
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader
import com.yandex.mobile.ads.rewarded.Reward
import com.yandex.mobile.ads.rewarded.RewardedAd
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoader
import ru.lektorai.slovaizslova.BuildConfig

/**
 * Реклама Yandex Mobile Ads для игры: полноэкранная и за награду.
 * Объявления загружаются заранее; после показа сразу грузится следующее.
 * В отладочной сборке всегда используются демо-блоки Яндекса.
 */
@CapacitorPlugin(name = "YandexAds")
class YandexAdsPlugin : Plugin() {
    private val handler = Handler(Looper.getMainLooper())

    private var interstitialId = DEMO_INTERSTITIAL
    private var rewardedId = DEMO_REWARDED

    private var interstitialLoader: InterstitialAdLoader? = null
    private var rewardedLoader: RewardedAdLoader? = null
    private var interstitial: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var interstitialLoading = false
    private var rewardedLoading = false

    /** Игрок нажал «Смотреть рекламу», а ролик ещё грузится: ждём загрузку не дольше REWARDED_WAIT_MS. */
    private var waitingRewardedCall: PluginCall? = null

    @PluginMethod
    fun initialize(call: PluginCall) {
        if (!BuildConfig.DEBUG) {
            call.getString("interstitialId")?.takeIf { it.isNotBlank() }?.let { interstitialId = it }
            call.getString("rewardedId")?.takeIf { it.isNotBlank() }?.let { rewardedId = it }
        }
        activity.runOnUiThread {
            YandexAds.initialize(context) {
                handler.post {
                    interstitialLoader = InterstitialAdLoader(context)
                    rewardedLoader = RewardedAdLoader(context)
                    loadInterstitial()
                    loadRewarded()
                }
            }
            call.resolve()
        }
    }

    private fun loadInterstitial() {
        val loader = interstitialLoader ?: return
        if (interstitial != null || interstitialLoading) return
        interstitialLoading = true
        loader.loadAd(AdRequest.Builder(interstitialId).build(), object : InterstitialAdLoadListener {
            override fun onAdLoaded(ad: InterstitialAd) {
                interstitialLoading = false
                interstitial = ad
            }

            override fun onAdFailedToLoad(adRequestError: AdRequestError) {
                interstitialLoading = false
            }
        })
    }

    private fun loadRewarded() {
        val loader = rewardedLoader ?: return
        if (rewarded != null || rewardedLoading) return
        rewardedLoading = true
        loader.loadAd(AdRequest.Builder(rewardedId).build(), object : RewardedAdLoadListener {
            override fun onAdLoaded(ad: RewardedAd) {
                rewardedLoading = false
                rewarded = ad
                waitingRewardedCall?.let { call ->
                    waitingRewardedCall = null
                    presentRewarded(call)
                }
            }

            override fun onAdFailedToLoad(adRequestError: AdRequestError) {
                rewardedLoading = false
                waitingRewardedCall?.let { call ->
                    waitingRewardedCall = null
                    call.resolve(JSObject().put("rewarded", false))
                }
            }
        })
    }

    @PluginMethod
    fun showInterstitial(call: PluginCall) {
        activity.runOnUiThread {
            val ad = interstitial
            if (ad == null) {
                // Реклама не готова: игру не задерживаем, грузим к следующей паузе.
                loadInterstitial()
                call.resolve(JSObject().put("shown", false))
                return@runOnUiThread
            }
            interstitial = null
            var shown = false
            ad.setAdEventListener(object : InterstitialAdEventListener {
                override fun onAdShown() {
                    shown = true
                }

                override fun onAdFailedToShow(adError: AdError) {
                    ad.setAdEventListener(null)
                    call.resolve(JSObject().put("shown", false))
                    loadInterstitial()
                }

                override fun onAdDismissed() {
                    ad.setAdEventListener(null)
                    call.resolve(JSObject().put("shown", shown))
                    loadInterstitial()
                }

                override fun onAdClicked() = Unit

                override fun onAdImpression(impressionData: ImpressionData?) = Unit
            })
            ad.show(activity)
        }
    }

    @PluginMethod
    fun showRewarded(call: PluginCall) {
        activity.runOnUiThread {
            if (rewarded != null) {
                presentRewarded(call)
                return@runOnUiThread
            }
            if (rewardedLoader == null || waitingRewardedCall != null) {
                call.resolve(JSObject().put("rewarded", false))
                return@runOnUiThread
            }
            waitingRewardedCall = call
            loadRewarded()
            handler.postDelayed({
                if (waitingRewardedCall === call) {
                    waitingRewardedCall = null
                    call.resolve(JSObject().put("rewarded", false))
                }
            }, REWARDED_WAIT_MS)
        }
    }

    private fun presentRewarded(call: PluginCall) {
        val ad = rewarded
        if (ad == null) {
            call.resolve(JSObject().put("rewarded", false))
            return
        }
        rewarded = null
        var earned = false
        ad.setAdEventListener(object : RewardedAdEventListener {
            override fun onAdShown() = Unit

            override fun onAdFailedToShow(adError: AdError) {
                ad.setAdEventListener(null)
                call.resolve(JSObject().put("rewarded", false))
                loadRewarded()
            }

            override fun onAdDismissed() {
                ad.setAdEventListener(null)
                // Награда — только если SDK засчитал просмотр.
                call.resolve(JSObject().put("rewarded", earned))
                loadRewarded()
            }

            override fun onAdClicked() = Unit

            override fun onAdImpression(impressionData: ImpressionData?) = Unit

            override fun onRewarded(reward: Reward) {
                earned = true
            }
        })
        ad.show(activity)
    }

    override fun handleOnDestroy() {
        interstitial?.setAdEventListener(null)
        rewarded?.setAdEventListener(null)
        interstitial = null
        rewarded = null
        interstitialLoader = null
        rewardedLoader = null
        handler.removeCallbacksAndMessages(null)
        super.handleOnDestroy()
    }

    private companion object {
        const val DEMO_INTERSTITIAL = "demo-interstitial-yandex"
        const val DEMO_REWARDED = "demo-rewarded-yandex"
        const val REWARDED_WAIT_MS = 8000L
    }
}
