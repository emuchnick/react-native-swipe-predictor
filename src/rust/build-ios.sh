#!/bin/bash

set -e

echo "Building universal iOS library for swipe_predictor..."

# Install cargo-lipo if not already installed
if ! command -v cargo-lipo &> /dev/null; then
    echo "Installing cargo-lipo..."
    cargo install cargo-lipo
fi

# Add required targets
echo "Adding iOS targets..."
rustup target add aarch64-apple-ios x86_64-apple-ios

# Build universal library with cargo-lipo
echo "Building universal library with cargo-lipo..."
cargo lipo --release

# Create output directory
echo "Creating output directory..."
mkdir -p ../../ios

# Copy the universal library
echo "Copying universal library..."
cp target/universal/release/libswipe_predictor.a ../../ios/libswipe_predictor.a

echo "✅ Build complete!"
echo "Output: ios/libswipe_predictor.a (universal library for device + simulator)"