# 📸 TimeCapsule

<div align="center">

### Capture Today. Relive Tomorrow.

A collaborative memory-sharing platform where photos and videos remain locked until a chosen reveal date, turning everyday moments into unforgettable future experiences.

</div>

---

## 📖 Overview

TimeCapsule is a social memory platform designed to preserve special moments and reveal them at the perfect time.

Users can create private events, invite friends through unique event codes, capture photos and videos, and store them inside a digital time capsule. All memories remain hidden until the reveal date arrives, creating excitement, anticipation, and a unique way to revisit shared experiences.

Whether it's a graduation, birthday, vacation, wedding, farewell, or reunion, TimeCapsule transforms memories into future surprises.

---

## ✨ Features

### 🎉 Create Time Capsule Events

Create personalized events with:

* Event title
* Event description
* Custom reveal date and time
* Private participation

---

### 👥 Invite Friends

Share events through invite codes.

Participants can:

* Join existing events
* Contribute memories
* View event members
* Collaborate in a shared capsule

---

### 📸 Photo Capture

Capture memories directly within the platform.

Features include:

* Camera integration
* Front and rear camera support
* Instant uploads
* Mobile-friendly experience

---

### 🎥 Video Recording

Record and upload videos directly to the capsule.

Supports:

* Real-time recording
* Media uploads
* Shared event storage

---

### 🔒 Locked Memories

The heart of TimeCapsule.

Uploaded content remains inaccessible until the reveal date.

This creates:

* Anticipation
* Authentic memory preservation
* Shared surprise experiences

---

### ⏳ Live Countdown

Every event includes a live countdown displaying:

* Days remaining
* Hours remaining
* Minutes remaining
* Seconds remaining

Until the capsule unlocks.

---

### 📂 Memory Gallery

Once unlocked, participants can:

* Browse photos
* Watch videos
* Relive shared experiences
* Access event memories

---

### 📥 Bulk Download

Download memories for archival purposes.

Features include:

* ZIP export
* Multiple file downloads
* Event memory backups

---

### 🔐 Secure Authentication

User authentication and access management powered by Supabase.

---

## 🏗️ System Architecture

```text
                    User
                      │
                      ▼

             Authentication
                (Supabase)
                      │
                      ▼

               TimeCapsule
                      │
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼

   Events        Media Uploads    Members
      │               │               │
      └───────────────┼───────────────┘
                      ▼

              Reveal System
             (Time-Based Lock)

                      │
                      ▼

             Memory Gallery
                      │
                      ▼

            Download & Archive
```

---

## 🛠️ Tech Stack

### Frontend

* React 19
* TypeScript
* TanStack Start
* TanStack Router
* TanStack Query
* Tailwind CSS 4
* Radix UI
* Lucide React

### Backend

* Supabase
* PostgreSQL Database
* Authentication Services
* Storage Services

### Media Handling

* Browser Camera API
* MediaRecorder API
* JSZip
* FileSaver

### Deployment

* Vercel

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/thanishkaykb/TimeCapsule.git

cd TimeCapsule
```

### Install Dependencies

```bash
npm install
```

or

```bash
bun install
```

### Configure Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run Development Server

```bash
npm run dev
```

---

## 📂 Project Structure

```text
src/
│
├── routes/
│   ├── Authentication
│   ├── Home
│   ├── Event Details
│   └── Password Recovery
│
├── components/
│   ├── CameraCapture
│   ├── Header
│   └── UI Components
│
├── hooks/
│   ├── Authentication
│   └── User Management
│
├── integrations/
│   └── Supabase
│
└── assets/
```

---

## 🎯 Use Cases

### Family Events

Preserve memories from birthdays, anniversaries, and reunions.

### Graduation Ceremonies

Create a shared memory collection for future reflection.

### Travel Groups

Collect photos and videos from all participants and reveal them together.

### Weddings

Allow guests to contribute memories to a shared digital capsule.

### Corporate Events

Capture team experiences and unlock them after the event concludes.

---

## 🔮 Future Enhancements

* AI-generated memory highlights
* Event cover albums
* Voice message capsules
* Scheduled anniversary reminders
* Story mode playback
* Private event chat
* End-to-end encryption
* Mobile application support

---

## 🧠 Core Idea

TimeCapsule encourages people to experience moments fully before revisiting them.

Instead of immediately consuming memories, users create a shared experience that becomes more meaningful when revealed in the future.

---

## 👨‍💻 Author

### Thanishka Yogesh

* GitHub: https://github.com/thanishkaykb
* LinkedIn: https://www.linkedin.com/in/thanishka-yogesh/
* Portfolio: https://portfolio-thanishka-yogesh.vercel.app/

---

## ⭐ Support

If you found this project useful, consider giving it a star.

Built to turn fleeting moments into timeless memories.
