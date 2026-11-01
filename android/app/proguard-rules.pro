# Keep the JavascriptInterface methods for the offline Sudoku WebView bridge
-keepclassmembers class com.puresudoku.material.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
