plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersion = Regex("\"version\"\\s*:\\s*\"(\\d+)\\.(\\d+)\\.(\\d+)\"")
    .find(rootProject.file("../package.json").readText())
    ?: error("package.json must contain a MAJOR.MINOR.PATCH version")
val major = appVersion.groupValues[1].toInt()
val minor = appVersion.groupValues[2].toInt()
val patch = appVersion.groupValues[3].toInt()
require(major <= 2000 && minor <= 999 && patch <= 999)
val appVersionCode = major * 1_000_000 + minor * 1_000 + patch
val appVersionName = "$major.$minor.$patch"
val signatureKeys = listOf("ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD")
val isSignedBuild = signatureKeys.all { !System.getenv(it).isNullOrBlank() }

android {
    namespace = "com.puresudoku.material"
    compileSdk = 36

    defaultConfig {
        // Preserve v0.1.0 identity so the new signed app upgrades the old installation.
        applicationId = "com.trishul.sudoku"
        minSdk = 24
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName
    }

    signingConfigs {
        create("release") {
            if (isSignedBuild) {
                storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            if (isSignedBuild) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        getByName("debug") { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
