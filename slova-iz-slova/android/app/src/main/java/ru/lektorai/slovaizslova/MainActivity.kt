package ru.lektorai.slovaizslova

import android.content.Intent
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.getcapacitor.BridgeActivity
import ru.lektorai.slovaizslova.plugins.PayBridge
import ru.lektorai.slovaizslova.plugins.RuStorePayPlugin
import ru.lektorai.slovaizslova.plugins.YandexAdsPlugin

/**
 * Единственный экран приложения: игра (веб-сборка из assets/public) внутри Capacitor.
 * Системная кнопка «Назад» обрабатывается в игре: предыдущий экран, а в меню — диалог выхода.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Нативный сплэш (Android 12+ API, на старых версиях — через core-splashscreen).
        installSplashScreen()
        registerPlugin(YandexAdsPlugin::class.java)
        registerPlugin(RuStorePayPlugin::class.java)
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) {
            PayBridge.handleIntent(intent)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Возврат из банковского приложения после оплаты (только в варианте сборки pay).
        PayBridge.handleIntent(intent)
    }
}
