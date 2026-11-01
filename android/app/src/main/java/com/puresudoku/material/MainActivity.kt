package com.puresudoku.material

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import android.widget.FrameLayout
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/** Offline, permission-free wrapper for Pure Sudoku. The WebView never loads the network. */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var backCallback: OnBackInvokedCallback? = null

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
                domStorageEnabled = true
                databaseEnabled = false
                cacheMode = WebSettings.LOAD_NO_CACHE
                allowFileAccess = true // Only bundled file:///android_asset/index.html is loaded.
                allowContentAccess = false
                blockNetworkImage = true
                blockNetworkLoads = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = false
            }

            addJavascriptInterface(AndroidBridge(this), "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    // Never permit a WebView navigation outside our bundled application.
                    return true
                }
            }
            loadUrl("file:///android_asset/index.html")
        }

        // Android 15/16 draw edge-to-edge for targetSdk 35+. Apply actual system
        // bar and cutout insets to the WebView host; the game canvas remains usable.
        val root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            root.setOnApplyWindowInsetsListener { view, insets ->
                val safe = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
                insets
            }
        } else {
            @Suppress("DEPRECATION")
            root.fitsSystemWindows = true
        }
        setContentView(root)
        applySystemBarTheme("light")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val cb = OnBackInvokedCallback { handleBackFromAndroid() }
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb)
            backCallback = cb
        }
    }

    private fun handleBackFromAndroid() {
        // Modal -> close, active puzzle -> pause, paused puzzle -> exit.
        // Do not navigate WebView history, which might include untrusted URLs.
        webView.evaluateJavascript("window.pureSudokuHandleBack && window.pureSudokuHandleBack()") { result ->
            if (result != "true") finish()
        }
    }

    @Deprecated("Android 13+ uses the system OnBackInvokedDispatcher")
    override fun onBackPressed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) handleBackFromAndroid()
        else super.onBackPressed()
    }

    private fun applySystemBarTheme(theme: String) {
        runOnUiThread {
            val isDark = theme == "dark"
            val bgColor = if (isDark) Color.parseColor("#10131A") else Color.parseColor("#F8F9FF")
            @Suppress("DEPRECATION")
            window.statusBarColor = bgColor
            @Suppress("DEPRECATION")
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
        fun setSystemBarTheme(theme: String) = applySystemBarTheme(theme)
    }

    override fun onPause() {
        // Pause gameplay and save immediately before WebView timers are suspended.
        webView.evaluateJavascript("window.pureSudokuOnBackground && window.pureSudokuOnBackground()", null)
        webView.onPause()
        webView.pauseTimers()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
        // Deliberately do not auto-resume a puzzle after a phone interruption.
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backCallback?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
        }
        webView.destroy()
        super.onDestroy()
    }
}
