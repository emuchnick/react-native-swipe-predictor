#!/bin/bash

set -e

echo "Building iOS library for swipe_predictor (arm64 only)..."

# Add required target
echo "Adding iOS target..."
rustup target add aarch64-apple-ios

# Build for arm64 only (all modern iOS devices)
echo "Building for arm64..."
cargo build --target aarch64-apple-ios --release

# Create output directory
echo "Creating output directory..."
mkdir -p ../../ios

# Copy and strip the library
echo "Copying and stripping library..."
cp target/aarch64-apple-ios/release/libswipe_predictor.a ../../ios/libswipe_predictor.a
strip -x ../../ios/libswipe_predictor.a

echo "✅ Build complete!"
echo "Output: ios/libswipe_predictor.a (arm64 only)"
echo "Size: $(ls -lh ../../ios/libswipe_predictor.a | awk '{print $5}')"