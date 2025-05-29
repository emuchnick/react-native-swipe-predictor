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
rustup target add aarch64-apple-ios x86_64-apple-ios

# Build the library
cargo lipo --release

# Create output directory
mkdir -p ../../ios/

# Copy the library
cp target/universal/release/libswipe_predictor.a ../../ios/

echo "iOS build complete! Library copied to ios/libswipe_predictor.a"