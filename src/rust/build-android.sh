#!/bin/bash

# Build script for Android

set -e

echo "Building swipe_predictor for Android..."

# Android NDK setup
if [ -z "$ANDROID_NDK_HOME" ]; then
    echo "Error: ANDROID_NDK_HOME environment variable is not set"
    echo "Please set it to your Android NDK installation path"
    exit 1
fi

# Add Android targets if not already added
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android

# Set up cargo config for Android
mkdir -p .cargo
cat > .cargo/config.toml << EOF
[target.aarch64-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android21-clang"

[target.armv7-linux-androideabi]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/armv7a-linux-androideabi21-clang"

[target.x86_64-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/x86_64-linux-android21-clang"

[target.i686-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin/i686-linux-android21-clang"
EOF

# Build for all Android architectures
echo "Building for arm64-v8a..."
cargo build --target aarch64-linux-android --release

echo "Building for armeabi-v7a..."
cargo build --target armv7-linux-androideabi --release

echo "Building for x86_64..."
cargo build --target x86_64-linux-android --release

echo "Building for x86..."
cargo build --target i686-linux-android --release

# Create JNI directories
mkdir -p ../../android/src/main/jniLibs/arm64-v8a
mkdir -p ../../android/src/main/jniLibs/armeabi-v7a
mkdir -p ../../android/src/main/jniLibs/x86_64
mkdir -p ../../android/src/main/jniLibs/x86

# Copy libraries
cp target/aarch64-linux-android/release/libswipe_predictor.so ../../android/src/main/jniLibs/arm64-v8a/
cp target/armv7-linux-androideabi/release/libswipe_predictor.so ../../android/src/main/jniLibs/armeabi-v7a/
cp target/x86_64-linux-android/release/libswipe_predictor.so ../../android/src/main/jniLibs/x86_64/
cp target/i686-linux-android/release/libswipe_predictor.so ../../android/src/main/jniLibs/x86/

echo "Android build complete! Libraries copied to android/src/main/jniLibs/"