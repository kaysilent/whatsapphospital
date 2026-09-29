# 🏥 WhatsApp Hospital CRM — Hostinger Node.js Deployment Guide

This application is fully built, pre-compiled, and ready to deploy on **Hostinger Web Hosting (Node.js App)** or **Hostinger VPS / Cloud Hosting**.

---

## ⚡ Quick 4-Step Deployment on Hostinger hPanel

### Step 1: Upload the Deployment Zip
1. Log into your **Hostinger hPanel**.
2. Go to **Websites** → Select your domain → **File Manager**.
3. Navigate to `public_html` (or your application folder).
4. Upload `whatsapphospital-deploy.zip`.
5. Right-click `whatsapphospital-deploy.zip` and click **Extract**.

---

### Step 2: Configure the Node.js Application
1. In hPanel, search for **Node.js** in the left sidebar.
2. Click **Create Application** (or manage existing).
3. Fill in the configuration:
   - **Node.js Version:** `20.x` or `22.x` (Recommended: `20.x LTS`)
   - **Application Mode:** `Production`
   - **Application Root:** `/` (or `public_html`)
   - **Application Startup File:** `server.js` (or `app.js`)
   - **Application URL:** `yourdomain.com`

---

### Step 3: Install Production Dependencies
1. Under the Node.js Manager, click the **"NPM Install"** button (or **Run NPM Install**).
2. Alternatively, open SSH / Terminal in hPanel and run:
   ```bash
   npm install --omit=dev
   ```

---

### Step 4: Set Environment Variables (Optional)
Under the **Environment Variables** tab in the Node.js manager, add:
- `NODE_ENV` = `production`
- `PORT` = `3000` (or leave default assigned by Hostinger)
- `GEMINI_API_KEY` = `your_gemini_api_key_here` (Optional - clinical fallback is active)
- `NEXT_PUBLIC_APP_URL` = `https://yourdomain.com`

Click **Save** and then click **Restart Application**.

---

## 🎯 Verification & Access

- **Public Doctor Login:** `https://yourdomain.com/login`
  - Demo Doctor Email: `doctor@ananyaclinic.com`
  - Password: `doctorpassword`
  - Or click the **"Explore Live Dashboard (Demo Doctor)"** button for instant access.
- **WhatsApp Live Simulator:** `https://yourdomain.com/demo`
- **Health Check Endpoint:** `https://yourdomain.com/_health` (returns `{"status":"healthy"}`)

---

## 🛡️ Troubleshooting

- **502 Bad Gateway / Application Not Starting:**
  - Check Node.js version is set to `20.x` or higher.
  - Verify startup file is set to `server.js`.
  - Check `stderr.log` in File Manager.
- **CSS / Images Not Loading:**
  - Verify that the `.next/static` and `public` folders exist in the application root directory.
