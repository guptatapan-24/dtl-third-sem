# CampusPool - Expo Setup Guide

## ✅ Conversion Complete

Your React Native project has been successfully converted to use **Expo**! This means you can now run the app on multiple platforms including web, Android, and iOS without needing a native development environment.

## 🚀 Running the App

### On Web (Easiest for Codespace)
```bash
cd campuspool-rn
npm run web
```
This will open the app in your browser at `http://localhost:19006`

### On Android (using Expo Go)
```bash
cd campuspool-rn
npm run android
```
Then scan the QR code with the **Expo Go** app on an Android phone

### On iOS (using Expo Go)
```bash
cd campuspool-rn
npm run ios
```
Then scan the QR code with the **Expo Go** app on an iPhone

### Metro Bundler (Development)
```bash
cd campuspool-rn
npm start
```

## 📝 What Changed

### 1. **Updated Dependencies**
- Added `expo`, `expo-cli`, `expo-constants`, `expo-splash-screen`, `expo-font`
- Removed need for Android SDK, Java, Gradle

### 2. **Configuration Files**
- Created `app.json` - Expo app configuration
- Updated `babel.config.js` - Now uses `babel-preset-expo`
- Updated `metro.config.js` - Uses Expo's metro configuration
- Created `.env.local` - Environment variables for Supabase

### 3. **Updated Entry Point**
- Created `index.ts` - Expo entry point with `registerRootComponent`
- Updated `App.tsx` - Added `SafeAreaProvider` for safe area handling

### 4. **Updated Scripts** (package.json)
```json
{
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web"
}
```

### 5. **Supabase Integration**
- Updated `supabaseClient.ts` to use Expo's `Constants` for environment variables
- Changed from `REACT_APP_*` to `EXPO_PUBLIC_*` environment variables

## 🔧 Setting Up Supabase Credentials

1. Open `.env.local` in your editor
2. Add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key_here
   ```

## 📱 Testing in Codespace

For testing in Codespace, the **best option is to run on web**:
```bash
npm run web
```

This will:
- Start the development server
- Open your app in a browser
- Allow hot-reload for instant updates
- No external devices needed

## 🎯 Next Steps

1. **Install Expo Go** on your mobile device (if testing on device):
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Configure environment variables** in `.env.local`

3. **Start the app**:
   ```bash
   npm run web  # For web/Codespace
   npm start    # For mobile
   ```

## 📚 Useful Links

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/reference/javascript/introduction)
- [Expo Go App](https://expo.dev/go)

## ⚠️ Notes

- The project is now optimized for Expo but can still be ejected to a bare React Native project if needed
- All React Navigation features are fully supported
- Supabase integration works seamlessly with Expo
