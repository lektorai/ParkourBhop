package ru.lektorai.slovaizslova.plugins

import android.content.Intent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Вариант сборки без покупок (PAYMENTS_ENABLED=false): платёжного SDK в приложении нет,
 * магазин показывает только монеты за рекламу.
 */
@CapacitorPlugin(name = "RuStorePay")
class RuStorePayPlugin : Plugin() {
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(JSObject().put("available", false))
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        call.resolve(JSObject().put("products", JSArray()))
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        call.resolve(JSObject().put("purchase", null))
    }

    @PluginMethod
    fun getPurchases(call: PluginCall) {
        call.resolve(JSObject().put("purchases", JSArray()))
    }

    @PluginMethod
    fun consume(call: PluginCall) {
        call.resolve()
    }
}

object PayBridge {
    @Suppress("UNUSED_PARAMETER")
    fun handleIntent(intent: Intent?) = Unit
}
