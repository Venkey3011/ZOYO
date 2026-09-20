# 🎙️ ZOYO - Voice Chat & Games

<div align="center">

![ZOYO Logo](./public/logo.jpg)

**A Premium Social Voice Chat Platform with Real-Time Interactive Games**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0.1-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg)](https://www.mongodb.com/)

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Usage](#-usage) • [API](#-api-documentation) • [Contributing](#-contributing)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [User Roles & Permissions](#-user-roles--permissions)
- [Games & Features](#-games--features)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**ZOYO** is a cutting-edge social voice chat platform that combines real-time voice communication with interactive games. Built with modern web technologies, it offers a seamless mobile-first experience with features like voice rooms, animated gifts, in-app currency, and multiplayer games including Ludo, Dice Duel, and Lucky Wheel.

### Key Highlights

- 🎤 **Real-Time Voice Chat** - Crystal-clear voice rooms with up to 9 simultaneous speakers
- 🎮 **Interactive Games** - Ludo, Dice Duel, Lucky Wheel with real-time multiplayer
- 💎 **Virtual Economy** - Coins, gifts, premium frames, and chat bubble styles
- 👥 **Role-Based Access** - Admin, Manager, Coin Seller, and User roles
- 🎨 **Beautiful UI/UX** - Mobile-first design with smooth animations
- 🔐 **Multi-Auth Support** - Email/Password, Phone OTP, and Social Login (Google, Facebook, Twitter)
- 📊 **Admin Dashboard** - Comprehensive user management and analytics
- 🌐 **Dual Database Mode** - MongoDB Atlas with in-memory fallback

---

## ✨ Features

### 🎙️ Voice Chat Rooms

- **Multi-Seat System**: Host seat + 8 guest seats with individual mic controls
- **Real-Time Audio**: Microphone access with live voice level visualization
- **Seat Management**: Sit yourself, spawn preset guests, or create custom participants
- **Mute Controls**: Individual and global mute functionality
- **Chat Integration**: Real-time text chat alongside voice communication

### 🎮 Games & Entertainment

#### 🎲 Ludo
- Turn-based board game with up to 4 players
- Dice rolling with animated effects
- Real-time game state synchronization
- Victory celebrations with coin rewards

#### 🎯 Dice Duel
- Head-to-head dice battle between two players
- Coin betting system
- Best-of-three rounds
- Instant winner determination

#### 🎰 Lucky Wheel
- Spin-to-win prize wheel
- Multiple reward tiers (coins, gifts, bonuses)
- Smooth rotation animations
- Random prize distribution

### 💰 Virtual Economy

- **Coins System**: Purchase, earn, and spend virtual currency
- **Animated Gifts**: Send roses, crowns, supercars, and rockets
- **Premium Items**: Unlock avatar frames and chat bubble styles
- **Coin Transfers**: Admin/Manager/Coin Seller can distribute coins
- **Transaction Logs**: Complete audit trail of all transfers

### 👤 User Profiles

- **Customizable Avatars**: Preset gallery or custom images
- **Level System**: Progress through gameplay and engagement
- **Badges & Achievements**: Earn medals and status symbols
- **Profile Details**: Gender, date of birth, country, phone, email
- **Social Stats**: Followers, following, gifts, visitors counts
- **VIP Status**: None, VIP, SVIP tiers

### 🛡️ Admin Console

- **User Management**: View, search, block/unblock users
- **Role Assignment**: Promote users to Manager or Coin Seller
- **Coin Distribution**: Transfer coins to any user
- **Sub-User Creation**: Register users under specific managers
- **Audit Logs**: View complete transfer history (Admin-only)
- **Database Status**: Monitor MongoDB connection status

### 🔐 Authentication

- **Email/Password**: Traditional registration and login
- **Phone OTP**: SMS-based one-time password (simulated)
- **Social Login**: Google, Facebook, Twitter OAuth integration
- **Account Recovery**: Password reset functionality
- **Mandatory Fields**: Username, password, email/phone, gender, DOB, country

---

## 🛠️ Technology Stack

### Frontend
- **React 19.0.1** - UI framework with latest features
- **TypeScript 5.8.2** - Type-safe development
- **Vite 6.2.3** - Lightning-fast build tool
- **Tailwind CSS 4.1.14** - Utility-first styling
- **Motion (Framer Motion) 12.23.24** - Smooth animations
- **Lucide React 0.546.0** - Beautiful icon library

### Backend
- **Node.js** - JavaScript runtime
- **Express 4.21.2** - Web framework
- **MongoDB 9.10.0** (Mongoose) - NoSQL database
- **TypeScript** - Type-safe server code

### Development
- **TSX 4.21.0** - TypeScript execution
- **ESBuild 0.25.0** - Fast bundling
- **Dotenv 17.2.3** - Environment configuration

### Audio & Media
- **Web Audio API** - Real-time audio processing
- **MediaStream API** - Microphone capture
- **Canvas API** - Game rendering

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (React + TypeScript + Tailwind + Motion)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST API
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      Express Server                          │
│  • Authentication (JWT-style session)                       │
│  • User Management                                          │
│  • Coin Transactions                                        │
│  • OTP Generation & Verification                           │
│  • Admin Console APIs                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐    ┌──────────▼──────────┐
│  MongoDB Atlas │ OR │  In-Memory Fallback │
│  (Production)  │    │   (Development)     │
└────────────────┘    └─────────────────────┘
```

### Component Hierarchy

```
App.tsx (Root)
├── MobileFrame (Layout Shell)
│   ├── Header (Coins, Avatar, Back Button)
│   ├── Content Area
│   │   ├── LoginScreen (Unauthenticated)
│   │   ├── RoomList (Home Tab)
│   │   │   ├── Search Bar
│   │   │   ├── Category Filters
│   │   │   ├── Promotional Banners
│   │   │   └── Room Cards
│   │   ├── VoiceRoom (Active Room)
│   │   │   ├── Seat Grid (9 seats)
│   │   │   ├── Chat Messages
│   │   │   ├── Games (Ludo/Dice/Wheel)
│   │   │   └── Gift Drawer
│   │   ├── DirectMessages (Chat Tab)
│   │   │   ├── Contact List
│   │   │   └── Chat Window
│   │   ├── ProfileTab (Profile Tab)
│   │   │   ├── Profile Header
│   │   │   ├── Stats Grid
│   │   │   ├── Achievements
│   │   │   └── Settings
│   │   └── AdminConsole (Admin Tab)
│   │       ├── User Control
│   │       ├── Coin Transfer
│   │       ├── Access Privilege
│   │       └── Audit Logs
│   └── Navigation Bar (4-5 tabs based on role)
└── Global Modals (Ban Dialog, Splash Screen)
```

---

## 📦 Installation

### Prerequisites

- **Node.js 18.x or higher** ([Download](https://nodejs.org/))
- **npm** or **bun** package manager
- **MongoDB Atlas account** (optional, has in-memory fallback)
- **Git** for version control

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/zoyo-voice-chat.git
cd zoyo-voice-chat
```

### Step 2: Install Dependencies

```bash
# Using npm
npm install

# OR using bun (faster)
bun install
```

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# MongoDB Atlas Connection (Optional - has in-memory fallback)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/zoyo?retryWrites=true&w=majority

# Gemini API Key (Optional - for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# App URL (for production deployment)
APP_URL=http://localhost:3000
```

### Step 4: Start Development Server

```bash
# Development mode with hot reload
npm run dev

# OR
bun run dev
```

The app will be available at `http://localhost:3000`

### Step 5: Build for Production

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

---

## ⚙️ Configuration

### MongoDB Setup (Optional)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Whitelist your IP address (0.0.0.0/0 for development)
4. Create a database user
5. Get your connection string and add it to `.env`

**Note**: If MongoDB is not configured, the app automatically falls back to in-memory storage with a pre-seeded Admin account.

### Default Credentials

#### Admin Account (Pre-seeded)
- **Username**: `Admin`
- **Password**: `Admin123`
- **Coins**: 999,999,999 (unlimited)
- **YOYO ID**: `888888`

---

## 🚀 Usage

### For Users

1. **Sign Up**
   - Click "Create New Account"
   - Fill in mandatory fields (username, password, email/phone, gender, DOB, country)
   - Choose an avatar
   - Submit to create account

2. **Login Options**
   - **Email/Password**: Standard authentication
   - **Phone OTP**: Enter phone number → Receive OTP → Verify
   - **Social Login**: Click Google/Facebook/Twitter button

3. **Create a Voice Room**
   - Navigate to Home tab
   - Click "Create Room" button
   - Choose title, category (Chat/Games/Singing/Match), and theme
   - Submit to create your room

4. **Join a Room**
   - Browse available rooms
   - Click any room card to enter
   - Click an empty seat to sit and activate microphone

5. **Play Games**
   - Inside a room, click game buttons (Ludo/Dice/Wheel)
   - Follow on-screen instructions
   - Win coins and rewards!

6. **Send Gifts**
   - Click gift icon in voice room
   - Select recipient (host or specific seat)
   - Choose gift and confirm (deducts coins)

### For Admins/Managers

1. **Access Admin Console**
   - Login with admin/manager account
   - Navigate to "Admin" tab (shield icon)

2. **Manage Users**
   - **User Control Tab**: View all users, search, block/unblock
   - **Access Privilege Tab**: Assign roles (Manager, Coin Seller)
   - **Create Sub-Users**: Register users under your management

3. **Coin Distribution**
   - **Coin Transfer Tab**: Enter amount and transfer to any user
   - Admin has unlimited coins
   - Managers/Coin Sellers deduct from their balance

4. **Audit Logs** (Admin Only)
   - View complete transfer history
   - See sender, receiver, amount, timestamp, and roles

---

## 📡 API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123",
  "email": "john@example.com",
  "phoneNumber": "966501234567",
  "gender": "Male",
  "dateOfBirth": "1995-05-15",
  "country": "Saudi Arabia",
  "avatar": "https://images.unsplash.com/photo-...",
  "coins": 0
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "name": "john_doe",
    "email": "john@example.com",
    "level": 1,
    "coins": 0,
    "yoyoId": "123456",
    ...
  }
}
```

#### POST `/api/auth/login`
Standard username/password authentication.

**Request Body:**
```json
{
  "username": "Admin",
  "password": "Admin123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "admin_static",
    "name": "Admin",
    "role": "admin",
    "coins": 999999999,
    ...
  }
}
```

#### POST `/api/auth/send-otp`
Send OTP code to phone number (simulated).

**Request Body:**
```json
{
  "phoneNumber": "966501234567",
  "purpose": "login" // or "signup"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to 966501234567",
  "otp": "123456"
}
```

#### POST `/api/auth/verify-otp`
Verify OTP code.

**Request Body:**
```json
{
  "phoneNumber": "966501234567",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP code verified successfully!"
}
```

#### POST `/api/auth/login-otp`
Login using verified OTP.

**Request Body:**
```json
{
  "phoneNumber": "966501234567",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

#### POST `/api/auth/social-login`
Login or signup via social provider.

**Request Body:**
```json
{
  "email": "john@gmail.com",
  "name": "John Doe",
  "avatar": "https://...",
  "provider": "google",
  "socialId": "google_123456789"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "isNewUser": false
}
```

### User Management Endpoints

#### GET `/api/users`
Get all registered users (admin/manager only).

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "...",
      "name": "john_doe",
      "level": 5,
      "coins": 1500,
      "role": "user",
      ...
    }
  ]
}
```

#### GET `/api/users/:id/status`
Check user's block status and current balance.

**Response:**
```json
{
  "success": true,
  "isBlocked": false,
  "role": "user",
  "coins": 1500
}
```

#### POST `/api/users/:id/update`
Update user profile fields.

**Request Body:**
```json
{
  "name": "new_username",
  "avatar": "https://...",
  "frameId": "frame_neon",
  "bubbleId": "bubble_pink"
}
```

#### POST `/api/users/:id/role`
Change user role (admin only).

**Request Body:**
```json
{
  "role": "manager" // or "coin_seller", "user"
}
```

#### POST `/api/users/:id/block`
Block or unblock user (admin/manager).

**Request Body:**
```json
{
  "isBlocked": true
}
```

#### POST `/api/users/:id/assign-manager`
Assign a manager to user (admin only).

**Request Body:**
```json
{
  "managerId": "64f8a1b2c3d4e5f6a7b8c9d0"
}
```

#### POST `/api/users/create-sub-user`
Create sub-user under manager (admin/manager only).

**Request Body:**
```json
{
  "username": "sub_user_1",
  "password": "Pass123",
  "role": "user",
  "createdBy": "manager_id",
  "managerId": "manager_id",
  "avatar": "https://..."
}
```

### Coin & Transaction Endpoints

#### POST `/api/users/:id/coins`
Transfer coins to user.

**Request Body:**
```json
{
  "amount": 500,
  "senderId": "admin_static"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "senderCoins": 999999999
}
```

#### GET `/api/transfers`
Get all coin transfer logs (admin only).

**Response:**
```json
{
  "success": true,
  "transfers": [
    {
      "senderId": "admin_static",
      "senderName": "Admin",
      "senderRole": "admin",
      "receiverId": "user_123",
      "receiverName": "john_doe",
      "amount": 500,
      "timestamp": "2026-09-19T12:30:00.000Z"
    }
  ]
}
```

### System Endpoints

#### GET `/api/db-status`
Check database connection status.

**Response:**
```json
{
  "connected": true,
  "mode": "MongoDB Atlas" // or "In-Memory Fallback"
}
```

---

## 👥 User Roles & Permissions

| Feature | User | Coin Seller | Manager | Admin |
|---------|------|-------------|---------|-------|
| Create/Join Rooms | ✅ | ✅ | ✅ | ✅ |
| Play Games | ✅ | ✅ | ✅ | ✅ |
| Send Gifts | ✅ | ✅ | ✅ | ✅ |
| Transfer Coins | ❌ | ✅ (Limited) | ✅ (Limited) | ✅ (Unlimited) |
| View All Users | ❌ | ✅ | ✅ | ✅ |
| Block/Unblock Users | ❌ | ❌ | ✅ | ✅ |
| Assign Roles | ❌ | ❌ | ❌ | ✅ |
| Create Sub-Users | ❌ | ❌ | ✅ | ✅ |
| View Audit Logs | ❌ | ❌ | ❌ | ✅ |
| Admin Console Access | ❌ | ✅ | ✅ | ✅ |

---

## 🎮 Games & Features

### 🎲 Ludo Game

**How to Play:**
1. Ensure at least 2 seated players in the voice room
2. Click "Start Ludo" button
3. Players are assigned colors (Red, Green, Yellow, Blue)
4. Click "Roll Dice" on your turn
5. Pieces move automatically based on dice value
6. First to reach position 15 wins!

**Rules:**
- Simplified 16-position track per player
- Dice values: 1-6
- Turn-based gameplay
- Winner receives coin bonus

### 🎯 Dice Duel

**How to Play:**
1. Challenge another player (host vs current user by default)
2. Set bet amount (deducted from both players)
3. Both players roll dice simultaneously
4. Highest roll wins the round
5. Best of 3 rounds determines winner
6. Winner takes double the bet amount

**Rules:**
- Minimum bet: 10 coins
- Maximum bet: 1000 coins
- Automatic winner determination
- Instant coin transfer

### 🎰 Lucky Wheel

**How to Play:**
1. Click "Spin Lucky Wheel" in voice room
2. Wheel spins with smooth animation
3. Lands on random prize segment
4. Rewards instantly added to your balance

**Possible Rewards:**
- 🪙 50 Coins
- 🪙 100 Coins
- 🪙 250 Coins
- 🎁 Mystery Gift
- 💎 Premium Item
- 🎉 Jackpot Bonus
- 😢 Try Again
- 🔄 Free Spin

---

## 🌐 Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `GEMINI_API_KEY`
   - `APP_URL`

### Deploy to Railway

1. Connect your GitHub repository
2. Add environment variables
3. Deploy automatically on push

### Deploy to Google Cloud Run

1. Build Docker image:
```bash
docker build -t zoyo-app .
```

2. Push to Google Container Registry:
```bash
docker tag zoyo-app gcr.io/YOUR_PROJECT/zoyo-app
docker push gcr.io/YOUR_PROJECT/zoyo-app
```

3. Deploy to Cloud Run:
```bash
gcloud run deploy zoyo-app --image gcr.io/YOUR_PROJECT/zoyo-app
```

### Deploy to Heroku

1. Create Heroku app:
```bash
heroku create zoyo-voice-chat
```

2. Set environment variables:
```bash
heroku config:set MONGODB_URI="your_mongodb_uri"
```

3. Deploy:
```bash
git push heroku main
```

---

## 🔧 Troubleshooting

### MongoDB Connection Failed

**Symptom**: Console shows "❌ MongoDB Atlas connection error"

**Solution**:
- Verify `MONGODB_URI` in `.env` file
- Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for testing)
- Ensure database user has read/write permissions
- App will automatically fallback to in-memory mode

### Microphone Not Working

**Symptom**: Voice level visualizer shows 0

**Solution**:
- Grant microphone permissions in browser
- Check browser console for permission errors
- Ensure HTTPS in production (HTTP only works on localhost)
- Try different browser (Chrome recommended)

### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# OR change port in server.ts
const PORT = 3001;
```

