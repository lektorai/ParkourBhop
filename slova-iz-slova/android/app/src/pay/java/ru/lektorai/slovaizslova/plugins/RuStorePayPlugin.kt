package ru.lektorai.slovaizslova.plugins

import android.content.Intent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ru.rustore.sdk.pay.RuStorePayClient
import ru.rustore.sdk.pay.model.AcknowledgementState
import ru.rustore.sdk.pay.model.PreferredPurchaseType
import ru.rustore.sdk.pay.model.ProductId
import ru.rustore.sdk.pay.model.ProductPurchase
import ru.rustore.sdk.pay.model.ProductPurchaseParams
import ru.rustore.sdk.pay.model.ProductPurchaseStatus
import ru.rustore.sdk.pay.model.ProductType
import ru.rustore.sdk.pay.model.PurchaseAvailabilityResult
import ru.rustore.sdk.pay.model.PurchaseId
import ru.rustore.sdk.pay.model.RuStorePaymentException
import ru.rustore.sdk.pay.model.SdkTheme

/**
 * Покупки через Pay SDK RuStore (вариант сборки pay, PAYMENTS_ENABLED=true).
 *
 * Оплата одностадийная. «Потребление» расходуемой покупки — это отметка «товар выдан»
 * (AcknowledgementState.ACKNOWLEDGED): игра ставит её после того, как начислила монеты и сохранилась.
 * getPurchases возвращает невыданные расходуемые покупки и все постоянные — для восстановления.
 */
@CapacitorPlugin(name = "RuStorePay")
class RuStorePayPlugin : Plugin() {
    private val client: RuStorePayClient
        get() = RuStorePayClient.instance

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        client.getPurchaseInteractor().getPurchaseAvailability()
            .addOnSuccessListener { result ->
                call.resolve(JSObject().put("available", result is PurchaseAvailabilityResult.Available))
            }
            .addOnFailureListener {
                call.resolve(JSObject().put("available", false))
            }
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val ids = call.getArray("ids")?.toList<String>().orEmpty()
        client.getProductInteractor().getProducts(ids.map { ProductId(it) })
            .addOnSuccessListener { products ->
                val items = JSArray()
                for (product in products) {
                    items.put(
                        JSObject()
                            .put("id", product.productId.value)
                            .put("title", product.title.value)
                            .put("description", product.description?.value ?: "")
                            // Цена с валютой — как её отформатировал RuStore.
                            .put("priceLabel", product.amountLabel.value)
                            .put("price", ((product.price?.value ?: 0) / 100.0).toString())
                            .put("currency", product.currency.value)
                    )
                }
                call.resolve(JSObject().put("products", items))
            }
            .addOnFailureListener { error ->
                call.reject(error.message ?: "getProducts failed")
            }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val id = call.getString("id")
        if (id.isNullOrBlank()) {
            call.reject("id is required")
            return
        }
        client.getPurchaseInteractor()
            .purchase(
                params = ProductPurchaseParams(productId = ProductId(id)),
                preferredPurchaseType = PreferredPurchaseType.ONE_STEP,
                sdkTheme = SdkTheme.LIGHT,
            )
            .addOnSuccessListener { result ->
                val purchase = JSObject()
                    .put("productId", result.productId.value)
                    .put("purchaseId", result.purchaseId.value)
                call.resolve(JSObject().put("purchase", purchase))
            }
            .addOnFailureListener { error ->
                if (error is RuStorePaymentException.ProductPurchaseCancelled) {
                    call.resolve(JSObject().put("purchase", null))
                } else {
                    call.reject(error.message ?: "purchase failed")
                }
            }
    }

    @PluginMethod
    fun getPurchases(call: PluginCall) {
        client.getPurchaseInteractor().getPurchases()
            .addOnSuccessListener { purchases ->
                val items = JSArray()
                for (purchase in purchases) {
                    if (purchase !is ProductPurchase || purchase.status != ProductPurchaseStatus.CONFIRMED) continue
                    val permanent = purchase.productType == ProductType.NON_CONSUMABLE_PRODUCT
                    val pending = purchase.productType == ProductType.CONSUMABLE_PRODUCT &&
                        purchase.acknowledgementState != AcknowledgementState.ACKNOWLEDGED
                    if (permanent || pending) {
                        items.put(
                            JSObject()
                                .put("productId", purchase.productId.value)
                                .put("purchaseId", purchase.purchaseId.value)
                        )
                    }
                }
                call.resolve(JSObject().put("purchases", items))
            }
            .addOnFailureListener { error ->
                call.reject(error.message ?: "getPurchases failed")
            }
    }

    @PluginMethod
    fun consume(call: PluginCall) {
        val purchaseId = call.getString("purchaseId")
        if (purchaseId.isNullOrBlank()) {
            call.reject("purchaseId is required")
            return
        }
        client.getPurchaseInteractor()
            .updateAcknowledgementState(
                purchaseId = PurchaseId(purchaseId),
                state = AcknowledgementState.ACKNOWLEDGED,
            )
            .addOnSuccessListener { call.resolve() }
            .addOnFailureListener { error -> call.reject(error.message ?: "consume failed") }
    }
}

object PayBridge {
    /** Возврат из банковского приложения: SDK восстанавливает платёжную шторку. */
    fun handleIntent(intent: Intent?) {
        RuStorePayClient.instance.getIntentInteractor().proceedIntent(intent, sdkTheme = SdkTheme.LIGHT)
    }
}
