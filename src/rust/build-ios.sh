#!/bin/bash

# Build script for iOS

set -e

echo "Building swipe_predictor for iOS..."

# Install cargo-lipo if not already installed
if ! command -v cargo-lipo &> /dev/null; then
    echo "Installing cargo-lipo..."
    cargo install cargo-lipo
fi

# Add iOS targets if not already added
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios

# Build the library for simulator (arm64 + x86_64)
echo "Building for iOS Simulator..."
cargo lipo --release --targets aarch64-apple-ios-sim,x86_64-apple-ios

# Create output directory
mkdir -p ../../ios/

# Copy the simulator library
cp target/universal/release/libswipe_predictor.a ../../ios/libswipe_predictor_simulator.a

# Also build for device if needed
echo "Building for iOS Device..."
cargo build --release --target aarch64-apple-ios
cp target/aarch64-apple-ios/release/libswipe_predictor.a ../../ios/libswipe_predictor_device.a

echo "iOS build complete!"
echo "Simulator library: ios/libswipe_predictor_simulator.a"
echo "Device library: ios/libswipe_predictor_device.a"