package com.puresudoku.material

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Ultra-lightweight, zero-permission, 100% offline Android wrapper for Pure Sudoku Material 3.
 * Uses the built-in system WebView with hardware acceleration, native HapticFeedback,
 * and strict offline asset loading.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F8F9FF"))
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true // Enables localStorage auto-save
                databaseEnabled = false
                cacheMode = WebSettings.LOAD_NO_CACHE
                allowFileAccess = true
                allowContentAccess = false
                blockNetworkImage = true
                blockNetworkLoads = true // Strictly offline enforcement
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = false
            }

            addJavascriptInterface(AndroidBridge(this), "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    // Block all external navigation
                    return true
                }
            }

            loadUrl("file:///android_asset/index.html")
        }

        setContentView(webView)
        applySystemBarTheme("light")
    }

    private fun applySystemBarTheme(theme: String) {
        runOnUiThread {
            val isDark = theme == "dark"
            val bgColor = if (isDark) Color.parseColor("#10131A") else Color.parseColor("#F8F9FF")
            window.statusBarColor = bgColor
            window.navigationBarColor = bgColor

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val appearance = if (isDark) 0 else (
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                )
                window.insetsController?.setSystemBarsAppearance(
                    appearance,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                )
            } else {
                @Suppress("DEPRECATION")
                var flags = window.decorView.systemUiVisibility
                flags = if (isDark) {
                    flags and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                } else {
                    flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                }
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = flags
            }
        }
    }

    inner class AndroidBridge(private val hostView: View) {
        @JavascriptInterface
        fun haptic(type: String) {
            hostView.post {
                val feedback = when (type) {
                    "error" -> HapticFeedbackConstants.LONG_PRESS
                    "success" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
                    else -> HapticFeedbackConstants.CLOCK_TICK
                }
                hostView.performHapticFeedback(feedback)
            }
        }

        @JavascriptInterface
        fun setSystemBarTheme(theme: String) {
            applySystemBarTheme(theme)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers() // Zero background CPU usage
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
