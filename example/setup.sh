#!/bin/bash

echo "Setting up example app..."

# Install dependencies
echo "Installing dependencies..."
yarn install

# For iOS, we need to patch the AppDelegate.h file after it's generated
if [ -f "ios/SwipePredictorExample/AppDelegate.h" ]; then
  echo "Patching AppDelegate.h..."
  # Check if bundleURL is already declared
  if ! grep -q "bundleURL" ios/SwipePredictorExample/AppDelegate.h; then
    # Add the bundleURL method declaration before @end
    sed -i '' 's/@end/- (NSURL *)bundleURL;\
\
@end/' ios/SwipePredictorExample/AppDelegate.h
    echo "✅ AppDelegate.h patched successfully"
  else
    echo "✅ AppDelegate.h already contains bundleURL declaration"
  fi
fi

# Install pods
echo "Installing CocoaPods..."
cd ios && pod install && cd ..

echo "✅ Setup complete! You can now run 'yarn ios' or 'yarn android'"