### Build Errors

**Symptom**: `npm run build` fails

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf dist node_modules/.vite

# Rebuild
npm run build
```

### OTP Not Receiving

**Symptom**: OTP code doesn't appear

**Solution**:
- OTP is simulated (no real SMS)
- Check browser console for logged OTP code
- OTP format: `[SMS OTP SIMULATION] Code sent to <phone>: <code>`
- Use the code from console to verify

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Bugs

1. Check if the issue already exists
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, browser, Node version)

### Suggesting Features

1. Open an issue with `[Feature Request]` prefix
2. Describe the feature and use case
3. Explain why it would benefit users

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run lint`
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules
- Use Tailwind CSS for styling
- Write descriptive commit messages
- Add comments for complex logic

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 ZOYO Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **React Team** for the amazing framework
- **Tailwind Labs** for the utility-first CSS framework
- **MongoDB** for the flexible database solution
- **Unsplash** for beautiful stock photos
- **Lucide Icons** for the comprehensive icon library
- **Google Fonts** for the premium typography

---

## 📞 Support

- 📧 **Email**: support@zoyo.app
- 💬 **Discord**: [Join our community](https://discord.gg/zoyo)
- 🐦 **Twitter**: [@ZOYOApp](https://twitter.com/ZOYOApp)
- 📚 **Documentation**: [docs.zoyo.app](https://docs.zoyo.app)

---

<div align="center">

**Made with ❤️ by the ZOYO Team**

⭐ Star us on GitHub if you find this project useful!

[Report Bug](https://github.com/yourusername/zoyo/issues) • [Request Feature](https://github.com/yourusername/zoyo/issues) • [Documentation](https://docs.zoyo.app)

</div>
