# The Android JavaScript bridge is annotated @JavascriptInterface and used by WebView.
-keepclassmembers class com.trishul.sudoku.MainActivity$ThemeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
