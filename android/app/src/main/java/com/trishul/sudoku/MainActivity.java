package com.trishul.sudoku;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** Native, dependency-free Android shell for the packaged offline Sudoku website. */
public final class MainActivity extends Activity {
    private static final String LOCAL_URL = "file:///android_asset/web/index.html";
    private WebView webView;
    private FrameLayout root;
    private OnBackInvokedCallback backCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(246,247,251));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);        // Local Sudoku controls
        settings.setDomStorageEnabled(true);        // Local saves, entirely on device
        settings.setAllowFileAccess(true);          // Packaged HTML/CSS/JS only
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);        // No requests to the internet
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // No in-app navigation to remote or arbitrary local sites.
                return !request.getUrl().toString().startsWith("file:///android_asset/web/");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith("file:///android_asset/web/")) {
                    return new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        webView.addJavascriptInterface(new ThemeBridge(), "SudokuAndroid");
        root.addView(webView, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        // Target SDK 35 enforces edge-to-edge. Keep the board clear of system bars.
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        webView.loadUrl(LOCAL_URL);
    }

    public final class ThemeBridge {
        @JavascriptInterface public void setDarkTheme(String choice) {
            if (!"dark".equals(choice) && !"light".equals(choice)) return;
            runOnUiThread(() -> {
                boolean dark = "dark".equals(choice);
                int bg = dark ? Color.rgb(17,21,31) : Color.rgb(246,247,251);
                root.setBackgroundColor(bg);
                getWindow().setStatusBarColor(bg);
                getWindow().setNavigationBarColor(bg);
                int flags = getWindow().getDecorView().getSystemUiVisibility();
                int status = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                int nav = Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0;
                flags = dark ? flags & ~(status | nav) : flags | status | nav;
                getWindow().getDecorView().setSystemUiVisibility(flags);
            });
        }
    }

    @Override public void onBackPressed() { handleBack(); }

    private void handleBack() {
        if (webView == null) { finish(); return; }
        // Close an open HTML modal before exiting the app.
        webView.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(!d)return false;d.dispatchEvent(new Event('cancel',{cancelable:true}));return true;})()", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('pagehide'));", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backCallback = null;
        }
        if (webView != null) {
            root.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
