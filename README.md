# 🚢 Port Management System (3D Yard Simulator)

A modern, high-performance **Container Yard Management System** built using **React, Three.js, and Vite**, featuring real-time 2D–3D synchronization, realistic stacking logic, and a premium UI inspired by Uber & ChatGPT.

---

## 🚀 Tech Upgrade (What Changed)

This project is now powered by a modern frontend stack:

* ⚛️ **React 19** for UI architecture 
* ⚡ **Vite** for blazing-fast development & builds 
* 🎮 **Three.js** for 3D yard rendering 
* 📊 **Chart.js** for analytics dashboards 
* 🎞️ **GSAP** for smooth animations 

The app is bootstrapped via a Vite + React entry point:

* Root mounted in `#root` 
* Main app starts from `/src/main.jsx` 

---

## ✨ Features

### 🧠 Realistic Container Physics

* 20ft containers → occupy **2 cells**
* 40ft / 45ft containers → occupy **4 cells**
* Smart stacking rules:

  * ✅ 20ft can be placed on 40ft
  * ❌ 40ft cannot be placed on single 20ft
  * ✅ 40ft can be placed on **2×20ft (full support)**
* Uniform height validation across footprint

---

### 🏗️ Yard Simulation System

* Multi-section yard (**A, B, C**)
* Stack height limits
* Full footprint validation
* Real-time recalculation of stack levels

---

### 🌐 2D + 3D Unified Experience

* Interactive **grid-based yard (2D)**
* Fully synced **3D environment (Three.js)**
* Click anywhere:

  * Grid → opens inspection
  * 3D container → same inspection panel

---

### 🎮 Interaction System

* Placement mode with:

  * Live preview (valid/invalid highlighting)
  * Rotation (`R` key)
  * Cancel (`ESC`)
* Drag & drop container movement (planned / partial)
* Hover highlighting across full footprint

---

### 📊 Analytics Dashboard

* KPI cards
* Pie charts
* Bar charts
* Real-time updates based on yard state

---

### 🧾 Inspection Panel

* Click any container → see:

  * Full stack (bottom → top)
  * Container details
  * Type, size, level
* Blocking logic:

  * Cannot move/remove buried containers

---

### 🎨 Modern UI/UX

* Glassmorphic design system
* Floating panels & sidebars
* Smooth animations (GSAP)
* Focus mode for inspection
* Minimal, product-like interface

---

## 📁 Project Structure

```bash
├── index.html        # Root HTML (Vite entry)
├── src/
│   ├── main.jsx      # React entry point
│   ├── components/   # UI components
│   ├── logic/        # Yard + container logic
│   ├── three/        # 3D rendering logic
│   └── styles/       # UI styling
├── package.json
├── vite.config.js
```

---

## 🛠️ Installation & Setup

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/port-management-system.git
cd port-management-system
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Run Development Server

```bash
npm run dev
```

---

### 4. Open in Browser

```bash
http://localhost:5173
```

---

### 5. Build for Production

```bash
npm run build
```

---

## 🎮 How to Use

### ➤ Create Containers

* Use UI controls to create containers
* Choose size (20ft / 40ft / 45ft)

---

### ➤ Placement Mode

* Hover grid → preview footprint
* Click to place
* Press **R** → rotate
* Press **ESC** → cancel

---

### ➤ Inspect Containers

* Click on:

  * Grid cell
  * 3D container
* View full stack details

---

### ➤ Move Containers

* Drag container (or use move action)
* System validates:

  * Support coverage
  * Stack height
  * Blocking

---

## 🧠 Core Architecture

### 📦 Footprint-Based Model

Each container occupies multiple cells:

* Stored as **atomic footprint**
* All operations apply to full footprint

---

### ⚡ State System

* `yard` → spatial grid structure
* `containerMap` → O(1) lookup
* React handles UI reactivity

---

### 🎮 3D Integration

* Each container = **single mesh group**
* Positioned using footprint center
* Raycasting used for interaction

---

## 🔥 Key Highlights

* Real-world logistics simulation
* Complex constraint validation
* 2D + 3D synchronization
* Advanced UI/UX design
* Scalable architecture (React + Vite)

---

## 📌 Future Enhancements

* 🤖 AI-based container placement
* 🚢 Crane path optimization
* 📦 Auto-retrieval system
* 🌍 Multi-yard management
* 📊 Advanced analytics + forecasting

---

## 👤 Author

**Ronit Das**
BTech CSE (Gaming Technology)

---

## ⭐ Support

If you like this project:

* ⭐ Star the repo
* 🍴 Fork it
* 🚀 Build on it

---

## ⚠️ Note

This project is actively evolving — expect rapid improvements in:

* UX
* Drag & drop system
* AI-based logistics

---
